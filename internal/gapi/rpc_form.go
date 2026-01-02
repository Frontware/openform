package gapi

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/weladee/weladee-form/internal/auth"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/db/sqlc"
	"github.com/weladee/weladee-form/internal/storage"
	"github.com/weladee/weladee-form/proto/pb"
)

type FormServerImpl struct {
	pb.UnimplementedFormServiceServer
	db      *db.Database
	storage *storage.S3Storage
}

// Helper: get authenticated user and ensure form user record exists
func (s *FormServerImpl) getAuthenticatedFormUser(ctx context.Context) (sqlc.FormUser, error) {
	claims, err := auth.GetUserClaims(ctx)
	if err != nil {
		return sqlc.FormUser{}, status.Errorf(codes.Unauthenticated, "authentication required: %v", err)
	}

	user, err := s.db.Queries.GetFormUserByWeladeeID(ctx, int32(claims.UserID))
	if err != nil {
		// Create if not exists
		fullName := ""
		if claims.DisplayName != "" {
			fullName = claims.DisplayName
		}
		user, err = s.db.Queries.CreateFormUser(ctx, sqlc.CreateFormUserParams{
			WeladeeUserID: int32(claims.UserID),
			Email:         claims.Email,
			FullName:      fullName,
			AvatarUrl:     "",
		})
		if err != nil {
			return sqlc.FormUser{}, status.Errorf(codes.Internal, "failed to create form user: %v", err)
		}
	}

	return user, nil
}

// Helper: convert SQLC form + questions to protobuf
func (s *FormServerImpl) convertFormWithQuestions(form sqlc.FormForm, questions []sqlc.FormQuestion) (*pb.Form, error) {
	pbForm := &pb.Form{
		Id:                    form.ID.String(),
		UserId:                form.UserID.String(),
		Title:                 form.Title,
		Description:           form.Description.String,
		Theme:                 pb.FormTheme(pb.FormTheme_value["FORM_THEME_"+strings.ToUpper(form.Theme)]),
		IsPublished:           form.IsPublished,
		IsAcceptingResponses:  form.IsAcceptingResponses,
		RequireLogin:          form.RequireLogin,
		AllowMultipleSubmissions: form.AllowMultipleSubmissions,
		ShowProgressBar:       form.ShowProgressBar,
		CustomThankYouMessage: form.CustomThankYouMessage.String,
		RedirectUrl:           form.RedirectUrl.String,
		Settings:              &structpb.Struct{},
		CreatedAt:             timestamppb.New(form.CreatedAt),
		UpdatedAt:             timestamppb.New(form.UpdatedAt),
	}

	// Unmarshal settings JSONB if present
	if len(form.Settings) > 0 {
		var settingsMap map[string]interface{}
		if err := json.Unmarshal(form.Settings, &settingsMap); err == nil {
			settings, err := structpb.NewStruct(settingsMap)
			if err != nil {
				return nil, err
			}
			pbForm.Settings = settings
		}
	}

	for _, q := range questions {
		pbQ := &pb.Question{
			Id:             q.ID.String(),
			FormId:         q.FormID.String(),
			Type:           pb.QuestionType(pb.QuestionType_value["QUESTION_TYPE_"+strings.ToUpper(q.Type)]),
			Label:          q.Label,
			Description:    q.Description.String,
			Placeholder:    q.Placeholder.String,
			Required:       q.Required,
			OrderIndex:     q.OrderIndex,
			Options:        &structpb.Struct{},
			ValidationRules: &structpb.Struct{},
			Settings:       &structpb.Struct{},
			CreatedAt:      timestamppb.New(q.CreatedAt),
			UpdatedAt:      timestamppb.New(q.UpdatedAt),
		}

		if len(q.Options) > 0 {
			var optsMap map[string]interface{}
			if err := json.Unmarshal(q.Options, &optsMap); err == nil {
				opts, _ := structpb.NewStruct(optsMap)
				pbQ.Options = opts
			}
		}
		if len(q.ValidationRules) > 0 {
			var rulesMap map[string]interface{}
			if err := json.Unmarshal(q.ValidationRules, &rulesMap); err == nil {
				rules, _ := structpb.NewStruct(rulesMap)
				pbQ.ValidationRules = rules
			}
		}
		if len(q.Settings) > 0 {
			var setMap map[string]interface{}
			if err := json.Unmarshal(q.Settings, &setMap); err == nil {
				set, _ := structpb.NewStruct(setMap)
				pbQ.Settings = set
			}
		}

		pbForm.Questions = append(pbForm.Questions, pbQ)
	}

	return pbForm, nil
}

