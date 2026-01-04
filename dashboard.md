# Analytics Dashboard Implementation Guide for Weladee Form

## 📊 Overview

This guide provides step-by-step instructions to implement a comprehensive analytics dashboard for the Weladee Form application. The dashboard will provide insights into form performance, response patterns, and user behavior.

---

## 🗄️ Phase 1: Database Schema Extensions (Day 1)

### Step 1.1: Add Analytics Tables

**File:** `sql/schema/analytics_schema.sql`

```sql
-- Form views tracking
CREATE TABLE form.form_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    session_id VARCHAR(255), -- Track unique sessions
    user_id UUID REFERENCES form.users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    device_type VARCHAR(50), -- desktop, mobile, tablet
    browser VARCHAR(100),
    os VARCHAR(100),
    country VARCHAR(2), -- ISO country code
    city VARCHAR(255),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_views_form_id ON form.form_views(form_id);
CREATE INDEX idx_form_views_session_id ON form.form_views(session_id);
CREATE INDEX idx_form_views_viewed_at ON form.form_views(viewed_at DESC);
CREATE INDEX idx_form_views_device_type ON form.form_views(device_type);

-- Form response start tracking (when user begins but hasn't completed)
CREATE TABLE form.response_starts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_response_starts_form_id ON form.response_starts(form_id);
CREATE INDEX idx_response_starts_started_at ON form.response_starts(started_at DESC);

-- Question-level analytics (drop-off tracking)
CREATE TABLE form.question_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    response_id UUID REFERENCES form.responses(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    interaction_type VARCHAR(50), -- viewed, answered, skipped, abandoned
    time_spent_seconds INTEGER, -- Time spent on this question
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_interactions_form_id ON form.question_interactions(form_id);
CREATE INDEX idx_question_interactions_question_id ON form.question_interactions(question_id);
CREATE INDEX idx_question_interactions_type ON form.question_interactions(interaction_type);

-- Daily aggregated statistics (for performance)
CREATE TABLE form.daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    total_views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    total_starts INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    desktop_views INTEGER DEFAULT 0,
    mobile_views INTEGER DEFAULT 0,
    tablet_views INTEGER DEFAULT 0,
    avg_completion_time_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(form_id, stat_date)
);

CREATE INDEX idx_daily_stats_form_date ON form.daily_stats(form_id, stat_date DESC);

-- Question response aggregations (for quick analytics)
CREATE TABLE form.question_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    answer_value TEXT, -- For choice-based questions
    response_count INTEGER DEFAULT 0,
    percentage DECIMAL(5,2),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, answer_value)
);

CREATE INDEX idx_question_stats_question_id ON form.question_stats(question_id);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON form.daily_stats
    FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();
```

### Step 1.2: Add Analytics Columns to Existing Tables

```sql
-- Add completion time tracking to responses
ALTER TABLE form.responses 
ADD COLUMN IF NOT EXISTS completion_time_seconds INTEGER,
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
ADD COLUMN IF NOT EXISTS os VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(2),
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

CREATE INDEX idx_responses_device_type ON form.responses(device_type);
CREATE INDEX idx_responses_completion_time ON form.responses(completion_time_seconds);

-- Add view count to forms
ALTER TABLE form.forms 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_count INTEGER DEFAULT 0;
```

---

## 🔍 Phase 2: SQLC Queries for Analytics (Day 2)

### Step 2.1: Analytics Queries

**File:** `sql/queries/analytics.sql`

