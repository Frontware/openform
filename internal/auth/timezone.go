// Copyright (c) 2025 Frontware International Co.,Ltd.
// All rights reserved.

package auth

import (
	"time"
)

const (
	// DefaultTimezone is the default timezone for users (Asia/Bangkok = UTC+7)
	DefaultTimezone = "Asia/Bangkok"
)

// WeladeeUser represents user claims from JWT token
type WeladeeUser struct {
	UserID       int64
	Email        string
	DisplayName  string
	Role         string
	CustomerType string
	Language     string
	Timezone     string // IANA timezone (e.g., "Asia/Bangkok", "America/New_York")
	LogoURL      string
	RedirectURL  string
}

// GetUserTimezone returns the user's timezone from JWT claims, defaulting to Asia/Bangkok (UTC+7)
func GetUserTimezone(user *WeladeeUser) *time.Location {
	if user == nil || user.Timezone == "" {
		return mustLoadLocation(DefaultTimezone)
	}
	loc, err := time.LoadLocation(user.Timezone)
	if err != nil {
		// If invalid timezone, fall back to default
		return mustLoadLocation(DefaultTimezone)
	}
	return loc
}

// ConvertToUserTimezone converts a time to the user's timezone
func ConvertToUserTimezone(t time.Time, user *WeladeeUser) time.Time {
	return t.In(GetUserTimezone(user))
}

// IsUser9AM checks if the given time is 9:00 AM in the user's timezone (within the same hour)
func IsUser9AM(t time.Time, user *WeladeeUser) bool {
	userTime := ConvertToUserTimezone(t, user)
	return userTime.Hour() == 9
}

// GetStartOfDayInUserTimezone returns the start of the day (00:00:00) in the user's timezone
func GetStartOfDayInUserTimezone(t time.Time, user *WeladeeUser) time.Time {
	loc := GetUserTimezone(user)
	year, month, day := t.In(loc).Date()
	return time.Date(year, month, day, 0, 0, 0, 0, loc)
}

// GetEndOfDayInUserTimezone returns the end of the day (23:59:59.999...) in the user's timezone
func GetEndOfDayInUserTimezone(t time.Time, user *WeladeeUser) time.Time {
	loc := GetUserTimezone(user)
	year, month, day := t.In(loc).Date()
	return time.Date(year, month, day, 23, 59, 59, 999999999, loc)
}

// GetPrevious9AMInUserTimezone returns the most recent 9:00 AM in the user's timezone
func GetPrevious9AMInUserTimezone(t time.Time, user *WeladeeUser) time.Time {
	loc := GetUserTimezone(user)
	year, month, day := t.In(loc).Date()
	return time.Date(year, month, day, 9, 0, 0, 0, loc)
}

// GetNext9AMInUserTimezone returns the next 9:00 AM in the user's timezone
func GetNext9AMInUserTimezone(t time.Time, user *WeladeeUser) time.Time {
	loc := GetUserTimezone(user)
	year, month, day := t.In(loc).Date()
	next9AM := time.Date(year, month, day, 9, 0, 0, 0, loc)

	// If we're past 9AM today, return tomorrow's 9AM
	if t.After(next9AM) {
		return next9AM.Add(24 * time.Hour)
	}
	return next9AM
}

// Has9AMPassedInUserTimezone checks if 9:00 AM has passed today in the user's timezone
func Has9AMPassedInUserTimezone(t time.Time, user *WeladeeUser) bool {
	loc := GetUserTimezone(user)
	year, month, day := t.In(loc).Date()
	today9AM := time.Date(year, month, day, 9, 0, 0, 0, loc)
	return t.After(today9AM)
}

// IsWithin9AMWindowInUserTimezone checks if current time is within 9:00-9:59 AM in the user's timezone
// This is useful for triggering daily digest emails at the right time
func IsWithin9AMWindowInUserTimezone(t time.Time, user *WeladeeUser) bool {
	loc := GetUserTimezone(user)
	year, month, day := t.In(loc).Date()
	windowStart := time.Date(year, month, day, 9, 0, 0, 0, loc)
	windowEnd := time.Date(year, month, day, 10, 0, 0, 0, loc)
	return (t.Equal(windowStart) || t.After(windowStart)) && t.Before(windowEnd)
}

// mustLoadLocation loads a timezone location, panicking on error
func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		// This should never happen with valid IANA timezone names
		panic(err)
	}
	return loc
}
