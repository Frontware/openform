package gapi

import (
    "context"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/weladee/weladee-form/internal/auth"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServerImpl) GetQuestionAnalytics(
    ctx context.Context,
    req *pb.GetQuestionAnalyticsRequest,
) (*pb.GetQuestionAnalyticsResponse, error) {
    claims, err := auth.GetUserClaims(ctx)
    if err != nil {
        return nil, status.Errorf(codes.Unauthenticated, "not authenticated")
    }

    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    // Verify ownership
    form, err := server.db.Queries.GetForm(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "form not found")
    }

    // Get internal user ID from Weladee user ID
    user, err := server.db.Queries.GetFormUserByWeladeeID(ctx, int32(claims.UserID))
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "user not found")
    }

    if form.UserID != user.ID {
        return nil, status.Errorf(codes.PermissionDenied, "not authorized")
    }

    // Get questions
    questions, err := server.db.Queries.ListFormQuestions(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get questions: %v", err)
    }

    var analytics []*pb.QuestionAnalytics

    for _, q := range questions {
        questionID := q.ID

        // Skip if specific question requested and this isn't it
        if req.QuestionId != nil && *req.QuestionId != questionID.String() {
            continue
        }

        qa := &pb.QuestionAnalytics{
            QuestionId:    questionID.String(),
            QuestionType:  q.Type,
            QuestionLabel: q.Label,
        }

        switch q.Type {
        case "single_choice", "multiple_choice", "dropdown":
            // Get choice statistics
            choiceStats, err := server.db.Queries.GetChoiceQuestionStats(ctx, questionID)
            if err == nil {
                for _, cs := range choiceStats {
                    qa.ChoiceStats = append(qa.ChoiceStats, &pb.ChoiceStats{
                        Choice:     cs.Choice.String,
                        Count:      cs.Count,
                        Percentage: cs.Percentage,
                    })
                }
                var total int64
                for _, cs := range choiceStats {
                    total += cs.Count
                }
                qa.ResponseCount = total
            }

        case "rating":
            // Get rating statistics
            ratingStats, err := server.db.Queries.GetRatingQuestionStats(ctx, questionID)
            if err == nil {
                for _, rs := range ratingStats {
                    flt, _ := rs.Rating.Float64Value()
                    qa.RatingStats = append(qa.RatingStats, &pb.RatingStats{
                        Rating:     int32(flt.Float64),
                        Count:      rs.Count,
                        Percentage: rs.Percentage,
                    })
                }
                var total int64
                for _, rs := range ratingStats {
                    total += rs.Count
                }
                qa.ResponseCount = total
            }

            // Check if it's an NPS question (0-10 scale)
            nps, err := server.db.Queries.GetNPSScore(ctx, questionID)
            if err == nil && nps.TotalResponses > 0 {
                qa.NpsStats = &pb.NPSStats{
                    Detractors: nps.Detractors,
                    Passives:   nps.Passives,
                    Promoters:  nps.Promoters,
                    NpsScore:   nps.NpsScore,
                }
            }
        }

        analytics = append(analytics, qa)
    }

    return &pb.GetQuestionAnalyticsResponse{
        Questions: analytics,
    }, nil
}

func (server *AnalyticsServerImpl) GetQuestionDropOff(
    ctx context.Context,
    req *pb.GetQuestionDropOffRequest,
) (*pb.GetQuestionDropOffResponse, error) {
    claims, err := auth.GetUserClaims(ctx)
    if err != nil {
        return nil, status.Errorf(codes.Unauthenticated, "not authenticated")
    }

    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    // Verify ownership
    form, err := server.db.Queries.GetForm(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "form not found")
    }

    // Get internal user ID from Weladee user ID
    user, err := server.db.Queries.GetFormUserByWeladeeID(ctx, int32(claims.UserID))
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "user not found")
    }

    if form.UserID != user.ID {
        return nil, status.Errorf(codes.PermissionDenied, "not authorized")
    }

    // Get drop-off data
    dropOffs, err := server.db.Queries.GetQuestionDropOff(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get drop-off data: %v", err)
    }

    var questionDropOffs []*pb.QuestionDropOff
    for _, d := range dropOffs {
        answerRate := 0.0
        if d.ViewedCount > 0 {
            answerRate = float64(d.AnsweredCount) / float64(d.ViewedCount) * 100
        }

        questionDropOffs = append(questionDropOffs, &pb.QuestionDropOff{
            QuestionId:           d.ID.String(),
            QuestionLabel:        d.Label,
            OrderIndex:           d.OrderIndex,
            ViewedCount:          d.ViewedCount,
            AnsweredCount:        d.AnsweredCount,
            AbandonedCount:       d.AbandonedCount,
            AnswerRate:           answerRate,
            AvgTimeSpentSeconds: int32(d.AvgTimeSpent),
        })
    }

    return &pb.GetQuestionDropOffResponse{
        Questions: questionDropOffs,
    }, nil
}