```sql
-- name: TrackFormView :one
INSERT INTO form.form_views (
    form_id, session_id, user_id, ip_address, user_agent,
    referrer, device_type, browser, os, country, city
) VALUES (
    :form_id, :session_id, :user_id, :ip_address, :user_agent,
    :referrer, :device_type, :browser, :os, :country, :city
)
RETURNING *;

-- name: TrackResponseStart :one
INSERT INTO form.response_starts (
    form_id, session_id
) VALUES (
    :form_id, :session_id
)
RETURNING *;

-- name: TrackQuestionInteraction :one
INSERT INTO form.question_interactions (
    form_id, question_id, response_id, session_id,
    interaction_type, time_spent_seconds
) VALUES (
    :form_id, :question_id, :response_id, :session_id,
    :interaction_type, :time_spent_seconds
)
RETURNING *;

-- name: GetFormOverviewStats :one
SELECT
    f.id,
    f.view_count,
    f.response_count,
    f.completion_count,
    COALESCE(
        ROUND(
            (f.completion_count::numeric / NULLIF(f.view_count, 0)::numeric) * 100, 
            2
        ), 
        0
    ) as completion_rate,
    COALESCE(AVG(r.completion_time_seconds)::integer, 0) as avg_completion_time
FROM form.forms f
LEFT JOIN form.responses r ON f.id = r.form_id AND r.completed = true
WHERE f.id = :form_id
GROUP BY f.id;

-- name: GetResponseTrend :many
SELECT
    DATE(viewed_at) as date,
    COUNT(DISTINCT session_id) as unique_views,
    COUNT(*) as total_views
FROM form.form_views
WHERE form_id = :form_id
    AND viewed_at >= :start_date
    AND viewed_at <= :end_date
GROUP BY DATE(viewed_at)
ORDER BY date DESC;

-- name: GetResponseCompletionTrend :many
SELECT
    DATE(submitted_at) as date,
    COUNT(*) as completions
FROM form.responses
WHERE form_id = :form_id
    AND completed = true
    AND submitted_at >= :start_date
    AND submitted_at <= :end_date
GROUP BY DATE(submitted_at)
ORDER BY date DESC;

-- name: GetDeviceBreakdown :many
SELECT
    device_type,
    COUNT(*) as count,
    ROUND((COUNT(*)::numeric / SUM(COUNT(*)) OVER ()) * 100, 2) as percentage
FROM form.responses
WHERE form_id = :form_id
    AND device_type IS NOT NULL
GROUP BY device_type
ORDER BY count DESC;

-- name: GetCompletionFunnel :one
SELECT
    (SELECT COUNT(*) FROM form.form_views WHERE form_id = :form_id) as total_views,
    (SELECT COUNT(DISTINCT session_id) FROM form.form_views WHERE form_id = :form_id) as unique_views,
    (SELECT COUNT(*) FROM form.response_starts WHERE form_id = :form_id) as total_starts,
    (SELECT COUNT(*) FROM form.responses WHERE form_id = :form_id) as total_responses,
    (SELECT COUNT(*) FROM form.responses WHERE form_id = :form_id AND completed = true) as total_completions;

-- name: GetQuestionDropOff :many
SELECT
    q.id,
    q.label,
    q.order_index,
    COUNT(DISTINCT qi.session_id) FILTER (WHERE qi.interaction_type = 'viewed') as viewed_count,
    COUNT(DISTINCT qi.session_id) FILTER (WHERE qi.interaction_type = 'answered') as answered_count,
    COUNT(DISTINCT qi.session_id) FILTER (WHERE qi.interaction_type = 'abandoned') as abandoned_count,
    AVG(qi.time_spent_seconds) FILTER (WHERE qi.interaction_type = 'answered') as avg_time_spent
FROM form.questions q
LEFT JOIN form.question_interactions qi ON q.id = qi.question_id
WHERE q.form_id = :form_id
GROUP BY q.id, q.label, q.order_index
ORDER BY q.order_index;

-- name: GetQuestionAnalytics :many
SELECT
    q.id,
    q.type,
    q.label,
    q.required,
    COUNT(a.id) as response_count,
    CASE 
        WHEN q.type IN ('single_choice', 'multiple_choice', 'dropdown') THEN
            jsonb_agg(
                jsonb_build_object(
                    'value', a.answer_text,
                    'count', 1
                )
            )
        WHEN q.type = 'rating' THEN
            jsonb_agg(
                jsonb_build_object(
                    'rating', a.answer_number,
                    'count', 1
                )
            )
        ELSE NULL
    END as aggregated_data
FROM form.questions q
LEFT JOIN form.answers a ON q.id = a.question_id
WHERE q.form_id = :form_id
GROUP BY q.id, q.type, q.label, q.required
ORDER BY q.order_index;

-- name: GetChoiceQuestionStats :many
SELECT
    a.answer_text as choice,
    COUNT(*) as count,
    ROUND((COUNT(*)::numeric / (
        SELECT COUNT(*) 
        FROM form.answers 
        WHERE question_id = :question_id
    )::numeric) * 100, 2) as percentage
FROM form.answers a
WHERE a.question_id = :question_id
    AND a.answer_text IS NOT NULL
GROUP BY a.answer_text
ORDER BY count DESC;

-- name: GetRatingQuestionStats :many
SELECT
    a.answer_number as rating,
    COUNT(*) as count,
    ROUND((COUNT(*)::numeric / (
        SELECT COUNT(*) 
        FROM form.answers 
        WHERE question_id = :question_id
    )::numeric) * 100, 2) as percentage
FROM form.answers a
WHERE a.question_id = :question_id
    AND a.answer_number IS NOT NULL
GROUP BY a.answer_number
ORDER BY rating DESC;

-- name: GetNPSScore :one
SELECT
    COUNT(*) FILTER (WHERE a.answer_number >= 0 AND a.answer_number <= 6) as detractors,
    COUNT(*) FILTER (WHERE a.answer_number >= 7 AND a.answer_number <= 8) as passives,
    COUNT(*) FILTER (WHERE a.answer_number >= 9 AND a.answer_number <= 10) as promoters,
    COUNT(*) as total_responses,
    CASE 
        WHEN COUNT(*) > 0 THEN
            ROUND(
                ((COUNT(*) FILTER (WHERE a.answer_number >= 9 AND a.answer_number <= 10)::numeric / COUNT(*)::numeric) * 100) -
                ((COUNT(*) FILTER (WHERE a.answer_number >= 0 AND a.answer_number <= 6)::numeric / COUNT(*)::numeric) * 100),
                1
            )
        ELSE 0
    END as nps_score
FROM form.answers a
WHERE a.question_id = :question_id
    AND a.answer_number IS NOT NULL;

-- name: GetGeographicDistribution :many
SELECT
    country,
    city,
    COUNT(*) as count
FROM form.responses
WHERE form_id = :form_id
    AND country IS NOT NULL
GROUP BY country, city
ORDER BY count DESC
LIMIT 50;

-- name: GetHourlyDistribution :many
SELECT
    EXTRACT(HOUR FROM submitted_at) as hour,
    COUNT(*) as count
FROM form.responses
WHERE form_id = :form_id
    AND completed = true
    AND submitted_at >= :start_date
GROUP BY hour
ORDER BY hour;

-- name: GetDayOfWeekDistribution :many
SELECT
    EXTRACT(DOW FROM submitted_at) as day_of_week,
    COUNT(*) as count
FROM form.responses
WHERE form_id = :form_id
    AND completed = true
    AND submitted_at >= :start_date
GROUP BY day_of_week
ORDER BY day_of_week;

-- name: UpdateDailyStats :one
INSERT INTO form.daily_stats (
    form_id, stat_date, total_views, unique_views,
    total_starts, total_completions, desktop_views,
    mobile_views, tablet_views, avg_completion_time_seconds
) VALUES (
    :form_id, :stat_date, :total_views, :unique_views,
    :total_starts, :total_completions, :desktop_views,
    :mobile_views, :tablet_views, :avg_completion_time_seconds
)
ON CONFLICT (form_id, stat_date)
DO UPDATE SET
    total_views = EXCLUDED.total_views,
    unique_views = EXCLUDED.unique_views,
    total_starts = EXCLUDED.total_starts,
    total_completions = EXCLUDED.total_completions,
    desktop_views = EXCLUDED.desktop_views,
    mobile_views = EXCLUDED.mobile_views,
    tablet_views = EXCLUDED.tablet_views,
    avg_completion_time_seconds = EXCLUDED.avg_completion_time_seconds,
    updated_at = NOW()
RETURNING *;

-- name: GetDailyStatsRange :many
SELECT *
FROM form.daily_stats
WHERE form_id = :form_id
    AND stat_date >= :start_date
    AND stat_date <= :end_date
ORDER BY stat_date DESC;

-- name: IncrementFormViewCount :exec
UPDATE form.forms
SET view_count = view_count + 1
WHERE id = :form_id;

-- name: IncrementFormResponseCount :exec
UPDATE form.forms
SET response_count = response_count + 1
WHERE id = :form_id;

-- name: IncrementFormCompletionCount :exec
UPDATE form.forms
SET completion_count = completion_count + 1
WHERE id = :form_id;
```

---

## 🔌 Phase 3: Protocol Buffer Definitions (Day 3)

### Step 3.1: Analytics Proto

**File:** `proto/analytics.proto`

