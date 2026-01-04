package gapi

import (
    "context"
    "log"
    "net"

    "github.com/google/uuid"
    "github.com/mssola/user_agent"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServerImpl) TrackView(
    ctx context.Context,
    req *pb.TrackViewRequest,
) (*pb.TrackViewResponse, error) {
    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    // Parse user agent
    ua := user_agent.New(req.UserAgent)
    deviceType := "desktop"
    if ua.Mobile() {
        deviceType = "mobile"
    }

    browser, _ := ua.Browser()
    osInfo := ua.OS()

    // Parse IP address
    var ipAddr net.IP
    if req.IpAddress != "" {
        ipAddr = net.ParseIP(req.IpAddress)
    }

    // Track view
    _, err = server.db.Queries.TrackFormView(ctx, sqlc.TrackFormViewParams{
        FormID:     formID,
        SessionID:  req.SessionId,
        IpAddress:  ipAddr,
        UserAgent:  req.UserAgent,
        Referrer:   req.Referrer,
        DeviceType: deviceType,
        Browser:    browser,
        Os:         osInfo,
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to track view: %v", err)
    }

    // Increment form view count
    err = server.db.Queries.IncrementFormViewCount(ctx, formID)
    if err != nil {
        // Log but don't fail
        log.Printf("Failed to increment view count: %v", err)
    }

    return &pb.TrackViewResponse{Success: true}, nil
}

func (server *AnalyticsServerImpl) TrackResponseStart(
    ctx context.Context,
    req *pb.TrackResponseStartRequest,
) (*pb.TrackResponseStartResponse, error) {
    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    _, err = server.db.Queries.TrackResponseStart(ctx, sqlc.TrackResponseStartParams{
        FormID:    formID,
        SessionID: req.SessionId,
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to track start: %v", err)
    }

    return &pb.TrackResponseStartResponse{Success: true}, nil
}

func (server *AnalyticsServerImpl) ExportAnalytics(
    ctx context.Context,
    req *pb.ExportAnalyticsRequest,
) (*pb.ExportAnalyticsResponse, error) {
    // This is a placeholder for the export analytics RPC
    // Real implementation would involve generating CSV/PDF/XLSX
    return nil, status.Errorf(codes.Unimplemented, "ExportAnalytics not yet implemented")
}

func (server *AnalyticsServerImpl) GetGeographicDistribution(
    ctx context.Context,
    req *pb.GetGeographicDistributionRequest,
) (*pb.GetGeographicDistributionResponse, error) {
    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    geoData, err := server.db.Queries.GetGeographicDistribution(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get geographic distribution: %v", err)
    }

    var countries []*pb.GeographicStats
    countryMap := make(map[string]*pb.GeographicStats)

    for _, d := range geoData {
        if !d.Country.Valid {
            continue
        }
        country := d.Country.String
        if _, ok := countryMap[country]; !ok {
            countryMap[country] = &pb.GeographicStats{
                Country: country,
            }
            countries = append(countries, countryMap[country])
        }
        
        countryMap[country].Count += d.Count
        if d.City.Valid {
            countryMap[country].Cities = append(countryMap[country].Cities, &pb.CityStats{
                City:  d.City.String,
                Count: d.Count,
            })
        }
    }

    return &pb.GetGeographicDistributionResponse{
        Countries: countries,
    }, nil
}

func (server *AnalyticsServerImpl) GetTimeDistribution(
    ctx context.Context,
    req *pb.GetTimeDistributionRequest,
) (*pb.GetTimeDistributionResponse, error) {
    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    hourly, err := server.db.Queries.GetHourlyDistribution(ctx, sqlc.GetHourlyDistributionParams{
        FormID:    formID,
        StartDate: req.StartDate.AsTime(),
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get hourly distribution: %v", err)
    }

    daily, err := server.db.Queries.GetDayOfWeekDistribution(ctx, sqlc.GetDayOfWeekDistributionParams{
        FormID:    formID,
        StartDate: req.StartDate.AsTime(),
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get daily distribution: %v", err)
    }

    var hourlyStats []*pb.HourlyStats
    for _, h := range hourly {
        hourlyStats = append(hourlyStats, &pb.HourlyStats{
            Hour:  h.Hour,
            Count: h.Count,
        })
    }

    dayNames := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
    var dailyStats []*pb.DayOfWeekStats
    for _, d := range daily {
        dailyStats = append(dailyStats, &pb.DayOfWeekStats{
            Day:     d.DayOfWeek,
            DayName: dayNames[int(d.DayOfWeek)%7],
            Count:   d.Count,
        })
    }

    return &pb.GetTimeDistributionResponse{
        Hourly: hourlyStats,
        Daily:  dailyStats,
    }, nil
}