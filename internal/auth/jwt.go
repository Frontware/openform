package auth

import (
	"crypto/rsa"
	"fmt"
	"log"
	"os"
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
	secret    []byte
	publicKey *rsa.PublicKey
}

// NewJWTValidator creates a new JWT validator
func NewJWTValidator(secret string, publicKeyPath string) *JWTValidator {
	if secret == "" {
		secret = "weladee-form-secret-change-in-production"
	}

	validator := &JWTValidator{
		secret: []byte(secret),
	}

	if publicKeyPath != "" {
		keyBytes, err := os.ReadFile(publicKeyPath)
		if err != nil {
			log.Printf("⚠️ Failed to read JWT public key: %v", err)
		} else {
			publicKey, err := jwt.ParseRSAPublicKeyFromPEM(keyBytes)
			if err != nil {
				log.Printf("⚠️ Failed to parse JWT public key: %v", err)
			} else {
				validator.publicKey = publicKey
				log.Println("✓ JWT asymmetric validation enabled (RS256)")
			}
		}
	}

	return validator
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
		// Check for RS256 first
		if _, ok := token.Method.(*jwt.SigningMethodRSA); ok {
			if j.publicKey != nil {
				return j.publicKey, nil
			}
			return nil, fmt.Errorf("RS256 token received but no public key configured")
		}

		// Fallback to HMAC
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); ok {
			return j.secret, nil
		}

		return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
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
func GenerateToken(userID int, email, displayName, role string, secret string, privateKeyPath string, expiration time.Duration) (string, error) {
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

	// Try RS256 if private key is provided
	if privateKeyPath != "" {
		keyBytes, err := os.ReadFile(privateKeyPath)
		if err != nil {
			return "", fmt.Errorf("failed to read private key: %w", err)
		}

		privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(keyBytes)
		if err != nil {
			return "", fmt.Errorf("failed to parse private key: %w", err)
		}

		token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
		return token.SignedString(privateKey)
	}

	// Fallback to HS256
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
