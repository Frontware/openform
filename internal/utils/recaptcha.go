package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/weladee/weladee-form/config"
)

// RecaptchaResponse represents the response from Google reCAPTCHA verification API
type RecaptchaResponse struct {
	Success     bool      `json:"success"`
	ChallengeTS time.Time `json:"challenge_ts"`
	Hostname    string    `json:"hostname"`
	ErrorCodes  []string  `json:"error-codes,omitempty"`
	Score       float64   `json:"score,omitempty"`
	Action      string    `json:"action,omitempty"`
}

// VerifyRecaptcha verifies a reCAPTCHA token against Google's API
func VerifyRecaptcha(token string, clientIP string, cfg config.RecaptchaConfig) (bool, error) {
	// If reCAPTCHA is disabled globally, skip verification
	if !cfg.Enabled {
		return true, nil
	}

	// If no token provided but CAPTCHA is required, fail
	if token == "" {
		return false, fmt.Errorf("reCAPTCHA token is required")
	}

	// Prepare the verification request
	data := fmt.Sprintf("secret=%s&response=%s&remoteip=%s",
		cfg.SecretKey, token, clientIP)

	req, err := http.NewRequest("POST", "https://www.google.com/recaptcha/api/siteverify",
		bytes.NewBufferString(data))
	if err != nil {
		return false, fmt.Errorf("failed to create verification request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Make the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to verify reCAPTCHA: %w", err)
	}
	defer resp.Body.Close()

	// Read and parse the response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read verification response: %w", err)
	}

	var verificationResp RecaptchaResponse
	if err := json.Unmarshal(body, &verificationResp); err != nil {
		return false, fmt.Errorf("failed to parse verification response: %w", err)
	}

	// Check if verification was successful
	if !verificationResp.Success {
		return false, fmt.Errorf("reCAPTCHA verification failed: %v", verificationResp.ErrorCodes)
	}

	// Check score threshold
	if verificationResp.Score < cfg.Threshold {
		return false, fmt.Errorf("reCAPTCHA score %.2f is below threshold %.2f",
			verificationResp.Score, cfg.Threshold)
	}

	return true, nil
}