func (s *FormServerImpl) CreateForm(ctx context.Context, req *pb.CreateFormRequest) (*pb.CreateFormResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	err = s.db.ExecTx(ctx, func(q *sqlc.Queries) error {
		description := ""
		if req.Description != "" {
			description = req.Description
		}

		formParams := sqlc.CreateFormParams{
			UserID:                   user.ID,
			Title:                    req.Title,
			Description:              description,
			Theme:                    strings.ToLower(req.Theme.String()[11:]), // strip FORM_THEME_
			IsPublished:              false,
			IsAcceptingResponses:     true,
			RequireLogin:             false,
			AllowMultipleSubmissions: false,
			ShowProgressBar:          true,
			Settings:                 []byte{},
		}

		form, err := q.CreateForm(ctx, formParams)
		if err != nil {
			return err
		}

		for i, qpb := range req.Questions {
			qDescription := ""
			if qpb.Description != "" {
				qDescription = qpb.Description
			}
			qPlaceholder := ""
			if qpb.Placeholder != "" {
				qPlaceholder = qpb.Placeholder
			}

			_, err := q.CreateQuestion(ctx, sqlc.CreateQuestionParams{
				FormID:          form.ID,
				Type:            strings.ToLower(qpb.Type.String()[13:]),
				Label:           qpb.Label,
				Description:     qDescription,
				Placeholder:     qPlaceholder,
				Required:        qpb.Required,
				OrderIndex:      int32(i),
				Options:         []byte{},
				ValidationRules: []byte{},
				Settings:        []byte{},
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create form: %v", err)
	}

	// Fetch final form with questions - get the most recent form
	forms, err := s.db.Queries.ListUserForms(ctx, sqlc.ListUserFormsParams{
		UserID:      user.ID,
		LimitCount:  1,
		OffsetCount: 0,
	})
	if err != nil || len(forms) == 0 {
		return nil, status.Errorf(codes.Internal, "failed to retrieve created form")
	}

	questions, _ := s.db.Queries.ListFormQuestions(ctx, forms[0].ID)
	pbForm, err := s.convertFormWithQuestions(forms[0], questions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert form: %v", err)
	}

	return &pb.CreateFormResponse{Form: pbForm}, nil
}

func (s *FormServerImpl) GetForm(ctx context.Context, req *pb.GetFormRequest) (*pb.GetFormResponse, error) {
	formID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	form, err := s.db.Queries.GetForm(ctx, formID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "form not found")
	}

	var questions []sqlc.FormQuestion
	if req.IncludeQuestions {
		questions, err = s.db.Queries.ListFormQuestions(ctx, formID)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to load questions: %v", err)
		}
	}

	pbForm, err := s.convertFormWithQuestions(form, questions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "conversion error: %v", err)
	}

	return &pb.GetFormResponse{Form: pbForm}, nil
}

func (s *FormServerImpl) UpdateForm(ctx context.Context, req *pb.UpdateFormRequest) (*pb.UpdateFormResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	formID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	// Get current form first
	currentForm, err := s.db.Queries.GetForm(ctx, formID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "form not found")
	}

	// Build update parameters - use current values as defaults
	params := sqlc.UpdateFormParams{
		ID:                       formID,
		UserID:                   user.ID,
		Title:                    currentForm.Title,
		Description:              currentForm.Description.String,
		Theme:                    currentForm.Theme,
		IsPublished:              currentForm.IsPublished,
		IsAcceptingResponses:     currentForm.IsAcceptingResponses,
		RequireLogin:             currentForm.RequireLogin,
		AllowMultipleSubmissions: currentForm.AllowMultipleSubmissions,
		ShowProgressBar:          currentForm.ShowProgressBar,
		CustomThankYouMessage:    currentForm.CustomThankYouMessage.String,
		RedirectUrl:              currentForm.RedirectUrl.String,
		Settings:                 currentForm.Settings,
	}

	// Override with provided values
	if req.Title != nil {
		params.Title = *req.Title
	}
	if req.Description != nil {
		params.Description = *req.Description
	}
	if req.Theme != nil {
		params.Theme = strings.ToLower(req.Theme.String()[11:])
	}
	if req.IsPublished != nil {
		params.IsPublished = *req.IsPublished
	}

	form, err := s.db.Queries.UpdateForm(ctx, params)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "form not found or unauthorized")
	}

	questions, _ := s.db.Queries.ListFormQuestions(ctx, formID)
	pbForm, err := s.convertFormWithQuestions(form, questions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "conversion error: %v", err)
	}

	return &pb.UpdateFormResponse{Form: pbForm}, nil
}

