// Copyright (c) 2025 Frontware International Co.,Ltd.
// All rights reserved.

package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/db/sqlc"
	"github.com/weladee/weladee-form/internal/email"
)

// DailyDigestScheduler sends daily digest emails at 9am in each user's timezone
type DailyDigestScheduler struct {
	db          *db.Database
	emailSender *email.EmailSender
}

// NewDailyDigestScheduler creates a new daily digest scheduler
func NewDailyDigestScheduler(db *db.Database, emailSender *email.EmailSender) *DailyDigestScheduler {
	return &DailyDigestScheduler{
		db:          db,
		emailSender: emailSender,
	}
}

// Start begins the daily digest scheduler
func (s *DailyDigestScheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	log.Println("[DailyDigestScheduler] Started - checking every hour for users at 9am in their timezone")

	for {
		select {
		case <-ctx.Done():
			log.Println("[DailyDigestScheduler] Stopped")
			return
		case <-ticker.C:
			s.processDailyDigests(ctx)
		}
	}
}

// processDailyDigests checks for users who need daily digests and sends them
func (s *DailyDigestScheduler) processDailyDigests(ctx context.Context) {
	// Get all forms with daily notification enabled
	forms, err := s.db.Queries.GetFormsWithDailyNotifications(ctx)
	if err != nil {
		log.Printf("[DailyDigestScheduler] Failed to get forms with daily notifications: %v", err)
		return
	}

	if len(forms) == 0 {
		return
	}

	log.Printf("[DailyDigestScheduler] Found %d forms with daily notifications", len(forms))

	// Group forms by user
	userForms := make(map[uuid.UUID][]dailyForm)
	userTimezones := make(map[uuid.UUID]string)
	userEmails := make(map[uuid.UUID]string)

	for _, form := range forms {
		userForms[form.UserID] = append(userForms[form.UserID], dailyForm{
			ID:    form.ID,
			Title: form.Title,
		})
		// Extract timezone string from pgtype.Text
		timezoneStr := "Asia/Bangkok" // Default
		if form.Timezone.Valid {
			timezoneStr = form.Timezone.String
		}
		userTimezones[form.UserID] = timezoneStr
		userEmails[form.UserID] = form.Email
	}

	// Check each user if it's 9am in their timezone
	now := time.Now()
	for userID, forms := range userForms {
		timezoneStr := userTimezones[userID]
		if timezoneStr == "" {
			timezoneStr = "Asia/Bangkok" // Default to UTC+7
		}

		// Parse timezone
		userTimezone, err := time.LoadLocation(timezoneStr)
		if err != nil {
			log.Printf("[DailyDigestScheduler] Invalid timezone %s for user %s: %v", timezoneStr, userID, err)
			continue
		}

		userNow := now.In(userTimezone)

		// Check if it's 9am (within the last hour)
		if userNow.Hour() != 9 {
			continue
		}

		// Check if we already sent today (last_sent_at is today)
		lastSentToday := false
		for _, form := range forms {
			logEntry, err := s.db.Queries.GetDailyNotificationLog(ctx, sqlc.GetDailyNotificationLogParams{
				FormID: form.ID,
				UserID: userID,
			})
			if err == nil {
				lastSent := logEntry.LastSentAt.In(userTimezone)
				if lastSent.Year() == userNow.Year() && lastSent.YearDay() == userNow.YearDay() {
					lastSentToday = true
					break
				}
			}
		}

		if lastSentToday {
			log.Printf("[DailyDigestScheduler] Already sent digest for user %s today, skipping", userID)
			continue
		}

		// Send daily digest for this user
		userEmail := userEmails[userID]
		if userEmail == "" {
			log.Printf("[DailyDigestScheduler] User %s has no email address, skipping", userID)
			continue
		}

		err = s.sendDailyDigest(ctx, userID, userEmail, forms)
		if err != nil {
			log.Printf("[DailyDigestScheduler] Failed to send daily digest for user %s: %v", userID, err)
		}
	}
}

// sendDailyDigest sends a daily digest email to a user for their forms
func (s *DailyDigestScheduler) sendDailyDigest(ctx context.Context, userID uuid.UUID, userEmail string, forms []dailyForm) error {
	now := time.Now()

	for _, form := range forms {
		// Get the last sent time from daily_notification_log
		lastSentAt, _ := s.getLastSentTime(ctx, form.ID, userID)

		// Count new responses since last sent
		newResponseCount, err := s.db.Queries.CountNewResponsesSince(ctx, sqlc.CountNewResponsesSinceParams{
			FormID: form.ID,
			Since:  lastSentAt,
		})
		if err != nil {
			log.Printf("[DailyDigestScheduler] Failed to count new responses for form %s: %v", form.ID, err)
			continue
		}

		if newResponseCount == 0 {
			log.Printf("[DailyDigestScheduler] No new responses for form %s (%s), skipping", form.ID, form.Title)
			continue
		}

		log.Printf("[DailyDigestScheduler] Sending digest for form %s (%s): %d new responses", form.ID, form.Title, newResponseCount)

		// Send notification email
		dashboardURL := fmt.Sprintf("/dashboard/forms/%s/responses", form.ID)
		err = s.emailSender.SendNewResponseNotification(ctx, email.NotificationRequest{
			ToEmail:       userEmail,
			FormName:      form.Title,
			ResponseCount: int(newResponseCount),
			IsDaily:       true,
			DashboardURL:  dashboardURL,
		})
		if err != nil {
			log.Printf("[DailyDigestScheduler] Failed to send daily digest for form %s: %v", form.ID, err)
			continue
		}

		// Update last sent time
		_ = s.updateLastSentTime(ctx, form.ID, userID, int(newResponseCount), now)
	}

	return nil
}

// dailyForm represents a form with daily notification enabled
type dailyForm struct {
	ID    uuid.UUID
	Title string
}

// getLastSentTime gets the last sent time for a form's daily notification
func (s *DailyDigestScheduler) getLastSentTime(ctx context.Context, formID, userID uuid.UUID) (time.Time, error) {
	logEntry, err := s.db.Queries.GetDailyNotificationLog(ctx, sqlc.GetDailyNotificationLogParams{
		FormID: formID,
		UserID: userID,
	})
	if err != nil {
		// No previous entry, default to 24 hours ago
		return time.Now().Add(-24 * time.Hour), nil
	}

	return logEntry.LastSentAt, nil
}

// updateLastSentTime updates the last sent time for a form's daily notification
func (s *DailyDigestScheduler) updateLastSentTime(ctx context.Context, formID, userID uuid.UUID, responseCount int, sentAt time.Time) error {
	_, err := s.db.Queries.UpsertDailyNotificationLog(ctx, sqlc.UpsertDailyNotificationLogParams{
		FormID:        formID,
		UserID:        userID,
		LastSentAt:    sentAt,
		ResponseCount: int32(responseCount),
	})
	return err
}
