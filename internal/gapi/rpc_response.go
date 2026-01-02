package gapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/weladee/weladee-form/internal/auth"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/db/sqlc"
	"github.com/weladee/weladee-form/internal/utils"
	"github.com/weladee/weladee-form/proto/pb"
)

type ResponseServerImpl struct {
	pb.UnimplementedResponseServiceServer
	db *db.Database
}

// Helper: get form and check access
func (s *ResponseServerImpl) getFormForResponse(ctx context.Context, formID uuid.UUID, requireOwner bool) (sqlc.FormForm, *sqlc.FormUser, error) {
	form, err := s.db.Queries.GetForm(ctx, formID)
	if err != nil {
		return sqlc.FormForm{}, nil, status.Errorf(codes.NotFound, "form not found")
	}

	if !form.IsPublished {
		return sqlc.FormForm{}, nil, status.Errorf(codes.NotFound, "form not published")
	}

	if !form.IsAcceptingResponses {
		return sqlc.FormForm{}, nil, status.Errorf(codes.FailedPrecondition, "form is not accepting responses")
	}

	var user *sqlc.FormUser
	if requireOwner {
		claims, err := auth.GetUserClaims(ctx)
		if err != nil {
			return sqlc.FormForm{}, nil, status.Errorf(codes.Unauthenticated, "authentication required")
		}

		formUser, err := s.db.Queries.GetFormUserByWeladeeID(ctx, int32(claims.UserID))
		if err != nil || formUser.ID != form.UserID {
			return sqlc.FormForm{}, nil, status.Errorf(codes.PermissionDenied, "not form owner")
		}
		user = &formUser
	} else if form.RequireLogin {
		claims, err := auth.GetUserClaims(ctx)
		if err != nil {
			return sqlc.FormForm{}, nil, status.Errorf(codes.Unauthenticated, "login required for this form")
		}

		formUser, err := s.db.Queries.GetFormUserByWeladeeID(ctx, int32(claims.UserID))
		if err != nil {
			return sqlc.FormForm{}, nil, status.Errorf(codes.Internal, "failed to get user")
		}
		user = &formUser
	}

	return form, user, nil
}

// Convert SQLC response + answers to protobuf
func (s *ResponseServerImpl) convertResponse(resp sqlc.FormResponse, answers []sqlc.FormAnswer) (*pb.Response, error) {
	pbResp := &pb.Response{
		Id:         resp.ID.String(),
		FormId:     resp.FormID.String(),
		Completed:  resp.Completed,
		CreatedAt:  timestamppb.New(resp.CreatedAt),
	}

	if resp.RespondentUserID.Valid {
		uuid, _ := uuid.FromBytes(resp.RespondentUserID.Bytes[:])
		uuidStr := uuid.String()
		pbResp.RespondentUserId = &uuidStr
	}
	if resp.RespondentEmail.Valid {
		pbResp.RespondentEmail = &resp.RespondentEmail.String
	}
	if resp.RespondentName.Valid {
		pbResp.RespondentName = &resp.RespondentName.String
	}
	if resp.SubmittedAt.Valid {
		pbResp.SubmittedAt = timestamppb.New(resp.SubmittedAt.Time)
	}

	for _, a := range answers {
		pbA := &pb.Answer{
			Id:         a.ID.String(),
			ResponseId: a.ResponseID.String(),
			QuestionId: a.QuestionID.String(),
			CreatedAt:  timestamppb.New(a.CreatedAt),
		}

		if a.AnswerText.Valid {
			pbA.AnswerText = &a.AnswerText.String
		}
		if a.AnswerNumber.Valid {
			// pgtype.Numeric stores value as Int * 10^Exp
			// Use Float64Value() to get the float64 representation
			flt, err := a.AnswerNumber.Float64Value()
			if err == nil {
				pbA.AnswerNumber = &flt.Float64
			}
		}
		if a.AnswerDate.Valid {
			dateStr := a.AnswerDate.Time.Format("2006-01-02")
			pbA.AnswerDate = &dateStr
		}
		if a.AnswerTime.Valid {
			micros := a.AnswerTime.Microseconds
			timeStr := time.Date(0, 0, 0, 0, 0, int(micros), 0, time.UTC).Format("15:04:05")
			pbA.AnswerTime = &timeStr
		}
		if len(a.AnswerChoices) > 0 {
			var choicesMap map[string]interface{}
			if err := json.Unmarshal(a.AnswerChoices, &choicesMap); err == nil {
				choices, _ := structpb.NewStruct(choicesMap)
				pbA.AnswerChoices = choices
			}
		}
		if a.AnswerFileUrl.Valid {
			pbA.AnswerFileUrl = &a.AnswerFileUrl.String
		}

		pbResp.Answers = append(pbResp.Answers, pbA)
	}

	return pbResp, nil
}