func (s *FormServerImpl) DeleteForm(ctx context.Context, req *pb.DeleteFormRequest) (*pb.DeleteFormResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	formID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	err = s.db.Queries.DeleteForm(ctx, sqlc.DeleteFormParams{
		ID:     formID,
		UserID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "form not found or unauthorized")
	}

	return &pb.DeleteFormResponse{Success: true}, nil
}

func (s *FormServerImpl) ListForms(ctx context.Context, req *pb.ListFormsRequest) (*pb.ListFormsResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
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

	forms, err := s.db.Queries.ListUserForms(ctx, sqlc.ListUserFormsParams{
		UserID:      user.ID,
		LimitCount:  limit,
		OffsetCount: offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list forms: %v", err)
	}

	var pbForms []*pb.Form
	for _, f := range forms {
		questions, _ := s.db.Queries.ListFormQuestions(ctx, f.ID)
		pbF, _ := s.convertFormWithQuestions(f, questions)
		pbForms = append(pbForms, pbF)
	}

	// Get total count for pagination
	total64, err := s.db.Queries.CountUserForms(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count forms: %v", err)
	}
	total := int32(total64)
	pages := total / limit
	if total%limit > 0 {
		pages++
	}

	return &pb.ListFormsResponse{
		Forms: pbForms,
		Pagination: &pb.PaginationResponse{
			Total:      total,
			Page:       page,
			PageSize:   limit,
			TotalPages: pages,
		},
	}, nil
}

func (s *FormServerImpl) PublishForm(ctx context.Context, req *pb.PublishFormRequest) (*pb.PublishFormResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	formID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	form, err := s.db.Queries.PublishForm(ctx, sqlc.PublishFormParams{
		ID:     formID,
		UserID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "form not found or unauthorized")
	}

	questions, _ := s.db.Queries.ListFormQuestions(ctx, formID)
	pbForm, err := s.convertFormWithQuestions(form, questions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "conversion error: %v", err)
	}

	return &pb.PublishFormResponse{Form: pbForm}, nil
}

