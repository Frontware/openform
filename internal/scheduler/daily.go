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

	log.Println("Daily digest scheduler started")

	for {
		select {
		case <-ctx.Done():
			log.Println("Daily digest scheduler stopped")
			return
		case <-ticker.C:
			s.processDailyDigests(ctx)
		}
	}
}

// processDailyDigests checks for users who need daily digests and sends them
func (s *DailyDigestScheduler) processDailyDigests(ctx context.Context) {
	// Get all users with forms that have daily notification enabled
	// For now, we'll check all forms and process based on user timezone
	// TODO: Optimize by adding a database query to get only relevant forms

	// Query all published forms with daily notification mode
	// We need to add this query to SQLC, for now we'll skip this implementation
	// The scheduler will be completed once we regenerate SQLC code
}

// sendDailyDigest sends a daily digest email to a user for their forms
func (s *DailyDigestScheduler) sendDailyDigest(ctx context.Context, userID uuid.UUID, userTimezone string, forms []digestForm) error {
	if len(forms) == 0 {
		return nil // No forms with new responses
	}

	// Get user email
	user, err := s.db.Queries.GetFormUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if user.Email == "" {
		return fmt.Errorf("user has no email address")
	}

	// For each form, count new responses since last sent
	for _, form := range forms {
		// Get the last sent time from daily_notification_log
		lastSentAt, _ := s.getLastSentTime(ctx, form.ID, userID)

		// Count new responses since last sent
		newResponses, err := s.countNewResponses(ctx, form.ID, lastSentAt)
		if err != nil {
			log.Printf("Failed to count new responses for form %s: %v", form.ID, err)
			continue
		}

		if newResponses == 0 {
			continue // No new responses, skip this form
		}

		// Send notification email
		dashboardURL := fmt.Sprintf("/dashboard/forms/%s/responses", form.ID)
		err = s.emailSender.SendNewResponseNotification(ctx, email.NotificationRequest{
			ToEmail:       user.Email,
			FormName:      form.Title,
			ResponseCount: newResponses,
			IsDaily:       true,
			DashboardURL:  dashboardURL,
		})
		if err != nil {
			log.Printf("Failed to send daily digest for form %s: %v", form.ID, err)
			continue
		}

		// Update last sent time
		_ = s.updateLastSentTime(ctx, form.ID, userID, newResponses)
	}

	return nil
}

// digestForm represents a form with daily notification enabled
type digestForm struct {
	ID    uuid.UUID
	Title string
}

// getLastSentTime gets the last sent time for a form's daily notification
func (s *DailyDigestScheduler) getLastSentTime(ctx context.Context, formID, userID uuid.UUID) (time.Time, error) {
	// Query daily_notification_log table
	// TODO: Implement this query in SQLC
	return time.Time{}.AddDate(-1, 0, 0), nil // Default: 24 hours ago
}

// countNewResponses counts the number of new responses since a given time
func (s *DailyDigestScheduler) countNewResponses(ctx context.Context, formID uuid.UUID, since time.Time) (int, error) {
	// Count responses where completed = true and submitted_at > since
	// TODO: Implement this query in SQLC
	return 0, nil
}

// updateLastSentTime updates the last sent time for a form's daily notification
func (s *DailyDigestScheduler) updateLastSentTime(ctx context.Context, formID, userID uuid.UUID, responseCount int) error {
	// Insert or update daily_notification_log table
	// TODO: Implement this query in SQLC
	return nil
}
