package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// WeladeeUserClaims represents the user claims stored in Redis
type WeladeeUserClaims struct {
	UserID      int    `json:"user_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	ExpiresAt   int64  `json:"exp"`
}

// RedisTokenValidator validates tokens against Weladee Redis
type RedisTokenValidator struct {
	client *redis.Client
	prefix string
}

// NewRedisTokenValidator creates a new Redis token validator
func NewRedisTokenValidator(redisURL, keyPrefix string) (*RedisTokenValidator, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &RedisTokenValidator{
		client: client,
		prefix: keyPrefix,
	}, nil
}

// ValidateToken validates a token and returns the user claims
func (r *RedisTokenValidator) ValidateToken(ctx context.Context, token string) (*WeladeeUserClaims, error) {
	key := fmt.Sprintf("%s:%s", r.prefix, token)

	data, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("token not found or expired")
	}
	if err != nil {
		return nil, fmt.Errorf("redis error: %w", err)
	}

	var claims WeladeeUserClaims
	if err := json.Unmarshal([]byte(data), &claims); err != nil {
		return nil, fmt.Errorf("invalid token data: %w", err)
	}

	// Check expiration
	if claims.ExpiresAt > 0 && time.Now().Unix() > claims.ExpiresAt {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}

// Close closes the Redis connection
func (r *RedisTokenValidator) Close() error {
	return r.client.Close()
}