func (s *FormServerImpl) GetFormStats(ctx context.Context, req *pb.GetFormStatsRequest) (*pb.GetFormStatsResponse, error) {
	formID, err := uuid.Parse(req.FormId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	stats, err := s.db.Queries.GetFormStats(ctx, formID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get stats: %v", err)
	}

	return &pb.GetFormStatsResponse{
		Stats: &pb.FormStats{
			TotalResponses:     int64(stats.TotalResponses),
			CompletedResponses: int64(stats.CompletedResponses),
			PartialResponses:   int64(stats.PartialResponses),
			// Add views, completion rate if you extend query
		},
	}, nil
}

// Question management RPCs

func (s *FormServerImpl) CreateQuestion(ctx context.Context, req *pb.CreateQuestionRequest) (*pb.CreateQuestionResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	formID, err := uuid.Parse(req.FormId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	// Verify ownership
	form, err := s.db.Queries.GetForm(ctx, formID)
	if err != nil || form.UserID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "not form owner")
	}

	description := ""
	if req.Description != "" {
		description = req.Description
	}
	placeholder := ""
	if req.Placeholder != "" {
		placeholder = req.Placeholder
	}

	question, err := s.db.Queries.CreateQuestion(ctx, sqlc.CreateQuestionParams{
		FormID:      formID,
		Type:        strings.ToLower(req.Type.String()[13:]),
		Label:       req.Label,
		Description: description,
		Placeholder: placeholder,
		Required:    req.Required,
		OrderIndex:  req.OrderIndex,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create question: %v", err)
	}

	pbQ := &pb.Question{
		Id:          question.ID.String(),
		FormId:      question.FormID.String(),
		Type:        req.Type,
		Label:       question.Label,
		Required:    question.Required,
		OrderIndex:  question.OrderIndex,
		CreatedAt:   timestamppb.New(question.CreatedAt),
		UpdatedAt:   timestamppb.New(question.UpdatedAt),
	}

	return &pb.CreateQuestionResponse{Question: pbQ}, nil
}

func (s *FormServerImpl) GetFormBySlug(ctx context.Context, req *pb.GetFormBySlugRequest) (*pb.GetFormBySlugResponse, error) {
	form, err := s.db.Queries.GetFormBySlug(ctx, req.Slug)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "form not found")
	}

	questions, _ := s.db.Queries.ListFormQuestions(ctx, form.ID)
	pbForm, err := s.convertFormWithQuestions(form, questions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "conversion error: %v", err)
	}

	return &pb.GetFormBySlugResponse{Form: pbForm}, nil
}

func (s *FormServerImpl) UpdateQuestion(ctx context.Context, req *pb.UpdateQuestionRequest) (*pb.UpdateQuestionResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	questionID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid question ID")
	}

	// Get question to verify form ownership
	question, err := s.db.Queries.GetQuestion(ctx, questionID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "question not found")
	}

	form, err := s.db.Queries.GetForm(ctx, question.FormID)
	if err != nil || form.UserID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "not form owner")
	}

	// Build update params with current values as defaults
	params := sqlc.UpdateQuestionParams{
		ID:              questionID,
		Type:            question.Type,
		Label:           question.Label,
		Description:     question.Description.String,
		Placeholder:     question.Placeholder.String,
		Required:        question.Required,
		OrderIndex:      question.OrderIndex,
		Options:         question.Options,
		ValidationRules: question.ValidationRules,
		Settings:        question.Settings,
	}

	// Override with provided values
	if req.Type != nil {
		params.Type = strings.ToLower(req.Type.String()[13:])
	}
	if req.Label != nil {
		params.Label = *req.Label
	}
	if req.Description != nil {
		params.Description = *req.Description
	}
	if req.Placeholder != nil {
		params.Placeholder = *req.Placeholder
	}
	if req.Required != nil {
		params.Required = *req.Required
	}
	if req.OrderIndex != nil {
		params.OrderIndex = *req.OrderIndex
	}
	if req.Options != nil {
		if opts, err := structpb.NewStruct(req.Options.AsMap()); err == nil {
			if optsBytes, err := proto.Marshal(opts); err == nil {
				params.Options = optsBytes
			}
		}
	}
	if req.ValidationRules != nil {
		if rules, err := structpb.NewStruct(req.ValidationRules.AsMap()); err == nil {
			if rulesBytes, err := proto.Marshal(rules); err == nil {
				params.ValidationRules = rulesBytes
			}
		}
	}

	updated, err := s.db.Queries.UpdateQuestion(ctx, params)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update question: %v", err)
	}

	pbQ := s.convertQuestionToProto(updated)
	return &pb.UpdateQuestionResponse{Question: pbQ}, nil
}

