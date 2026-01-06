// Copyright (c) 2025 Frontware International Co.,Ltd.
// All rights reserved.

package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"embed"
	"fmt"
	"html/template"
	"net"
	"net/mail"
	"net/smtp"
	"time"

	"github.com/weladee/weladee-form/config"
)

//go:embed templates/*.html
var templatesFS embed.FS

// EmailSender handles email sending with SMTP
type EmailSender struct {
	config          config.SMTPConfig
	notificationTpl *template.Template
}

// NewEmailSender creates a new email sender
func NewEmailSender(cfg config.SMTPConfig) (*EmailSender, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	// Parse notification template
	notificationTpl, err := template.New("notification").ParseFS(templatesFS, "templates/notification.html")
	if err != nil {
		return nil, fmt.Errorf("failed to parse notification template: %w", err)
	}

	return &EmailSender{
		config:          cfg,
		notificationTpl: notificationTpl,
	}, nil
}

// IsEnabled returns true if email sending is enabled
func (s *EmailSender) IsEnabled() bool {
	return s != nil && s.config.Enabled
}

// SendNewResponseNotification sends an email notification for a new form response
func (s *EmailSender) SendNewResponseNotification(ctx context.Context, req NotificationRequest) error {
	if !s.IsEnabled() {
		return nil // Silently skip if not enabled
	}

	// Prepare template data
	data := map[string]interface{}{
		"FormName":     req.FormName,
		"ResponseCount": req.ResponseCount,
		"IsDaily":      req.IsDaily,
		"DashboardURL": req.DashboardURL,
		"Year":         time.Now().Year(),
	}

	// Execute template
	var body string
	tmpl := s.notificationTpl
	if req.IsDaily {
		// For daily digest
		bodyBuf, err := executeTemplateToBuffer(tmpl, data)
		if err != nil {
			return fmt.Errorf("failed to execute template: %w", err)
		}
		body = bodyBuf.String()
	} else {
		// For immediate notification
		bodyBuf, err := executeTemplateToBuffer(tmpl, data)
		if err != nil {
			return fmt.Errorf("failed to execute template: %w", err)
		}
		body = bodyBuf.String()
	}

	// Compose email
	subject := fmt.Sprintf("New Response Received: %s", req.FormName)
	if req.IsDaily {
		subject = fmt.Sprintf("Daily Digest: %s", req.FormName)
	}

	// Send email
	return s.sendEmail(ctx, req.ToEmail, subject, body)
}

// NotificationRequest contains data for sending a notification email
type NotificationRequest struct {
	ToEmail       string
	FormName      string
	ResponseCount int
	IsDaily       bool
	DashboardURL  string
}

// sendEmail sends an email via SMTP
func (s *EmailSender) sendEmail(ctx context.Context, to, subject, htmlBody string) error {
	// Validate email address
	if _, err := mail.ParseAddress(to); err != nil {
		return fmt.Errorf("invalid recipient email address: %w", err)
	}

	// Validate from address
	fromAddr := mail.Address{
		Name:    s.config.FromName,
		Address: s.config.FromAddress,
	}

	// Compose message
	headers := map[string]string{
		"From":                      fromAddr.String(),
		"To":                        to,
		"Subject":                   subject,
		"MIME-Version":              "1.0",
		"Content-Type":              `text/html; charset="UTF-8"`,
		"Content-Transfer-Encoding": "base64",
	}

	// Build message
	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	// Send email
	if err := s.sendViaSMTP(ctx, []string{to}, []byte(message)); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// sendViaSMTP sends an email via SMTP
func (s *EmailSender) sendViaSMTP(ctx context.Context, to []string, message []byte) error {
	// SMTP server address
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

	// Dial TCP connection with timeout
	var conn net.Conn
	var err error
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err = dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, s.config.Host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Quit()

	// Enable TLS if available
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName: s.config.Host,
			MinVersion: tls.VersionTLS12,
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("failed to start TLS: %w", err)
		}
	}

	// Authenticate
	auth := smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.Host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Set sender
	if err := client.Mail(s.config.FromAddress); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	// Set recipients
	for _, addr := range to {
		if err := client.Rcpt(addr); err != nil {
			return fmt.Errorf("failed to set recipient %s: %w", addr, err)
		}
	}

	// Send message
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to get data writer: %w", err)
	}
	defer writer.Close()

	_, err = writer.Write(message)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

// executeTemplateToBuffer executes a template and returns the result as a string
func executeTemplateToBuffer(tmpl *template.Template, data interface{}) (*bytes.Buffer, error) {
	buf := &bytes.Buffer{}
	if err := tmpl.Execute(buf, data); err != nil {
		return nil, err
	}
	return buf, nil
}
