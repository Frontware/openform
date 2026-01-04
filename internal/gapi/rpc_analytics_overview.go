package gapi

import (
    "context"
    "fmt"
    "time"

    "github.com/google/uuid"
    "github.com/jackc/pgx/v5/pgtype"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServerImpl) GetOverviewStats(
    ctx context.Context,
    req *pb.GetOverviewStatsRequest,
) (*pb.GetOverviewStatsResponse, error) {
    // Get user from context
    claims, err := auth.GetUserClaims(ctx)
    if err != nil {
        return nil, status.Errorf(codes.Unauthenticated, "not authenticated")
    }

    // Parse form ID
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

    // Get current period stats
    stats, err := server.db.Queries.GetFormOverviewStats(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get stats: %v", err)
    }

    // Calculate comparison period based on time range
    var previousPeriodStart, previousPeriodEnd time.Time
    var currentPeriodStart time.Time

    switch req.TimeRange {
    case "7d":
        currentPeriodStart = time.Now().AddDate(0, 0, -7)
        previousPeriodStart = time.Now().AddDate(0, 0, -14)
        previousPeriodEnd = time.Now().AddDate(0, 0, -7)
    case "30d":
        currentPeriodStart = time.Now().AddDate(0, 0, -30)
        previousPeriodStart = time.Now().AddDate(0, 0, -60)
        previousPeriodEnd = time.Now().AddDate(0, 0, -30)
    case "90d":
        currentPeriodStart = time.Now().AddDate(0, 0, -90)
        previousPeriodStart = time.Now().AddDate(0, 0, -180)
        previousPeriodEnd = time.Now().AddDate(0, 0, -90)
    default:
        // All time - no comparison
        return &pb.GetOverviewStatsResponse{
            Stats: &pb.OverviewStats{
                TotalViews:              int64(stats.ViewCount.Int32),
                TotalResponses:          int64(stats.ResponseCount.Int32),
                CompletionCount:         int64(stats.CompletionCount.Int32),
                CompletionRate:          float64(stats.CompletionRate),
                AvgCompletionTimeSeconds: int32(stats.AvgCompletionTime),
            },
        }, nil
    }

    // Get previous period stats for comparison
    previousStats, err := server.getPeriodStats(ctx, formID, previousPeriodStart, previousPeriodEnd)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get previous stats: %v", err)
    }

    currentStats, err := server.getPeriodStats(ctx, formID, currentPeriodStart, time.Now())
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get current stats: %v", err)
    }

    // Calculate changes
    viewsChange := calculatePercentageChange(previousStats.Views, currentStats.Views)
    responsesChange := calculatePercentageChange(previousStats.Responses, currentStats.Responses)
    completionRateChange := calculateFloatPercentageChange(previousStats.CompletionRate, currentStats.CompletionRate)
    avgTimeChange := calculateTimeChange(previousStats.AvgTime, currentStats.AvgTime)

    return &pb.GetOverviewStatsResponse{
        Stats: &pb.OverviewStats{
            TotalViews:              currentStats.Views,
            TotalResponses:          currentStats.Responses,
            CompletionCount:         currentStats.Completions,
            CompletionRate:          currentStats.CompletionRate,
            AvgCompletionTimeSeconds: int32(currentStats.AvgTime),
            ViewsChange:             viewsChange,
            ResponsesChange:         responsesChange,
            CompletionRateChange:    completionRateChange,
            AvgTimeChange:           avgTimeChange,
        },
    }, nil
}

type PeriodStats struct {
    Views          int64
    Responses      int64
    Completions    int64
    CompletionRate float64
    AvgTime        int64
}

func (server *AnalyticsServerImpl) getPeriodStats(
    ctx context.Context,
    formID uuid.UUID,
    startDate, endDate time.Time,
) (*PeriodStats, error) {
    dailyStats, err := server.db.Queries.GetDailyStatsRange(ctx, sqlc.GetDailyStatsRangeParams{
        FormID:    formID,
        StartDate: pgtype.Date{Time: startDate, Valid: true},
        EndDate:   pgtype.Date{Time: endDate, Valid: true},
    })
    if err != nil {
        return nil, err
    }

    var totalViews, totalStarts, totalCompletions int64
    var totalTime int64
    var timeCount int64

    for _, stat := range dailyStats {
        totalViews += int64(stat.TotalViews.Int32)
        totalStarts += int64(stat.TotalStarts.Int32)
        totalCompletions += int64(stat.TotalCompletions.Int32)
        if stat.AvgCompletionTimeSeconds.Valid {
            totalTime += int64(stat.AvgCompletionTimeSeconds.Int32)
            timeCount++
        }
    }

    avgTime := int64(0)
    if timeCount > 0 {
        avgTime = totalTime / timeCount
    }

    completionRate := 0.0
    if totalViews > 0 {
        completionRate = float64(totalCompletions) / float64(totalViews) * 100
    }

    return &PeriodStats{
        Views:          totalViews,
        Responses:      totalStarts,
        Completions:    totalCompletions,
        CompletionRate: completionRate,
        AvgTime:        avgTime,
    }, nil
}

func calculatePercentageChange(previous, current int64) string {
    if previous == 0 {
        if current > 0 {
            return "+100%"
        }
        return "0%"
    }

    change := float64(current-previous) / float64(previous) * 100
    if change > 0 {
        return fmt.Sprintf("+%.1f%%", change)
    } else if change < 0 {
        return fmt.Sprintf("%.1f%%", change)
    }
    return "0%"
}

func calculateFloatPercentageChange(previous, current float64) string {
    if previous == 0 {
        if current > 0 {
            return "+100%"
        }
        return "0%"
    }

    change := (current - previous) / previous * 100
    if change > 0 {
        return fmt.Sprintf("+%.1f%%", change)
    } else if change < 0 {
        return fmt.Sprintf("%.1f%%", change)
    }
    return "0%"
}

func calculateTimeChange(previous, current int64) string {
    diff := current - previous
    if diff == 0 {
        return "0s"
    } else if diff > 0 {
        return fmt.Sprintf("+%ds", diff)
    }
    return fmt.Sprintf("%ds", diff)
}