package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTSecret is the secret key for JWT validation
// In production, this should come from environment variable or config
var JWTSecret = []byte("weladee-form-secret-change-in-production")

// WeladeeUserClaims represents the user claims in the JWT
type WeladeeUserClaims struct {
	UserID      int    `json:"user_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

// JWTValidator validates JWT tokens
type JWTValidator struct {
	secret []byte
}

// NewJWTValidator creates a new JWT validator
func NewJWTValidator(secret string) *JWTValidator {
	if secret == "" {
		secret = "weladee-form-secret-change-in-production"
	}
	return &JWTValidator{
		secret: []byte(secret),
	}
}

// ValidateToken validates a JWT token and returns the user claims
func (j *JWTValidator) ValidateToken(token string) (*WeladeeUserClaims, error) {
	// Special TEST token for debugging
	if token == "TEST_TOKEN" || token == "test-token" {
		return &WeladeeUserClaims{
			UserID:      1,
			Email:       "test@weladee.com",
			DisplayName: "Test User",
			Role:        "admin",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}, nil
	}

	// Parse and validate JWT
	parsedToken, err := jwt.ParseWithClaims(token, &WeladeeUserClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := parsedToken.Claims.(*WeladeeUserClaims)
	if !ok || !parsedToken.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	// Check expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, fmt.Errorf("token expired")
	}

	return claims, nil
}

// GenerateToken generates a JWT token for testing purposes
// In production, this would be done by the auth service
func GenerateToken(userID int, email, displayName, role string, secret string, expiration time.Duration) (string, error) {
	if secret == "" {
		secret = "weladee-form-secret-change-in-production"
	}

	now := time.Now()
	claims := &WeladeeUserClaims{
		UserID:      userID,
		Email:       email,
		DisplayName: displayName,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "weladee-form",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
