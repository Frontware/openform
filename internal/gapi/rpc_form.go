package gapi

import (
	"context"
	"encoding/json"
	"log"
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
		ForceCaptcha:          form.ForceCaptcha,
		Settings:              &structpb.Struct{},
		CreatedAt:             timestamppb.New(form.CreatedAt),
		UpdatedAt:             timestamppb.New(form.UpdatedAt),
	}

	// Unmarshal settings JSONB if present
	if len(form.Settings) > 0 {
		var settingsMap map[string]any
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
			var optsMap map[string]any
			if err := json.Unmarshal(q.Options, &optsMap); err == nil {
				opts, _ := structpb.NewStruct(optsMap)
				pbQ.Options = opts
			}
		}
		if len(q.ValidationRules) > 0 {
			var rulesMap map[string]any
			if err := json.Unmarshal(q.ValidationRules, &rulesMap); err == nil {
				rules, _ := structpb.NewStruct(rulesMap)
				pbQ.ValidationRules = rules
			}
		}
		if len(q.Settings) > 0 {
			var setMap map[string]any
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

	// Check form limit based on customer_type
	claims, err := auth.GetUserClaims(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user claims: %v", err)
	}

	// Get user's current form count
	count, err := s.db.Queries.CountUserForms(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count forms: %v", err)
	}

	var maxForms int
	switch claims.CustomerType {
	case "enterprise":
		maxForms = -1 // Unlimited
	case "standard":
		maxForms = 15
	case "sme":
		maxForms = 5
	default:
		maxForms = 5 // Default to SME limit
	}

	if maxForms > 0 && count >= int64(maxForms) {
		return nil, status.Errorf(codes.ResourceExhausted,
			"form limit reached for %s customer: maximum %d forms", claims.CustomerType, maxForms)
	}

	var createdFormID uuid.UUID

	err = s.db.ExecTx(ctx, func(q *sqlc.Queries) error {
		description := ""
		if req.Description != "" {
			description = req.Description
		}

		// Marshal settings to JSON, use empty object if nil
		settingsJSON := []byte("{}")
		if req.Settings != nil {
			bytes, err := proto.Marshal(req.Settings)
			if err == nil && len(bytes) > 0 {
				// For now use empty JSON object - proto struct is complex
				settingsJSON = []byte("{}")
			}
		}

		formParams := sqlc.CreateFormParams{
			UserID:                   user.ID,
			Title:                    req.Title,
			Description:              description,
			Theme:                    mapThemeToDB(req.Theme),
			IsPublished:              false,
			IsAcceptingResponses:     true,
			RequireLogin:             false,
			AllowMultipleSubmissions: false,
			ShowProgressBar:          true,
			Settings:                 settingsJSON,
		}

		form, err := q.CreateForm(ctx, formParams)
		if err != nil {
			return err
		}
		createdFormID = form.ID

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
				Type:            mapQuestionTypeToDB(qpb.Type),
				Label:           qpb.Label,
				Description:     qDescription,
				Placeholder:     qPlaceholder,
				Required:        qpb.Required,
				OrderIndex:      int32(i),
				Options:         []byte("{}"),
				ValidationRules: []byte("{}"),
				Settings:        []byte("{}"),
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

	// Fetch final form with questions
	form, err := s.db.Queries.GetForm(ctx, createdFormID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to retrieve created form: %v", err)
	}

	questions, _ := s.db.Queries.ListFormQuestions(ctx, createdFormID)
	pbForm, err := s.convertFormWithQuestions(form, questions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert form: %v", err)
	}

	return &pb.CreateFormResponse{Form: pbForm}, nil
}

func (s *FormServerImpl) GetForm(ctx context.Context, req *pb.GetFormRequest) (*pb.GetFormResponse, error) {
	log.Printf("[GetForm] Request received - Form ID: %s, IncludeQuestions: %v", req.Id, req.IncludeQuestions)

	formID, err := uuid.Parse(req.Id)
	if err != nil {
		log.Printf("[GetForm] Invalid UUID: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	form, err := s.db.Queries.GetForm(ctx, formID)
	if err != nil {
		log.Printf("[GetForm] Database error for ID %s: %v", formID, err)
		return nil, status.Errorf(codes.NotFound, "form not found")
	}

	log.Printf("[GetForm] Form found - ID: %s, Title: %s, UserID: %s", form.ID, form.Title, form.UserID)

	var questions []sqlc.FormQuestion
	if req.IncludeQuestions {
		questions, err = s.db.Queries.ListFormQuestions(ctx, formID)
		if err != nil {
			log.Printf("[GetForm] Failed to load questions: %v", err)
			return nil, status.Errorf(codes.Internal, "failed to load questions: %v", err)
		}
		log.Printf("[GetForm] Loaded %d questions", len(questions))
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
		ForceCaptcha:             currentForm.ForceCaptcha,
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
		if *req.Theme != pb.FormTheme_FORM_THEME_UNSPECIFIED {
			params.Theme = mapThemeToDB(*req.Theme)
		} else {
			log.Printf("[UpdateForm] Warning: Received UNSPECIFIED theme for form %s, ignoring update", formID)
		}
	}
	if req.IsPublished != nil {
		params.IsPublished = *req.IsPublished
	}
	if req.ForceCaptcha != nil {
		params.ForceCaptcha = *req.ForceCaptcha
	}
	if req.IsAcceptingResponses != nil {
		params.IsAcceptingResponses = *req.IsAcceptingResponses
	}
	if req.RequireLogin != nil {
		params.RequireLogin = *req.RequireLogin
	}
	if req.AllowMultipleSubmissions != nil {
		params.AllowMultipleSubmissions = *req.AllowMultipleSubmissions
	}
	if req.ShowProgressBar != nil {
		params.ShowProgressBar = *req.ShowProgressBar
	}
	if req.CustomThankYouMessage != nil {
		params.CustomThankYouMessage = *req.CustomThankYouMessage
	}
	if req.RedirectUrl != nil {
		params.RedirectUrl = *req.RedirectUrl
	}
	if req.Settings != nil {
		if jsonBytes, err := json.Marshal(req.Settings.AsMap()); err == nil {
			params.Settings = jsonBytes
		}
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

	log.Printf("[DeleteForm] User %s attempting to delete form %s", user.Email, formID)

	err = s.db.Queries.DeleteForm(ctx, sqlc.DeleteFormParams{
		ID:     formID,
		UserID: user.ID,
	})
	if err != nil {
		log.Printf("[DeleteForm] Failed to delete form: %v", err)
		return nil, status.Errorf(codes.NotFound, "form not found or unauthorized")
	}

	log.Printf("[DeleteForm] Successfully deleted form %s", formID)
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

	// Extract filter and sort parameters with defaults
	statusFilter := int32(0) // Default: all forms
	if req.StatusFilter != nil {
		statusFilter = int32(*req.StatusFilter)
	}

	searchQuery := ""
	if req.SearchQuery != nil {
		searchQuery = *req.SearchQuery
	}

	sortBy := pb.FormSortBy_FORM_SORT_BY_UPDATED_AT // Default
	if req.SortBy != nil {
		sortBy = *req.SortBy
	}

	sortOrder := pb.FormSortOrder_FORM_SORT_ORDER_DESC // Default
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	// Map sort enums to string values
	sortByStr := "updated_at"
	switch sortBy {
	case pb.FormSortBy_FORM_SORT_BY_TITLE:
		sortByStr = "title"
	case pb.FormSortBy_FORM_SORT_BY_CREATED_AT:
		sortByStr = "created_at"
	case pb.FormSortBy_FORM_SORT_BY_RESPONSE_COUNT:
		sortByStr = "response_count"
	}

	sortOrderStr := "desc"
	if sortOrder == pb.FormSortOrder_FORM_SORT_ORDER_ASC {
		sortOrderStr = "asc"
	}

	forms, err := s.db.Queries.ListUserForms(ctx, sqlc.ListUserFormsParams{
		UserID:       user.ID,
		LimitCount:   limit,
		OffsetCount:  offset,
		StatusFilter: statusFilter,
		SearchQuery:  searchQuery,
		SortBy:       sortByStr,
		SortOrder:    sortOrderStr,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list forms: %v", err)
	}

	var pbForms []*pb.Form
	for _, f := range forms {
		// Convert ListUserFormsRow to FormForm manually or just use common fields
		// We need to fetch questions separately anyway
		questions, _ := s.db.Queries.ListFormQuestions(ctx, f.ID)
		
		// Construct FormForm for conversion helper
		formForm := sqlc.FormForm{
			ID:                       f.ID,
			UserID:                   f.UserID,
			Title:                    f.Title,
			Description:              f.Description,
			Slug:                     f.Slug,
			Theme:                    f.Theme,
			IsPublished:              f.IsPublished,
			IsAcceptingResponses:     f.IsAcceptingResponses,
			RequireLogin:             f.RequireLogin,
			AllowMultipleSubmissions: f.AllowMultipleSubmissions,
			ShowProgressBar:          f.ShowProgressBar,
			CustomThankYouMessage:    f.CustomThankYouMessage,
			RedirectUrl:              f.RedirectUrl,
			ForceCaptcha:             f.ForceCaptcha,
			Settings:                 f.Settings,
			CreatedAt:                f.CreatedAt,
			UpdatedAt:                f.UpdatedAt,
		}

		pbF, _ := s.convertFormWithQuestions(formForm, questions)
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

	// Check if file_upload question type - Enterprise only
	if req.Type == pb.QuestionType_QUESTION_TYPE_FILE_UPLOAD {
		claims, err := auth.GetUserClaims(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user claims: %v", err)
		}

		if claims.CustomerType != "enterprise" {
			return nil, status.Errorf(codes.PermissionDenied,
				"file upload questions are only available for Enterprise customers")
		}
	}

	// Validate question type - reject UNSPECIFIED
	typeStr := req.Type.String()
	log.Printf("[CreateQuestion] Question type raw: %s", typeStr)
	if req.Type == pb.QuestionType_QUESTION_TYPE_UNSPECIFIED {
		return nil, status.Errorf(codes.InvalidArgument, "question type cannot be unspecified")
	}

	// Convert proto enum to database string format
	questionType := mapQuestionTypeToDB(req.Type)
	log.Printf("[CreateQuestion] Converted question type: %s", questionType)

	description := ""
	if req.Description != "" {
		description = req.Description
	}
	placeholder := ""
	if req.Placeholder != "" {
		placeholder = req.Placeholder
	}

	// Marshal options and validation rules from protobuf Struct to JSONB
	optionsJSON := []byte("{}")
	if req.Options != nil {
		if jsonBytes, err := json.Marshal(req.Options.AsMap()); err == nil {
			optionsJSON = jsonBytes
		}
	}

	validationRulesJSON := []byte("{}")
	if req.ValidationRules != nil {
		if jsonBytes, err := json.Marshal(req.ValidationRules.AsMap()); err == nil {
			validationRulesJSON = jsonBytes
		}
	}

	question, err := s.db.Queries.CreateQuestion(ctx, sqlc.CreateQuestionParams{
		FormID:         formID,
		Type:           questionType,
		Label:          req.Label,
		Description:    description,
		Placeholder:    placeholder,
		Required:       req.Required,
		OrderIndex:     req.OrderIndex,
		Options:        optionsJSON,
		ValidationRules: validationRulesJSON,
		Settings:       []byte("{}"),
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
		Options:     req.Options,
		ValidationRules: req.ValidationRules,
		Settings:    &structpb.Struct{},
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
		log.Printf("[UpdateQuestion] req.Type = %d (QUESTION_TYPE_UNSPECIFIED = %d)", *req.Type, pb.QuestionType_QUESTION_TYPE_UNSPECIFIED)
		if *req.Type != pb.QuestionType_QUESTION_TYPE_UNSPECIFIED {
			mappedType := mapQuestionTypeToDB(*req.Type)
			log.Printf("[UpdateQuestion] Mapped type: '%s'", mappedType)
			if mappedType == "" {
				log.Printf("[UpdateQuestion] WARNING: mapQuestionTypeToDB returned empty string for enum value %d, keeping existing type", *req.Type)
				// Keep the existing type by setting params.Type to empty string
				// The SQL query uses COALESCE(NULLIF(@type::text, ''), type) which will fall back to the existing value
				params.Type = ""
			} else {
				params.Type = mappedType
			}
		} else {
			log.Printf("[UpdateQuestion] Type is UNSPECIFIED, keeping existing type: '%s'", params.Type)
			params.Type = ""
		}
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
		// Convert protobuf Struct directly to JSON for JSONB storage
		if jsonBytes, err := json.Marshal(req.Options.AsMap()); err == nil {
			params.Options = jsonBytes
		}
	}
	if req.ValidationRules != nil {
		// Convert protobuf Struct directly to JSON for JSONB storage
		if jsonBytes, err := json.Marshal(req.ValidationRules.AsMap()); err == nil {
			params.ValidationRules = jsonBytes
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
		var optsMap map[string]any
		if err := json.Unmarshal(q.Options, &optsMap); err == nil {
			if opts, err := structpb.NewStruct(optsMap); err == nil {
				pbQ.Options = opts
			}
		}
	}
	if len(q.ValidationRules) > 0 {
		var rulesMap map[string]any
		if err := json.Unmarshal(q.ValidationRules, &rulesMap); err == nil {
			if rules, err := structpb.NewStruct(rulesMap); err == nil {
				pbQ.ValidationRules = rules
			}
		}
	}
	if len(q.Settings) > 0 {
		var setMap map[string]any
		if err := json.Unmarshal(q.Settings, &setMap); err == nil {
			if set, err := structpb.NewStruct(setMap); err == nil {
				pbQ.Settings = set
			}
		}
	}

	return pbQ
}

// Helper to map QuestionType enum to DB string
func mapQuestionTypeToDB(qt pb.QuestionType) string {
	switch qt {
	case pb.QuestionType_QUESTION_TYPE_SHORT_TEXT:
		return "short_text"
	case pb.QuestionType_QUESTION_TYPE_LONG_TEXT:
		return "long_text"
	case pb.QuestionType_QUESTION_TYPE_DROPDOWN:
		return "dropdown"
	case pb.QuestionType_QUESTION_TYPE_CHECKBOXES:
		return "checkboxes"
	case pb.QuestionType_QUESTION_TYPE_EMAIL:
		return "email"
	case pb.QuestionType_QUESTION_TYPE_PHONE:
		return "phone"
	case pb.QuestionType_QUESTION_TYPE_NUMBER:
		return "number"
	case pb.QuestionType_QUESTION_TYPE_DATE:
		return "date"
	case pb.QuestionType_QUESTION_TYPE_RATING:
		return "rating"
	case pb.QuestionType_QUESTION_TYPE_OPINION_SCALE:
		return "opinion_scale"
	case pb.QuestionType_QUESTION_TYPE_YES_NO:
		return "yes_no"
	case pb.QuestionType_QUESTION_TYPE_FILE_UPLOAD:
		return "file_upload"
	case pb.QuestionType_QUESTION_TYPE_URL:
		return "url"
	default:
		return ""
	}
}

// Helper to map FormTheme enum to DB string
func mapThemeToDB(theme pb.FormTheme) string {
	switch theme {
	case pb.FormTheme_FORM_THEME_MINIMAL:
		return "minimal"
	case pb.FormTheme_FORM_THEME_MIDNIGHT:
		return "midnight"
	case pb.FormTheme_FORM_THEME_OCEAN:
		return "ocean"
	case pb.FormTheme_FORM_THEME_SUNSET:
		return "sunset"
	case pb.FormTheme_FORM_THEME_FOREST:
		return "forest"
	case pb.FormTheme_FORM_THEME_LAVENDER:
		return "lavender"
	case pb.FormTheme_FORM_THEME_WELADEE:
		return "weladee"
	case pb.FormTheme_FORM_THEME_AURORA:
		return "aurora"
	case pb.FormTheme_FORM_THEME_CYBERPUNK:
		return "cyberpunk"
	case pb.FormTheme_FORM_THEME_DESERT:
		return "desert"
	default:
		return "minimal"
	}
}