func (s *ResponseServerImpl) SubmitResponse(ctx context.Context, req *pb.SubmitResponseRequest) (*pb.SubmitResponseResponse, error) {
	formID, err := uuid.Parse(req.FormId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	_, respondentUser, err := s.getFormForResponse(ctx, formID, false)
	if err != nil {
		return nil, err
	}

	// Get client IP and User-Agent from gRPC metadata
	md, _ := metadata.FromIncomingContext(ctx)
	ip := net.IP(net.ParseIP("127.0.0.1")) // fallback
	if fwd := md.Get("x-forwarded-for"); len(fwd) > 0 {
		ip = net.ParseIP(fwd[0])
	}
	userAgent := ""
	if ua := md.Get("user-agent"); len(ua) > 0 {
		userAgent = ua[0]
	}

	var respondentUserUUID uuid.UUID
	if respondentUser != nil {
		respondentUserUUID = respondentUser.ID
	}

	var responseID uuid.UUID
	err = s.db.ExecTx(ctx, func(q *sqlc.Queries) error {
		// Create or update response (partial or complete)
		var response sqlc.FormResponse
		var err error

		// Extract base types for SQLC
		respondentEmailStr := ""
		if req.RespondentEmail != nil && *req.RespondentEmail != "" {
			respondentEmailStr = *req.RespondentEmail
		}
		respondentNameStr := ""
		if req.RespondentName != nil && *req.RespondentName != "" {
			respondentNameStr = *req.RespondentName
		}
		userAgentStr := userAgent
		if userAgentStr == "" {
			userAgentStr = "Unknown"
		}

		if req.Complete {
			// Final submission
			response, err = q.CreateResponse(ctx, sqlc.CreateResponseParams{
				FormID:           formID,
				RespondentUserID: respondentUserUUID,
				RespondentEmail:  respondentEmailStr,
				RespondentName:   respondentNameStr,
				IpAddress:        ip,
				UserAgent:        userAgentStr,
				Completed:        true,
			})
		} else {
			// Partial save
			response, err = q.CreateResponse(ctx, sqlc.CreateResponseParams{
				FormID:           formID,
				RespondentUserID: respondentUserUUID,
				RespondentEmail:  respondentEmailStr,
				RespondentName:   respondentNameStr,
				IpAddress:        ip,
				UserAgent:        userAgentStr,
				Completed:        false,
			})
		}
		if err != nil {
			return err
		}
		responseID = response.ID

		// Upsert answers
		for _, input := range req.Answers {
			questionID, err := uuid.Parse(input.QuestionId)
			if err != nil {
				continue // skip invalid
			}

			// Extract base types for SQLC
			answerTextStr := ""
			if input.AnswerText != nil {
				answerTextStr = *input.AnswerText
			}
			answerNumberVal := 0.0
			if input.AnswerNumber != nil {
				answerNumberVal = *input.AnswerNumber
			}
			answerFileUrlStr := ""
			if input.AnswerFileUrl != nil {
				answerFileUrlStr = *input.AnswerFileUrl
			}

			_, err = q.CreateAnswer(ctx, sqlc.CreateAnswerParams{
				ResponseID:    response.ID,
				QuestionID:    questionID,
				AnswerText:    answerTextStr,
				AnswerNumber:  answerNumberVal,
				AnswerDate:    "",
				AnswerTime:    "",
				AnswerChoices: []byte{},
				AnswerFileUrl: answerFileUrlStr,
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to submit response: %v", err)
	}

	// Fetch full response with answers
	answers, _ := s.db.Queries.GetResponseAnswers(ctx, responseID)
	response, _ := s.db.Queries.GetResponse(ctx, responseID)
	pbResp, _ := s.convertResponse(response, answers)

	return &pb.SubmitResponseResponse{
		Response: pbResp,
	}, nil
}

func (s *ResponseServerImpl) GetResponse(ctx context.Context, req *pb.GetResponseRequest) (*pb.GetResponseResponse, error) {
	_, _, err := s.getFormForResponse(ctx, uuid.Nil, true) // require owner
	if err != nil {
		return nil, err
	}

	responseID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid response ID")
	}

	resp, err := s.db.Queries.GetResponse(ctx, responseID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "response not found")
	}

	answers, err := s.db.Queries.GetResponseAnswers(ctx, responseID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load answers")
	}

	pbResp, err := s.convertResponse(resp, answers)
	if err != nil {
		return nil, err
	}

	return &pb.GetResponseResponse{Response: pbResp}, nil
}

func (s *ResponseServerImpl) ListResponses(ctx context.Context, req *pb.ListResponsesRequest) (*pb.ListResponsesResponse, error) {
	_, _, err := s.getFormForResponse(ctx, uuid.Nil, true) // require owner
	if err != nil {
		return nil, err
	}

	formID, err := uuid.Parse(req.FormId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	limit := int32(20)
	offset := int32(0)
	page := int32(1)
	if req.Pagination != nil {
		if req.Pagination.PageSize > 0 {
			limit = req.Pagination.PageSize
		}
		page = req.Pagination.Page
		offset = (page - 1) * limit
	}

	responses, err := s.db.Queries.ListFormResponses(ctx, sqlc.ListFormResponsesParams{
		FormID:      formID,
		LimitCount:  limit,
		OffsetCount: offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list responses: %v", err)
	}

	var pbResponses []*pb.Response
	for _, r := range responses {
		answers, _ := s.db.Queries.GetResponseAnswers(ctx, r.ID)
		pbR, _ := s.convertResponse(r, answers)
		if req.CompletedOnly != nil && *req.CompletedOnly && !r.Completed {
			continue
		}
		pbResponses = append(pbResponses, pbR)
	}

	// Get total count for pagination
	total64, err := s.db.Queries.CountFormResponses(ctx, formID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count responses: %v", err)
	}
	total := int32(total64)

	return &pb.ListResponsesResponse{
		Responses: pbResponses,
		Pagination: &pb.PaginationResponse{
			Total:      total,
			Page:       page,
			PageSize:   limit,
			TotalPages: total / limit,
		},
	}, nil
}

func (s *ResponseServerImpl) ExportResponses(ctx context.Context, req *pb.ExportResponsesRequest) (*pb.ExportResponsesResponse, error) {
	// Authorization: must be form owner
	formID, err := uuid.Parse(req.FormId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	// Verify ownership
	_, _, err = s.getFormForResponse(ctx, formID, true)
	if err != nil {
		return nil, err
	}

	// Fetch questions (for headers/order)
	questions, err := s.db.Queries.ListFormQuestions(ctx, formID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to fetch questions: %v", err)
	}

	// Fetch responses with answers (only completed by default, but can extend)
	rows, err := s.db.Queries.GetFormResponsesWithAnswers(ctx, formID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to fetch responses: %v", err)
	}

	var data []byte
	var mimeType string
	var filename string

	format := strings.ToLower(req.Format)
	timestamp := time.Now().Format("20060102-150405")

	switch format {
	case "csv", "":
		data, err = utils.ExportResponsesToCSV(questions, rows)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate CSV: %v", err)
		}
		mimeType = "text/csv"
		filename = fmt.Sprintf("weladee-form-%s-responses-%s.csv", formID.String()[:8], timestamp)

	case "json":
		data, err = utils.ExportResponsesToJSON(questions, rows, formID)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate JSON: %v", err)
		}
		mimeType = "application/json"
		filename = fmt.Sprintf("weladee-form-%s-responses-%s.json", formID.String()[:8], timestamp)

	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported format: %s (supported: csv, json)", req.Format)
	}

	return &pb.ExportResponsesResponse{
		Data:     data,
		Filename: filename,
		MimeType: mimeType,
	}, nil
}
