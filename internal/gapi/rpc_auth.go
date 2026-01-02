package gapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/smtp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/weladee/weladee-form/internal/auth"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/proto/pb"
)

// AuthServer implements the AuthService
type AuthServer struct {
	pb.UnimplementedAuthServiceServer
	db           *db.Database
	redisClient  *redis.Client
	config       *Config
	jwtSecret    []byte
	tokenPrefix  string
	smtpHost     string
	smtpPort     string
	smtpUsername string
	smtpPassword string
	smtpFrom     string
}

// Config holds authentication configuration
type Config struct {
	GoogleClientID     string
	GoogleClientSecret string
	OAuthRedirectURL   string
	JWTSecret          string
	TokenPrefix        string
	SMTPHost           string
	SMTPPort           string
	SMTPUsername       string
	SMTPPassword       string
	SMTPFrom           string
}

// NewAuthServer creates a new auth server
func NewAuthServer(database *db.Database, redisClient *redis.Client, config *Config) *AuthServer {
	return &AuthServer{
		db:           database,
		redisClient:  redisClient,
		config:       config,
		jwtSecret:    []byte(config.JWTSecret),
		tokenPrefix:  config.TokenPrefix,
		smtpHost:     config.SMTPHost,
		smtpPort:     config.SMTPPort,
		smtpUsername: config.SMTPUsername,
		smtpPassword: config.SMTPPassword,
		smtpFrom:     config.SMTPFrom,
	}
}

// SendMagicLink sends a magic link email for authentication
func (s *AuthServer) SendMagicLink(ctx context.Context, req *pb.SendMagicLinkRequest) (*pb.SendMagicLinkResponse, error) {
	if req.Email == "" {
		return nil, status.Error(codes.InvalidArgument, "email is required")
	}

	// Generate a secure token
	token, err := generateSecureToken()
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate token")
	}

	// Store token in Redis with email (expires in 15 minutes)
	key := fmt.Sprintf("%s:magic:%s", s.tokenPrefix, token)
	err = s.redisClient.Set(ctx, key, req.Email, 15*time.Minute).Err()
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to store token")
	}

	// Send email
	err = s.sendMagicLinkEmail(req.Email, token)
	if err != nil {
		// Clean up token on email failure
		s.redisClient.Del(ctx, key)
		return nil, status.Error(codes.Internal, "failed to send email")
	}

	return &pb.SendMagicLinkResponse{
		Success: true,
		Message: "Magic link sent successfully",
	}, nil
}

// HandleOAuthCallback handles OAuth callback from providers like Google
func (s *AuthServer) HandleOAuthCallback(ctx context.Context, req *pb.HandleOAuthCallbackRequest) (*pb.HandleOAuthCallbackResponse, error) {
	if req.Provider == "" || req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "provider and code are required")
	}

	switch req.Provider {
	case "google":
		return s.handleGoogleOAuth(ctx, req.Code, req.State)
	default:
		return nil, status.Error(codes.InvalidArgument, "unsupported provider")
	}
}

// ValidateToken validates an access token and returns user information
func (s *AuthServer) ValidateToken(ctx context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResponse, error) {
	if req.Token == "" {
		return &pb.ValidateTokenResponse{Valid: false}, nil
	}

	// Parse and validate JWT token
	token, err := jwt.ParseWithClaims(req.Token, &auth.WeladeeUserClaims{}, func(token *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})
	if err != nil {
		return &pb.ValidateTokenResponse{Valid: false}, nil
	}

	if claims, ok := token.Claims.(*auth.WeladeeUserClaims); ok && token.Valid {
		user := &pb.UserProfile{
			Id:          int32(claims.UserID),
			Email:       claims.Email,
			DisplayName: claims.DisplayName,
		}

		return &pb.ValidateTokenResponse{
			Valid:     true,
			User:      user,
			ExpiresAt: claims.ExpiresAt,
		}, nil
	}

	return &pb.ValidateTokenResponse{Valid: false}, nil
}

// GetUserSession retrieves the current user session
func (s *AuthServer) GetUserSession(ctx context.Context, req *pb.GetUserSessionRequest) (*pb.GetUserSessionResponse, error) {
	validation, err := s.ValidateToken(ctx, &pb.ValidateTokenRequest{Token: req.Token})
	if err != nil {
		return nil, err
	}

	if !validation.Valid {
		return &pb.GetUserSessionResponse{Valid: false}, nil
	}

	return &pb.GetUserSessionResponse{
		Valid:        true,
		User:         validation.User,
		AccessToken:  req.Token,
		ExpiresAt:    validation.ExpiresAt,
	}, nil
}

// Helper functions

func generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (s *AuthServer) sendMagicLinkEmail(email, token string) error {
	// Create magic link URL (frontend URL)
	magicLink := fmt.Sprintf("%s/auth/magic?token=%s", s.config.OAuthRedirectURL, token)

	// Email content
	subject := "Your Magic Link - Weladee Form"
	body := fmt.Sprintf(`Hi there,

Click the link below to sign in to Weladee Form:

%s

This link will expire in 15 minutes.

If you didn't request this link, please ignore this email.

Best,
Weladee Form Team`, magicLink)

	// SMTP configuration
	auth := smtp.PlainAuth("", s.smtpUsername, s.smtpPassword, s.smtpHost)
	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)

	// Create message
	msg := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", email, subject, body))

	// Send email
	err := smtp.SendMail(addr, auth, s.smtpFrom, []string{email}, msg)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

func (s *AuthServer) handleGoogleOAuth(ctx context.Context, code, state string) (*pb.HandleOAuthCallbackResponse, error) {
	// This is a simplified implementation
	// In a real implementation, you would:
	// 1. Exchange the authorization code for an access token
	// 2. Use the access token to fetch user information from Google
	// 3. Create or update user in database
	// 4. Generate JWT tokens

	// For now, return a mock response
	user := &pb.UserProfile{
		Id:          1,
		Email:       "user@example.com",
		DisplayName: "Example User",
	}

	// Generate JWT token
	claims := &auth.WeladeeUserClaims{
		UserID:      1,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		ExpiresAt:   time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate token")
	}

	return &pb.HandleOAuthCallbackResponse{
		AccessToken: tokenString,
		ExpiresAt:   claims.ExpiresAt,
		User:        user,
	}, nil
}