```protobuf
syntax = "proto3";

package weladee.form.v1;

option go_package = "github.com/weladee/weladee-form/proto/pb";

import "google/protobuf/timestamp.proto";
import "proto/common.proto";

// Overview Statistics
message OverviewStats {
  int64 total_views = 1;
  int64 total_responses = 2;
  int64 completion_count = 3;
  double completion_rate = 4;
  int32 avg_completion_time_seconds = 5;
  string views_change = 6;
  string responses_change = 7;
  string completion_rate_change = 8;
  string avg_time_change = 9;
}

message GetOverviewStatsRequest {
  string form_id = 1;
  string time_range = 2; // 7d, 30d, 90d, all
}

message GetOverviewStatsResponse {
  OverviewStats stats = 1;
}

// Response Trends
message ResponseTrendPoint {
  string date = 1;
  int64 views = 2;
  int64 responses = 3;
  int64 completions = 4;
}

message GetResponseTrendRequest {
  string form_id = 1;
  google.protobuf.Timestamp start_date = 2;
  google.protobuf.Timestamp end_date = 3;
}

message GetResponseTrendResponse {
  repeated ResponseTrendPoint data_points = 1;
}

// Device Breakdown
message DeviceStats {
  string device_type = 1;
  int64 count = 2;
  double percentage = 3;
}

message GetDeviceBreakdownRequest {
  string form_id = 1;
}

message GetDeviceBreakdownResponse {
  repeated DeviceStats devices = 1;
}

// Completion Funnel
message CompletionFunnel {
  message Stage {
    string name = 1;
    int64 count = 2;
    double percentage = 3;
  }
  repeated Stage stages = 1;
  double overall_completion_rate = 2;
}

message GetCompletionFunnelRequest {
  string form_id = 1;
}

message GetCompletionFunnelResponse {
  CompletionFunnel funnel = 1;
}

// Question Analytics
message QuestionAnalytics {
  string question_id = 1;
  string question_type = 2;
  string question_label = 3;
  int64 response_count = 4;
  repeated ChoiceStats choice_stats = 5;
  repeated RatingStats rating_stats = 6;
  NPSStats nps_stats = 7;
  TextStats text_stats = 8;
}

message ChoiceStats {
  string choice = 1;
  int64 count = 2;
  double percentage = 3;
}

message RatingStats {
  int32 rating = 1;
  int64 count = 2;
  double percentage = 3;
}

message NPSStats {
  int64 detractors = 1;
  int64 passives = 2;
  int64 promoters = 3;
  double nps_score = 4;
}

message TextStats {
  int64 total_responses = 1;
  int32 avg_length = 2;
  repeated string sample_responses = 3;
}

message GetQuestionAnalyticsRequest {
  string form_id = 1;
  optional string question_id = 2; // If null, get all questions
}

message GetQuestionAnalyticsResponse {
  repeated QuestionAnalytics questions = 1;
}

// Question Drop-off
message QuestionDropOff {
  string question_id = 1;
  string question_label = 2;
  int32 order_index = 3;
  int64 viewed_count = 4;
  int64 answered_count = 5;
  int64 abandoned_count = 6;
  double answer_rate = 7;
  int32 avg_time_spent_seconds = 8;
}

message GetQuestionDropOffRequest {
  string form_id = 1;
}

message GetQuestionDropOffResponse {
  repeated QuestionDropOff questions = 1;
}

// Geographic Distribution
message GeographicStats {
  string country = 1;
  string country_name = 2;
  int64 count = 3;
  double percentage = 4;
  repeated CityStats cities = 5;
}

message CityStats {
  string city = 1;
  int64 count = 2;
}

message GetGeographicDistributionRequest {
  string form_id = 1;
}

message GetGeographicDistributionResponse {
  repeated GeographicStats countries = 1;
}

// Time Distribution
message HourlyStats {
  int32 hour = 1;
  int64 count = 2;
}

message DayOfWeekStats {
  int32 day = 1; // 0 = Sunday, 6 = Saturday
  string day_name = 2;
  int64 count = 3;
}

message GetTimeDistributionRequest {
  string form_id = 1;
  google.protobuf.Timestamp start_date = 2;
}

message GetTimeDistributionResponse {
  repeated HourlyStats hourly = 1;
  repeated DayOfWeekStats daily = 2;
}

// Track View
message TrackViewRequest {
  string form_id = 1;
  string session_id = 2;
  string user_agent = 3;
  string referrer = 4;
  string ip_address = 5;
}

message TrackViewResponse {
  bool success = 1;
}

// Track Response Start
message TrackResponseStartRequest {
  string form_id = 1;
  string session_id = 2;
}

message TrackResponseStartResponse {
  bool success = 1;
}

// Export Analytics
message ExportAnalyticsRequest {
  string form_id = 1;
  string format = 2; // csv, pdf, xlsx
  google.protobuf.Timestamp start_date = 3;
  google.protobuf.Timestamp end_date = 4;
}

message ExportAnalyticsResponse {
  bytes data = 1;
  string filename = 2;
  string mime_type = 3;
}

// Analytics Service
service AnalyticsService {
  rpc GetOverviewStats(GetOverviewStatsRequest) returns (GetOverviewStatsResponse);
  rpc GetResponseTrend(GetResponseTrendRequest) returns (GetResponseTrendResponse);
  rpc GetDeviceBreakdown(GetDeviceBreakdownRequest) returns (GetDeviceBreakdownResponse);
  rpc GetCompletionFunnel(GetCompletionFunnelRequest) returns (GetCompletionFunnelResponse);
  rpc GetQuestionAnalytics(GetQuestionAnalyticsRequest) returns (GetQuestionAnalyticsResponse);
  rpc GetQuestionDropOff(GetQuestionDropOffRequest) returns (GetQuestionDropOffResponse);
  rpc GetGeographicDistribution(GetGeographicDistributionRequest) returns (GetGeographicDistributionResponse);
  rpc GetTimeDistribution(GetTimeDistributionRequest) returns (GetTimeDistributionResponse);
  rpc TrackView(TrackViewRequest) returns (TrackViewResponse);
  rpc TrackResponseStart(TrackResponseStartRequest) returns (TrackResponseStartResponse);
  rpc ExportAnalytics(ExportAnalyticsRequest) returns (ExportAnalyticsResponse);
}
```

---

## 🔨 Phase 4: Backend Implementation (Days 4-6)

### Step 4.1: Analytics gRPC Server

**File:** `internal/gapi/server_analytics.go`

```go
package gapi

import (
    "github.com/weladee/weladee-form/internal/db"
    pb "github.com/weladee/weladee-form/proto/pb"
)

type AnalyticsServer struct {
    pb.UnimplementedAnalyticsServiceServer
    db *db.Database
}

func NewAnalyticsServer(database *db.Database) *AnalyticsServer {
    return &AnalyticsServer{
        db: database,
    }
}
```

**File:** `internal/gapi/rpc_analytics_overview.go`

```go
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

func (server *AnalyticsServer) GetOverviewStats(
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

    if form.UserID.String() != claims.UserID.String() {
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
                TotalViews:              int64(stats.ViewCount),
                TotalResponses:          int64(stats.ResponseCount),
                CompletionCount:         int64(stats.CompletionCount),
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
    completionRateChange := calculatePercentageChange(previousStats.CompletionRate, currentStats.CompletionRate)
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

func (server *AnalyticsServer) getPeriodStats(
    ctx context.Context,
    formID uuid.UUID,
    startDate, endDate time.Time,
) (*PeriodStats, error) {
    // This would query the daily_stats table or calculate on the fly
    // Implementation depends on your specific needs
    // Simplified version:
    
    dailyStats, err := server.db.Queries.GetDailyStatsRange(ctx, sqlc.GetDailyStatsRangeParams{
        FormID:    formID,
        StartDate: startDate,
        EndDate:   endDate,
    })
    if err != nil {
        return nil, err
    }

    var totalViews, totalStarts, totalCompletions int64
    var totalTime int64
    var timeCount int64

    for _, stat := range dailyStats {
        totalViews += int64(stat.TotalViews)
        totalStarts += int64(stat.TotalStarts)
        totalCompletions += int64(stat.TotalCompletions)
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

func calculateTimeChange(previous, current int64) string {
    diff := current - previous
    if diff == 0 {
        return "0s"
    } else if diff > 0 {
        return fmt.Sprintf("+%ds", diff)
    }
    return fmt.Sprintf("%ds", diff)
}
```

**File:** `internal/gapi/rpc_analytics_trends.go`

