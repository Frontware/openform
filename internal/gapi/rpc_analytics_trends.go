package gapi

import (
    "context"
    "time"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServerImpl) GetResponseTrend(
    ctx context.Context,
    req *pb.GetResponseTrendRequest,
) (*pb.GetResponseTrendResponse, error) {
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

    // Get view trends
    viewTrends, err := server.db.Queries.GetResponseTrend(ctx, sqlc.GetResponseTrendParams{
        FormID:    formID,
        StartDate: req.StartDate.AsTime(),
        EndDate:   req.EndDate.AsTime(),
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get view trends: %v", err)
    }

    // Get completion trends
    completionTrends, err := server.db.Queries.GetResponseCompletionTrend(ctx, sqlc.GetResponseCompletionTrendParams{
        FormID:    formID,
        StartDate: req.StartDate.AsTime(),
        EndDate:   req.EndDate.AsTime(),
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get completion trends: %v", err)
    }

    // Merge data by date
    dataMap := make(map[string]*pb.ResponseTrendPoint)
    
    for _, vt := range viewTrends {
        dateStr := vt.Date.Time.Format("2006-01-02")
        dataMap[dateStr] = &pb.ResponseTrendPoint{
            Date:  dateStr,
            Views: vt.TotalViews,
        }
    }

    for _, ct := range completionTrends {
        dateStr := ct.Date.Time.Format("2006-01-02")
        if point, exists := dataMap[dateStr]; exists {
            point.Completions = ct.Completions
        } else {
            dataMap[dateStr] = &pb.ResponseTrendPoint{
                Date:        dateStr,
                Completions: ct.Completions,
            }
        }
    }

    // Convert map to slice
    var dataPoints []*pb.ResponseTrendPoint
    for _, point := range dataMap {
        dataPoints = append(dataPoints, point)
    }

    return &pb.GetResponseTrendResponse{
        DataPoints: dataPoints,
    }, nil
}

func (server *AnalyticsServerImpl) GetDeviceBreakdown(
    ctx context.Context,
    req *pb.GetDeviceBreakdownRequest,
) (*pb.GetDeviceBreakdownResponse, error) {
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

    // Get device breakdown
    devices, err := server.db.Queries.GetDeviceBreakdown(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get device breakdown: %v", err)
    }

    var deviceStats []*pb.DeviceStats
    for _, d := range devices {
        deviceStats = append(deviceStats, &pb.DeviceStats{
            DeviceType: d.DeviceType.String,
            Count:      d.Count,
            Percentage: d.Percentage,
        })
    }

    return &pb.GetDeviceBreakdownResponse{
        Devices: deviceStats,
    }, nil
}

func (server *AnalyticsServerImpl) GetCompletionFunnel(
    ctx context.Context,
    req *pb.GetCompletionFunnelRequest,
) (*pb.GetCompletionFunnelResponse, error) {
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

    // Handle date filtering - default to all time if not provided
    startDate := time.Now().AddDate(-50, 0, 0) // ~50 years ago for "all time"
    endDate := time.Now()

    if req.StartDate != nil {
        startDate = req.StartDate.AsTime()
    }
    if req.EndDate != nil {
        endDate = req.EndDate.AsTime()
    }

    // Get funnel data with date filtering
    funnelData, err := server.db.Queries.GetCompletionFunnel(ctx, sqlc.GetCompletionFunnelParams{
        FormID:    formID,
        StartDate: startDate,
        EndDate:   endDate,
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get funnel data: %v", err)
    }

    // Calculate percentages
    totalViews := float64(funnelData.TotalViews)
    if totalViews == 0 {
        totalViews = 1 // Avoid division by zero
    }

    stages := []*pb.CompletionFunnel_Stage{
        {
            Name:       "Viewed Form",
            Count:      funnelData.TotalViews,
            Percentage: 100.0,
        },
        {
            Name:       "Started",
            Count:      funnelData.TotalStarts,
            Percentage: float64(funnelData.TotalStarts) / totalViews * 100,
        },
        {
            Name:       "Responded",
            Count:      funnelData.TotalResponses,
            Percentage: float64(funnelData.TotalResponses) / totalViews * 100,
        },
        {
            Name:       "Completed",
            Count:      funnelData.TotalCompletions,
            Percentage: float64(funnelData.TotalCompletions) / totalViews * 100,
        },
    }

    overallCompletionRate := float64(funnelData.TotalCompletions) / totalViews * 100

    return &pb.GetCompletionFunnelResponse{
        Funnel: &pb.CompletionFunnel{
            Stages:                 stages,
            OverallCompletionRate: overallCompletionRate,
        },
    }, nil
}