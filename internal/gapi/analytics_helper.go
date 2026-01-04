package gapi

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/db/sqlc"
)

// UpdateDailyStats updates the daily_stats table for a form on the current date.
// This is a shared helper function that can be called from any server implementation.
func UpdateDailyStats(db *db.Database, formID uuid.UUID) {
	ctx := context.Background()
	today := time.Now().Truncate(24 * time.Hour)

	// Get view stats for today
	viewStats, err := db.Queries.GetViewStatsForDate(ctx, sqlc.GetViewStatsForDateParams{
		FormID:    formID,
		StartDate: today,
		EndDate:   today.Add(24 * time.Hour),
	})
	var totalViews, uniqueViews, desktopViews, mobileViews int32
	if err == nil && len(viewStats) > 0 {
		for _, v := range viewStats {
			totalViews += int32(v.Count)
			if v.SessionID.Valid && v.SessionID.String != "" {
				uniqueViews++
			}
			if v.DeviceType.Valid {
				switch v.DeviceType.String {
				case "desktop":
					desktopViews += int32(v.Count)
				case "mobile":
					mobileViews += int32(v.Count)
				}
			}
		}
	}

	// Get response starts for today
	startStats, err := db.Queries.GetResponseStartsForDate(ctx, sqlc.GetResponseStartsForDateParams{
		FormID:    formID,
		StartDate: today,
		EndDate:   today.Add(24 * time.Hour),
	})
	var totalStarts int32
	if err == nil && len(startStats) > 0 {
		totalStarts = int32(len(startStats))
	}

	// Get completions for today
	completionStats, err := db.Queries.GetCompletionStatsForDate(ctx, sqlc.GetCompletionStatsForDateParams{
		FormID:    formID,
		StartDate: today,
		EndDate:   today.Add(24 * time.Hour),
	})
	var totalCompletions, avgCompletionTime int32
	if err == nil && len(completionStats) > 0 {
		totalCompletions = int32(len(completionStats))
		var totalTime int32
		for _, c := range completionStats {
			if c.CompletionTimeSeconds != nil {
				if ct, ok := c.CompletionTimeSeconds.(int32); ok {
					totalTime += ct
				}
			}
		}
		if totalCompletions > 0 {
			avgCompletionTime = totalTime / totalCompletions
		}
	}

	// Convert time.Time to pgtype.Date
	statDate := pgtype.Date{Time: today, Valid: true}

	// Update daily stats (upsert via ON CONFLICT)
	_, err = db.Queries.UpdateDailyStats(ctx, sqlc.UpdateDailyStatsParams{
		FormID:                   formID,
		StatDate:                 statDate,
		TotalViews:               totalViews,
		UniqueViews:              uniqueViews,
		TotalStarts:              totalStarts,
		TotalCompletions:         totalCompletions,
		DesktopViews:             desktopViews,
		MobileViews:              mobileViews,
		TabletViews:              0, // Not tracked separately
		AvgCompletionTimeSeconds: avgCompletionTime,
	})
	if err != nil {
		log.Printf("Failed to update daily stats for form %s: %v", formID, err)
	}
}