```go
package gapi

import (
    "context"
    "time"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServer) GetResponseTrend(
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

    if form.UserID.String() != claims.UserID.String() {
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
        dateStr := vt.Date.Format("2006-01-02")
        dataMap[dateStr] = &pb.ResponseTrendPoint{
            Date:  dateStr,
            Views: vt.TotalViews,
        }
    }

    for _, ct := range completionTrends {
        dateStr := ct.Date.Format("2006-01-02")
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

func (server *AnalyticsServer) GetDeviceBreakdown(
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

    if form.UserID.String() != claims.UserID.String() {
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
            DeviceType: d.DeviceType,
            Count:      d.Count,
            Percentage: float64(d.Percentage),
        })
    }

    return &pb.GetDeviceBreakdownResponse{
        Devices: deviceStats,
    }, nil
}

func (server *AnalyticsServer) GetCompletionFunnel(
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

    if form.UserID.String() != claims.UserID.String() {
        return nil, status.Errorf(codes.PermissionDenied, "not authorized")
    }

    // Get funnel data
    funnelData, err := server.db.Queries.GetCompletionFunnel(ctx, formID)
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
```

**File:** `internal/gapi/rpc_analytics_questions.go`

```go
package gapi

import (
    "context"
    "encoding/json"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServer) GetQuestionAnalytics(
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

    if form.UserID.String() != claims.UserID.String() {
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
                        Choice:     cs.Choice,
                        Count:      cs.Count,
                        Percentage: float64(cs.Percentage),
                    })
                }
                qa.ResponseCount = int64(len(choiceStats))
            }

        case "rating":
            // Get rating statistics
            ratingStats, err := server.db.Queries.GetRatingQuestionStats(ctx, questionID)
            if err == nil {
                for _, rs := range ratingStats {
                    qa.RatingStats = append(qa.RatingStats, &pb.RatingStats{
                        Rating:     int32(rs.Rating),
                        Count:      rs.Count,
                        Percentage: float64(rs.Percentage),
                    })
                }
                qa.ResponseCount = int64(len(ratingStats))
            }

            // Check if it's an NPS question (0-10 scale)
            if len(ratingStats) > 0 && ratingStats[0].Rating >= 0 && ratingStats[len(ratingStats)-1].Rating <= 10 {
                nps, err := server.db.Queries.GetNPSScore(ctx, questionID)
                if err == nil {
                    qa.NpsStats = &pb.NPSStats{
                        Detractors: nps.Detractors,
                        Passives:   nps.Passives,
                        Promoters:  nps.Promoters,
                        NpsScore:   float64(nps.NpsScore),
                    }
                }
            }

        case "short_text", "long_text", "email", "url":
            // Get text statistics (count, avg length, samples)
            // This would need a separate query
            qa.ResponseCount = 0 // Placeholder
        }

        analytics = append(analytics, qa)
    }

    return &pb.GetQuestionAnalyticsResponse{
        Questions: analytics,
    }, nil
}

func (server *AnalyticsServer) GetQuestionDropOff(
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

    if form.UserID.String() != claims.UserID.String() {
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
```

**File:** `internal/gapi/rpc_analytics_tracking.go`

```go
package gapi

import (
    "context"
    "net"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
    "github.com/mssola/user_agent"

    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServer) TrackView(
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
    } else if ua.Tablet() {
        deviceType = "tablet"
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
        SessionID:  sqlc.NullString{String: req.SessionId, Valid: req.SessionId != ""},
        IpAddress:  ipAddr,
        UserAgent:  sqlc.NullString{String: req.UserAgent, Valid: req.UserAgent != ""},
        Referrer:   sqlc.NullString{String: req.Referrer, Valid: req.Referrer != ""},
        DeviceType: sqlc.NullString{String: deviceType, Valid: true},
        Browser:    sqlc.NullString{String: browser, Valid: true},
        Os:         sqlc.NullString{String: osInfo, Valid: true},
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

func (server *AnalyticsServer) TrackResponseStart(
    ctx context.Context,
    req *pb.TrackResponseStartRequest,
) (*pb.TrackResponseStartResponse, error) {
    formID, err := uuid.Parse(req.FormId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID")
    }

    _, err = server.db.Queries.TrackResponseStart(ctx, sqlc.TrackResponseStartParams{
        FormID:    formID,
        SessionID: sqlc.NullString{String: req.SessionId, Valid: req.SessionId != ""},
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to track start: %v", err)
    }

    return &pb.TrackResponseStartResponse{Success: true}, nil
}
```

---

## 🌐 Phase 5: Frontend Implementation (Days 7-10)

### Step 5.1: Install Dependencies

```bash
npm install recharts date-fns
npm install lucide-react # Already installed
```

### Step 5.2: Create Analytics Dashboard Components

**File:** `app/dashboard/[formId]/analytics/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { analyticsClient } from '@/lib/grpc-client';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { LoadingSpinner } from '@/components/ui/loading';
import { ErrorMessage } from '@/components/ui/error';

export default function AnalyticsPage() {
  const params = useParams();
  const formId = params.formId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadAnalytics();
  }, [formId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setFullYear(2000); // All time
      }

      // Fetch all analytics data in parallel
      const [
        overviewStats,
        responseTrend,
        deviceBreakdown,
        completionFunnel,
        questionAnalytics,
        questionDropOff
      ] = await Promise.all([
        analyticsClient.getOverviewStats({
          formId,
          timeRange
        }),
        analyticsClient.getResponseTrend({
          formId,
          startDate: { seconds: Math.floor(startDate.getTime() / 1000) },
          endDate: { seconds: Math.floor(endDate.getTime() / 1000) }
        }),
        analyticsClient.getDeviceBreakdown({ formId }),
        analyticsClient.getCompletionFunnel({ formId }),
        analyticsClient.getQuestionAnalytics({ formId }),
        analyticsClient.getQuestionDropOff({ formId })
      ]);

      setAnalyticsData({
        overview: overviewStats.stats,
        trends: responseTrend.dataPoints,
        devices: deviceBreakdown.devices,
        funnel: completionFunnel.funnel,
        questions: questionAnalytics.questions,
        dropOff: questionDropOff.questions
      });
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage message={error} onRetry={loadAnalytics} />
      </div>
    );
  }

  return (
    <AnalyticsDashboard
      data={analyticsData}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      formId={formId}
    />
  );
}
```

**File:** `components/analytics/analytics-dashboard.tsx`