func (s *FormServerImpl) DeleteQuestion(ctx context.Context, req *pb.DeleteQuestionRequest) (*pb.DeleteQuestionResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	questionID, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid question ID")
	}

	// Get question to verify form ownership
	question, err := s.db.Queries.GetQuestion(ctx, questionID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "question not found")
	}

	form, err := s.db.Queries.GetForm(ctx, question.FormID)
	if err != nil || form.UserID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "not form owner")
	}

	err = s.db.Queries.DeleteQuestion(ctx, questionID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete question: %v", err)
	}

	return &pb.DeleteQuestionResponse{Success: true}, nil
}

func (s *FormServerImpl) ReorderQuestions(ctx context.Context, req *pb.ReorderQuestionsRequest) (*pb.ReorderQuestionsResponse, error) {
	user, err := s.getAuthenticatedFormUser(ctx)
	if err != nil {
		return nil, err
	}

	formID, err := uuid.Parse(req.FormId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	// Verify form ownership
	form, err := s.db.Queries.GetForm(ctx, formID)
	if err != nil || form.UserID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "not form owner")
	}

	// Execute in transaction
	err = s.db.ExecTx(ctx, func(q *sqlc.Queries) error {
		for i, questionIDStr := range req.QuestionIds {
			questionID, err := uuid.Parse(questionIDStr)
			if err != nil {
				return status.Errorf(codes.InvalidArgument, "invalid question ID: %s", questionIDStr)
			}

			err = q.ReorderQuestions(ctx, sqlc.ReorderQuestionsParams{
				ID:         questionID,
				OrderIndex: int32(i),
			})
			if err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to reorder questions: %v", err)
	}

	return &pb.ReorderQuestionsResponse{Success: true}, nil
}

// convertQuestionToProto converts a SQLC question to protobuf
func (s *FormServerImpl) convertQuestionToProto(q sqlc.FormQuestion) *pb.Question {
	pbQ := &pb.Question{
		Id:             q.ID.String(),
		FormId:         q.FormID.String(),
		Type:           pb.QuestionType(pb.QuestionType_value["QUESTION_TYPE_"+strings.ToUpper(q.Type)]),
		Label:          q.Label,
		Description:    q.Description.String,
		Placeholder:    q.Placeholder.String,
		Required:       q.Required,
		OrderIndex:     q.OrderIndex,
		Options:        &structpb.Struct{},
		ValidationRules: &structpb.Struct{},
		Settings:       &structpb.Struct{},
		CreatedAt:      timestamppb.New(q.CreatedAt),
		UpdatedAt:      timestamppb.New(q.UpdatedAt),
	}

	if len(q.Options) > 0 {
		var optsMap map[string]interface{}
		if err := json.Unmarshal(q.Options, &optsMap); err == nil {
			if opts, err := structpb.NewStruct(optsMap); err == nil {
				pbQ.Options = opts
			}
		}
	}
	if len(q.ValidationRules) > 0 {
		var rulesMap map[string]interface{}
		if err := json.Unmarshal(q.ValidationRules, &rulesMap); err == nil {
			if rules, err := structpb.NewStruct(rulesMap); err == nil {
				pbQ.ValidationRules = rules
			}
		}
	}
	if len(q.Settings) > 0 {
		var setMap map[string]interface{}
		if err := json.Unmarshal(q.Settings, &setMap); err == nil {
			if set, err := structpb.NewStruct(setMap); err == nil {
				pbQ.Settings = set
			}
		}
	}

	return pbQ
}