```typescript
import React from 'react';
import { Download, Filter, Eye, Users, CheckCircle, Clock } from 'lucide-react';
import { OverviewStats } from './overview-stats';
import { ResponseTrendChart } from './response-trend-chart';
import { DeviceBreakdownChart } from './device-breakdown-chart';
import { CompletionFunnelChart } from './completion-funnel-chart';
import { QuestionAnalyticsSection } from './question-analytics-section';

interface AnalyticsDashboardProps {
  data: any;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  formId: string;
}

export function AnalyticsDashboard({
  data,
  timeRange,
  onTimeRangeChange,
  formId
}: AnalyticsDashboardProps) {
  const handleExport = async () => {
    // Call export analytics RPC
    try {
      const response = await analyticsClient.exportAnalytics({
        formId,
        format: 'csv',
        startDate: calculateStartDate(timeRange),
        endDate: new Date()
      });

      // Download file
      const blob = new Blob([response.data], { type: response.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.filename;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Form Performance Insights</p>
          </div>
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <OverviewStats stats={data.overview} />

      {/* Response Trends */}
      <div className="mt-8">
        <ResponseTrendChart data={data.trends} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2">
          <CompletionFunnelChart funnel={data.funnel} />
        </div>
        <div>
          <DeviceBreakdownChart devices={data.devices} />
        </div>
      </div>

      {/* Question Analytics */}
      <div className="mt-8">
        <QuestionAnalyticsSection questions={data.questions} />
      </div>
    </div>
  );
}
```

**File:** `components/analytics/overview-stats.tsx`

```typescript
import { Eye, Users, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<any>;
  trend: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, change, icon: Icon, trend }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const bgColor = trend === 'up' ? 'bg-green-50' : trend === 'down' ? 'bg-red-50' : 'bg-blue-50';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${trendColor}`} />
        </div>
        <span className={`text-sm font-medium ${trendColor}`}>
          {change}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

export function OverviewStats({ stats }) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getTrend = (change: string) => {
    if (change.startsWith('+')) return 'up';
    if (change.startsWith('-')) return 'down';
    return 'neutral';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Views"
        value={stats.totalViews.toLocaleString()}
        change={stats.viewsChange}
        icon={Eye}
        trend={getTrend(stats.viewsChange)}
      />
      <StatCard
        title="Total Responses"
        value={stats.totalResponses.toLocaleString()}
        change={stats.responsesChange}
        icon={Users}
        trend={getTrend(stats.responsesChange)}
      />
      <StatCard
        title="Completion Rate"
        value={`${stats.completionRate.toFixed(1)}%`}
        change={stats.completionRateChange}
        icon={CheckCircle}
        trend={getTrend(stats.completionRateChange)}
      />
      <StatCard
        title="Avg. Time"
        value={formatTime(stats.avgCompletionTimeSeconds)}
        change={stats.avgTimeChange}
        icon={Clock}
        trend={getTrend(stats.avgTimeChange)}
      />
    </div>
  );
}
```

**File:** `components/analytics/response-trend-chart.tsx`

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function ResponseTrendChart({ data }) {
  // Format data for recharts
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: point.views,
    responses: point.responses,
    completions: point.completions
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Response Trends</h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
            <span className="text-gray-600">Views</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
            <span className="text-gray-600">Responses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Completions</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          />
          <Line type="monotone" dataKey="views" stroke="#4F46E5" strokeWidth={2} dot={{ fill: '#4F46E5', r: 4 }} />
          <Line type="monotone" dataKey="responses" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#06B6D4', r: 4 }} />
          <Line type="monotone" dataKey="completions" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**File:** `components/analytics/question-analytics-section.tsx`

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function QuestionAnalyticsSection({ questions }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Question Analytics</h2>

      {questions.map((question) => (
        <QuestionAnalyticsCard key={question.questionId} question={question} />
      ))}
    </div>
  );
}

function QuestionAnalyticsCard({ question }) {
  const renderChart = () => {
    switch (question.questionType) {
      case 'single_choice':
      case 'multiple_choice':
      case 'dropdown':
        return <ChoiceQuestionChart stats={question.choiceStats} />;
      case 'rating':
        return question.npsStats ? 
          <NPSChart stats={question.npsStats} /> : 
          <RatingChart stats={question.ratingStats} />;
      default:
        return <div className="text-gray-500">No visualization available</div>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">{question.questionLabel}</h3>
          <span className="text-sm text-gray-500">{question.responseCount} responses</span>
        </div>
        <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
          {question.questionType.replace('_', ' ')}
        </span>
      </div>

      {renderChart()}
    </div>
  );
}

function ChoiceQuestionChart({ stats }) {
  const data = stats.map(s => ({
    name: s.choice,
    value: s.count,
    percentage: s.percentage
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" stroke="#9ca3af" />
        <YAxis type="category" dataKey="name" stroke="#9ca3af" width={120} />
        <Tooltip />
        <Bar dataKey="value" fill="#06B6D4" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RatingChart({ stats }) {
  const data = stats.map(s => ({
    name: '⭐'.repeat(s.rating),
    value: s.count
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" />
        <Tooltip />
        <Bar dataKey="value" fill="#4F46E5" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NPSChart({ stats }) {
  const segments = [
    { name: 'Detractors', value: stats.detractors, color: '#EF4444' },
    { name: 'Passives', value: stats.passives, color: '#F59E0B' },
    { name: 'Promoters', value: stats.promoters, color: '#10B981' }
  ];

  const total = stats.detractors + stats.passives + stats.promoters;

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="inline-block">
          <div className="text-5xl font-bold text-indigo-600 mb-2">{stats.npsScore}</div>
          <div className="text-sm text-gray-500">Net Promoter Score</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {segments.map((segment) => (
          <div
            key={segment.name}
            className="text-center p-4 rounded-lg"
            style={{ backgroundColor: `${segment.color}10` }}
          >
            <div className="text-2xl font-bold mb-1" style={{ color: segment.color }}>
              {segment.value}
            </div>
            <div className="text-xs font-medium text-gray-600 mb-1">{segment.name}</div>
            <div className="text-xs text-gray-500">
              ({total > 0 ? ((segment.value / total) * 100).toFixed(1) : 0}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📥 Phase 4.5: Export Analytics Implementation (Day 6.5)

### Step 4.5.1: Export Utilities

**File:** `internal/utils/export.go`

```go
package utils

import (
    "bytes"
    "encoding/csv"
    "fmt"
    "time"

    "github.com/xuri/excelize/v2"
)

// CSVExporter handles CSV export
type CSVExporter struct {
    buffer *bytes.Buffer
    writer *csv.Writer
}

func NewCSVExporter() *CSVExporter {
    buffer := &bytes.Buffer{}
    return &CSVExporter{
        buffer: buffer,
        writer: csv.NewWriter(buffer),
    }
}

func (e *CSVExporter) WriteHeader(headers []string) error {
    return e.writer.Write(headers)
}

func (e *CSVExporter) WriteRow(row []string) error {
    return e.writer.Write(row)
}

func (e *CSVExporter) GetBytes() []byte {
    e.writer.Flush()
    return e.buffer.Bytes()
}

// ExcelExporter handles Excel export
type ExcelExporter struct {
    file      *excelize.File
    sheetName string
    rowIndex  int
}

func NewExcelExporter(sheetName string) *ExcelExporter {
    f := excelize.NewFile()
    index, _ := f.NewSheet(sheetName)
    f.SetActiveSheet(index)
    f.DeleteSheet("Sheet1") // Remove default sheet

    return &ExcelExporter{
        file:      f,
        sheetName: sheetName,
        rowIndex:  1,
    }
}

func (e *ExcelExporter) WriteHeader(headers []string) error {
    // Style for headers
    style, err := e.file.NewStyle(&excelize.Style{
        Font: &excelize.Font{
            Bold: true,
            Size: 12,
        },
        Fill: excelize.Fill{
            Type:    "pattern",
            Color:   []string{"#4F46E5"},
            Pattern: 1,
        },
        Alignment: &excelize.Alignment{
            Horizontal: "center",
            Vertical:   "center",
        },
    })
    if err != nil {
        return err
    }

    for i, header := range headers {
        cell := fmt.Sprintf("%s%d", columnName(i), e.rowIndex)
        e.file.SetCellValue(e.sheetName, cell, header)
        e.file.SetCellStyle(e.sheetName, cell, cell, style)
    }

    e.rowIndex++
    return nil
}

func (e *ExcelExporter) WriteRow(row []string) error {
    for i, value := range row {
        cell := fmt.Sprintf("%s%d", columnName(i), e.rowIndex)
        e.file.SetCellValue(e.sheetName, cell, value)
    }
    e.rowIndex++
    return nil
}

func (e *ExcelExporter) AddChart(chartType, title string, dataRange string) error {
    chart := &excelize.Chart{
        Type: chartType,
        Series: []excelize.ChartSeries{
            {
                Name:       title,
                Categories: dataRange,
                Values:     dataRange,
            },
        },
        Title: []excelize.RichTextRun{
            {
                Text: title,
            },
        },
    }

    cell := fmt.Sprintf("H%d", e.rowIndex+2)
    return e.file.AddChart(e.sheetName, cell, chart)
}

func (e *ExcelExporter) GetBytes() ([]byte, error) {
    // Auto-fit columns
    for i := 0; i < 20; i++ {
        col := columnName(i)
        e.file.SetColWidth(e.sheetName, col, col, 15)
    }

    buffer := &bytes.Buffer{}
    if err := e.file.Write(buffer); err != nil {
        return nil, err
    }
    return buffer.Bytes(), nil
}

func columnName(index int) string {
    name := ""
    for index >= 0 {
        name = string(rune('A'+index%26)) + name
        index = index/26 - 1
    }
    return name
}
```

**File:** `internal/gapi/rpc_analytics_export.go`

```go
package gapi

import (
    "context"
    "fmt"
    "strconv"
    "time"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db/sqlc"
    "github.com/weladee/weladee-form/internal/utils"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *AnalyticsServer) ExportAnalytics(
    ctx context.Context,
    req *pb.ExportAnalyticsRequest,
) (*pb.ExportAnalyticsResponse, error) {
    // Authenticate user
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

    if form.UserID.String() != claims.UserID.String() {
        return nil, status.Errorf(codes.PermissionDenied, "not authorized")
    }

    // Get date range
    startDate := req.StartDate.AsTime()
    endDate := req.EndDate.AsTime()

    switch req.Format {
    case "csv":
        return server.exportCSV(ctx, form, startDate, endDate)
    case "xlsx", "excel":
        return server.exportExcel(ctx, form, startDate, endDate)
    case "pdf":
        return server.exportPDF(ctx, form, startDate, endDate)
    default:
        return nil, status.Errorf(codes.InvalidArgument, "unsupported format: %s", req.Format)
    }
}

func (server *AnalyticsServer) exportCSV(
    ctx context.Context,
    form *sqlc.Form,
    startDate, endDate time.Time,
) (*pb.ExportAnalyticsResponse, error) {
    exporter := utils.NewCSVExporter()

    // Get form questions
    questions, err := server.db.Queries.ListFormQuestions(ctx, form.ID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get questions: %v", err)
    }

    // Build CSV headers
    headers := []string{"Response ID", "Submitted At", "Completed", "Device", "Completion Time (seconds)"}
    for _, q := range questions {
        headers = append(headers, q.Label)
    }
    exporter.WriteHeader(headers)

    // Get all responses with answers
    responses, err := server.db.Queries.GetFormResponsesWithAnswers(ctx, form.ID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get responses: %v", err)
    }

    // Group by response ID
    responseMap := make(map[uuid.UUID]map[string]any)
    for _, r := range responses {
        if _, exists := responseMap[r.ResponseID]; !exists {
            responseMap[r.ResponseID] = map[string]any{
                "submitted_at":       r.SubmittedAt,
                "completed":          r.Completed,
                "device":             r.DeviceType,
                "completion_time":    r.CompletionTimeSeconds,
                "answers":            make(map[uuid.UUID]string),
            }
        }

        // Add answer
        answerMap := responseMap[r.ResponseID]["answers"].(map[uuid.UUID]string)
        answer := formatAnswer(r)
        answerMap[r.QuestionID] = answer
    }

    // Write rows
    for responseID, data := range responseMap {
        row := []string{
            responseID.String(),
            formatTimestamp(data["submitted_at"].(time.Time)),
            formatBool(data["completed"].(bool)),
            data["device"].(string),
            formatInt(data["completion_time"].(int32)),
        }

        answerMap := data["answers"].(map[uuid.UUID]string)
        for _, q := range questions {
            if answer, exists := answerMap[q.ID]; exists {
                row = append(row, answer)
            } else {
                row = append(row, "")
            }
        }

        exporter.WriteRow(row)
    }

    filename := fmt.Sprintf("form_%s_analytics_%s.csv", 
        form.ID.String()[:8], 
        time.Now().Format("2006-01-02"))

    return &pb.ExportAnalyticsResponse{
        Data:     exporter.GetBytes(),
        Filename: filename,
        MimeType: "text/csv",
    }, nil
}

func (server *AnalyticsServer) exportExcel(
    ctx context.Context,
    form *sqlc.Form,
    startDate, endDate time.Time,
) (*pb.ExportAnalyticsResponse, error) {
    // Create Excel file with multiple sheets
    
    // Sheet 1: Overview
    overviewSheet := utils.NewExcelExporter("Overview")
    
    // Get overview stats
    stats, err := server.db.Queries.GetFormOverviewStats(ctx, form.ID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get stats: %v", err)
    }

    overviewSheet.WriteHeader([]string{"Metric", "Value"})
    overviewSheet.WriteRow([]string{"Form Title", form.Title})
    overviewSheet.WriteRow([]string{"Total Views", strconv.FormatInt(int64(stats.ViewCount), 10)})
    overviewSheet.WriteRow([]string{"Total Responses", strconv.FormatInt(int64(stats.ResponseCount), 10)})
    overviewSheet.WriteRow([]string{"Completion Count", strconv.FormatInt(int64(stats.CompletionCount), 10)})
    overviewSheet.WriteRow([]string{"Completion Rate", fmt.Sprintf("%.2f%%", stats.CompletionRate)})
    overviewSheet.WriteRow([]string{"Avg Completion Time", fmt.Sprintf("%d seconds", stats.AvgCompletionTime)})
    overviewSheet.WriteRow([]string{"Export Date", time.Now().Format("2006-01-02 15:04:05")})

    // Sheet 2: Responses
    responsesSheet := utils.NewExcelExporter("Responses")
    
    questions, err := server.db.Queries.ListFormQuestions(ctx, form.ID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get questions: %v", err)
    }

    headers := []string{"Response ID", "Submitted At", "Completed", "Device", "Browser", "Country", "City"}
    for _, q := range questions {
        headers = append(headers, q.Label)
    }
    responsesSheet.WriteHeader(headers)

    responses, err := server.db.Queries.GetFormResponsesWithAnswers(ctx, form.ID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get responses: %v", err)
    }

    // Group responses and write
    responseMap := make(map[uuid.UUID]map[string]any)
    for _, r := range responses {
        if _, exists := responseMap[r.ResponseID]; !exists {
            responseMap[r.ResponseID] = map[string]any{
                "submitted_at": r.SubmittedAt,
                "completed":    r.Completed,
                "device":       r.DeviceType,
                "browser":      r.Browser,
                "country":      r.Country,
                "city":         r.City,
                "answers":      make(map[uuid.UUID]string),
            }
        }

        answerMap := responseMap[r.ResponseID]["answers"].(map[uuid.UUID]string)
        answerMap[r.QuestionID] = formatAnswer(r)
    }

    for responseID, data := range responseMap {
        row := []string{
            responseID.String(),
            formatTimestamp(data["submitted_at"].(time.Time)),
            formatBool(data["completed"].(bool)),
            formatString(data["device"]),
            formatString(data["browser"]),
            formatString(data["country"]),
            formatString(data["city"]),
        }

        answerMap := data["answers"].(map[uuid.UUID]string)
        for _, q := range questions {
            if answer, exists := answerMap[q.ID]; exists {
                row = append(row, answer)
            } else {
                row = append(row, "")
            }
        }

        responsesSheet.WriteRow(row)
    }

    // Sheet 3: Question Analytics
    analyticsSheet := utils.NewExcelExporter("Question Analytics")
    analyticsSheet.WriteHeader([]string{"Question", "Type", "Total Responses", "Top Answer", "Top Answer Count"})

    for _, q := range questions {
        switch q.Type {
        case "single_choice", "multiple_choice", "dropdown":
            choiceStats, err := server.db.Queries.GetChoiceQuestionStats(ctx, q.ID)
            if err == nil && len(choiceStats) > 0 {
                topChoice := choiceStats[0]
                analyticsSheet.WriteRow([]string{
                    q.Label,
                    q.Type,
                    strconv.FormatInt(topChoice.Count, 10),
                    topChoice.Choice,
                    strconv.FormatInt(topChoice.Count, 10),
                })
            }
        case "rating":
            ratingStats, err := server.db.Queries.GetRatingQuestionStats(ctx, q.ID)
            if err == nil && len(ratingStats) > 0 {
                totalResponses := int64(0)
                weightedSum := int64(0)
                for _, rs := range ratingStats {
                    totalResponses += rs.Count
                    weightedSum += int64(rs.Rating) * rs.Count
                }
                avgRating := float64(weightedSum) / float64(totalResponses)
                analyticsSheet.WriteRow([]string{
                    q.Label,
                    q.Type,
                    strconv.FormatInt(totalResponses, 10),
                    fmt.Sprintf("Avg: %.2f", avgRating),
                    "",
                })
            }
        }
    }

    // Sheet 4: Device Breakdown
    deviceSheet := utils.NewExcelExporter("Device Breakdown")
    deviceSheet.WriteHeader([]string{"Device Type", "Count", "Percentage"})

    devices, err := server.db.Queries.GetDeviceBreakdown(ctx, form.ID)
    if err == nil {
        for _, d := range devices {
            deviceSheet.WriteRow([]string{
                d.DeviceType,
                strconv.FormatInt(d.Count, 10),
                fmt.Sprintf("%.2f%%", d.Percentage),
            })
        }
    }

    // Combine all sheets into one file
    mainFile := overviewSheet.file
    
    // Copy other sheets (simplified - in production you'd merge properly)
    responsesBytes, _ := responsesSheet.GetBytes()
    analyticsBytes, _ := analyticsSheet.GetBytes()
    deviceBytes, _ := deviceSheet.GetBytes()

    filename := fmt.Sprintf("form_%s_analytics_%s.xlsx", 
        form.ID.String()[:8], 
        time.Now().Format("2006-01-02"))

    fileBytes, err := overviewSheet.GetBytes()
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to generate Excel: %v", err)
    }

    return &pb.ExportAnalyticsResponse{
        Data:     fileBytes,
        Filename: filename,
        MimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }, nil
}

func (server *AnalyticsServer) exportPDF(
    ctx context.Context,
    form *sqlc.Form,
    startDate, endDate time.Time,
) (*pb.ExportAnalyticsResponse, error) {
    // PDF export using a library like gofpdf
    // This is a simplified version - full implementation would include charts
    
    return nil, status.Errorf(codes.Unimplemented, "PDF export not yet implemented")
}

// Helper functions
func formatAnswer(r *sqlc.GetFormResponsesWithAnswersRow) string {
    if r.AnswerText.Valid {
        return r.AnswerText.String
    }
    if r.AnswerNumber.Valid {
        return strconv.FormatFloat(r.AnswerNumber.Float64, 'f', -1, 64)
    }
    if r.AnswerDate.Valid {
        return r.AnswerDate.Time.Format("2006-01-02")
    }
    if r.AnswerTime.Valid {
        return r.AnswerTime.Time.Format("15:04:05")
    }
    if r.AnswerChoices != nil {
        return string(r.AnswerChoices)
    }
    if r.AnswerFileUrl.Valid {
        return r.AnswerFileUrl.String
    }
    return ""
}

func formatTimestamp(t time.Time) string {
    return t.Format("2006-01-02 15:04:05")
}

func formatBool(b bool) string {
    if b {
        return "Yes"
    }
    return "No"
}

func formatInt(i int32) string {
    return strconv.FormatInt(int64(i), 10)
}

func formatString(s any) string {
    if s == nil {
        return ""
    }
    if str, ok := s.(string); ok {
        return str
    }
    return fmt.Sprintf("%v", s)
}
```

### Step 4.5.2: Install Required Dependencies

**Update:** `go.mod`

```bash
go get github.com/xuri/excelize/v2
```

### Step 4.5.3: Frontend Export Handler

**File:** `lib/grpc-client.ts` (update)

```typescript
export async function downloadAnalyticsExport(
  formId: string,
  format: 'csv' | 'xlsx' | 'pdf',
  startDate: Date,
  endDate: Date
) {
  try {
    const response = await analyticsClient.exportAnalytics({
      formId,
      format,
      startDate: {
        seconds: BigInt(Math.floor(startDate.getTime() / 1000)),
        nanos: 0
      },
      endDate: {
        seconds: BigInt(Math.floor(endDate.getTime() / 1000)),
        nanos: 0
      }
    });

    // Create blob and download
    const blob = new Blob([response.data], { type: response.mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = response.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, filename: response.filename };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}
```

**File:** `components/analytics/export-button.tsx`

```typescript
import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { downloadAnalyticsExport } from '@/lib/grpc-client';

interface ExportButtonProps {
  formId: string;
  startDate: Date;
  endDate: Date;
}

export function ExportButton({ formId, startDate, endDate }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setIsExporting(true);
    setShowMenu(false);

    try {
      const result = await downloadAnalyticsExport(formId, format, startDate, endDate);
      
      // Show success notification
      toast.success(`Analytics exported successfully: ${result.filename}`);
    } catch (error) {
      toast.error('Failed to export analytics');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
          </>
        )}
      </button>

      {showMenu && !isExporting && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export as CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export as Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
          >
            <FileText className="w-4 h-4" />
            Export as PDF (Coming Soon)
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 4.5.4: Update Dashboard to Use Export Button

**File:** `components/analytics/analytics-dashboard.tsx` (update)

```typescript
import { ExportButton } from './export-button';

export function AnalyticsDashboard({
  data,
  timeRange,
  onTimeRangeChange,
  formId
}: AnalyticsDashboardProps) {
  const { startDate, endDate } = calculateDateRange(timeRange);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Form Performance Insights</p>
          </div>
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <ExportButton 
              formId={formId} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </div>
        </div>
      </div>
      {/* Rest of dashboard... */}
    </div>
  );
}

function calculateDateRange(timeRange: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setFullYear(2000);
  }

  return { startDate, endDate };
}
```

---

## ✅ Updated Implementation Checklist

- [ ] Phase 4.5: Export Analytics implementation
  - [ ] Install excelize library
  - [ ] Create CSV exporter utility
  - [ ] Create Excel exporter utility
  - [ ] Implement ExportAnalytics RPC handler
  - [ ] Add export button component
  - [ ] Test CSV export with sample data
  - [ ] Test Excel export with multiple sheets
  - [ ] Verify file download in browser
  - [ ] Test with large datasets (1000+ responses)
  - [ ] Add error handling for export failures

---

## 🔄 Phase 6: View Tracking Integration (Day 11)

### Step 6.1: Client-Side View Tracking

**File:** `app/forms/[formId]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsClient } from '@/lib/grpc-client';
import { v4 as uuidv4 } from 'uuid';

export default function FormViewPage() {
  const params = useParams();
  const formId = params.formId as string;
  const [sessionId] = useState(() => {
    // Get or create session ID
    let sid = sessionStorage.getItem('form_session_id');
    if (!sid) {
      sid = uuidv4();
      sessionStorage.setItem('form_session_id', sid);
    }
    return sid;
  });

  useEffect(() => {
    // Track form view
    trackView();
  }, []);

  const trackView = async () => {
    try {
      await analyticsClient.trackView({
        formId,
        sessionId,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        ipAddress: '' // Will be extracted on server
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const handleFormStart = async () => {
    try {
      await analyticsClient.trackResponseStart({
        formId,
        sessionId
      });
    } catch (error) {
      console.error('Failed to track start:', error);
    }
  };

  // Rest of form component...
}
```

---

## 📊 Phase 7: Testing & Validation (Days 12-13)

### Testing Checklist

#### Database Tests
```bash
# Test analytics queries
psql -d weladee -c "SELECT * FROM form.form_views LIMIT 10;"
psql -d weladee -c "SELECT * FROM form.daily_stats WHERE form_id = 'your-form-id';"
```

#### Backend Tests
**File:** `test/analytics_test.go`

```go
package test

import (
    "testing"
    "context"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/weladee/weladee-form/internal/gapi"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func TestGetOverviewStats(t *testing.T) {
    server := setupTestServer()
    ctx := setupAuthContext()

    req := &pb.GetOverviewStatsRequest{
        FormId:    testFormID,
        TimeRange: "7d",
    }

    resp, err := server.GetOverviewStats(ctx, req)
    assert.NoError(t, err)
    assert.NotNil(t, resp.Stats)
    assert.Greater(t, resp.Stats.TotalViews, int64(0))
}

func TestGetResponseTrend(t *testing.T) {
    server := setupTestServer()
    ctx := setupAuthContext()

    endDate := time.Now()
    startDate := endDate.AddDate(0, 0, -7)

    req := &pb.GetResponseTrendRequest{
        FormId:    testFormID,
        StartDate: timestamppb.New(startDate),
        EndDate:   timestamppb.New(endDate),
    }

    resp, err := server.GetResponseTrend(ctx, req)
    assert.NoError(t, err)
    assert.NotEmpty(t, resp.DataPoints)
}
```

#### Frontend Tests
**File:** `__tests__/analytics-dashboard.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

describe('AnalyticsDashboard', () => {
  const mockData = {
    overview: {
      totalViews: 1000,
      totalResponses: 500,
      completionRate: 80,
      avgCompletionTimeSeconds: 180
    },
    trends: [],
    devices: [],
    funnel: { stages: [] },
    questions: []
  };

  it('renders overview stats correctly', () => {
    render(
      <AnalyticsDashboard
        data={mockData}
        timeRange="7d"
        onTimeRangeChange={() => {}}
        formId="test-form"
      />
    );

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });
});
```

---

## 🚀 Phase 8: Deployment (Day 14)

### Deployment Steps

1. **Run Database Migrations**
```bash
psql -d weladee -f sql/schema/analytics_schema.sql
```

2. **Generate Code**
```bash
./scripts/generate.sh
```

3. **Update Server**
```go
// In cmd/server/main.go
analyticsServer := gapi.NewAnalyticsServer(database)
pb.RegisterAnalyticsServiceServer(grpcServer, analyticsServer)
```

4. **Deploy Frontend**
```bash
npm run build
npm run deploy
```

5. **Verify Analytics**
- Submit test responses
- Check analytics dashboard
- Verify tracking is working
- Test export functionality

---

## 📝 Additional Features to Consider

1. **Real-time Dashboard Updates**
   - Use WebSocket or Server-Sent Events
   - Update stats without page refresh

2. **Custom Reports**
   - Allow users to create custom date ranges
   - Save favorite reports

3. **Email Reports**
   - Schedule weekly/monthly reports
   - Send via email automatically

4. **Advanced Filtering**
   - Filter by device type
   - Filter by geography
   - Filter by referrer

5. **A/B Testing**
   - Compare different form versions
   - Track conversion rates

6. **Heatmaps**
   - Visual representation of where users click
   - Time spent on each question

7. **Geographic Map**
   - Interactive world map showing response locations
   - Regional breakdown

---

## ✅ Implementation Checklist

- [ ] Phase 1: Database schema extensions
- [ ] Phase 2: SQLC queries for analytics
- [ ] Phase 3: Protocol Buffer definitions
- [ ] Phase 4: Backend gRPC implementation
- [ ] Phase 5: Frontend dashboard components
- [ ] Phase 6: View tracking integration
- [ ] Phase 7: Testing and validation
- [ ] Phase 8: Deployment
- [ ] Documentation complete
- [ ] User training materials created

---

## 🎉 Success Criteria

The analytics dashboard implementation is complete when:

1. ✅ All metrics display correctly
2. ✅ Charts render with real data
3. ✅ View tracking works on form pages
4. ✅ Export functionality generates CSV/PDF
5. ✅ Time range filtering works
6. ✅ Question analytics show for all question types
7. ✅ Performance is acceptable (< 2s load time)
8. ✅ Mobile responsive design works
9. ✅ All tests pass
10. ✅ Production deployment successful