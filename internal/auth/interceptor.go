package auth

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type contextKey string

const (
	UserClaimsKey contextKey = "user_claims"
)

// AuthInterceptor provides authentication for gRPC methods
type AuthInterceptor struct {
	validator     *JWTValidator
	publicMethods map[string]bool
}

// NewAuthInterceptor creates a new auth interceptor
func NewAuthInterceptor(validator *JWTValidator) *AuthInterceptor {
	// Methods that don't require authentication
	publicMethods := map[string]bool{
		"/weladee.form.v1.FormService/GetFormBySlug":     true, // Public forms
		"/weladee.form.v1.ResponseService/SubmitResponse": true, // Allow anonymous responses
	}

	return &AuthInterceptor{
		validator:     validator,
		publicMethods: publicMethods,
	}
}

// Unary returns a unary server interceptor for authentication
func (i *AuthInterceptor) Unary() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		// Check if method requires authentication
		if i.publicMethods[info.FullMethod] {
			return handler(ctx, req)
		}

		// Extract and validate token
		claims, err := i.authenticate(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Unauthenticated, "authentication failed: %v", err)
		}

		// Add claims to context
		ctx = context.WithValue(ctx, UserClaimsKey, claims)

		return handler(ctx, req)
	}
}

// Stream returns a stream server interceptor for authentication
func (i *AuthInterceptor) Stream() grpc.StreamServerInterceptor {
	return func(
		srv interface{},
		stream grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		// Check if method requires authentication
		if i.publicMethods[info.FullMethod] {
			return handler(srv, stream)
		}

		// Extract and validate token
		claims, err := i.authenticate(stream.Context())
		if err != nil {
			return status.Errorf(codes.Unauthenticated, "authentication failed: %v", err)
		}

		// Create new context with claims
		ctx := context.WithValue(stream.Context(), UserClaimsKey, claims)
		wrappedStream := &wrappedServerStream{
			ServerStream: stream,
			ctx:          ctx,
		}

		return handler(srv, wrappedStream)
	}
}

// authenticate extracts and validates the token from context
func (i *AuthInterceptor) authenticate(ctx context.Context) (*WeladeeUserClaims, error) {
	// First try to get token from Authorization header
	md, ok := metadata.FromIncomingContext(ctx)
	if ok {
		values := md.Get("authorization")
		if len(values) > 0 {
			authHeader := values[0]
			if strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				return i.validator.ValidateToken(token)
			}
		}
	}

	// If no token in header, try to get from URL parameters
	// This allows JWT tokens to be passed in URLs like ?token=eyJ...
	// Note: This requires the token to be passed via metadata or context
	// For URL parameters, we would need to extract them at the HTTP level
	// and add them to metadata before reaching here

	return nil, fmt.Errorf("no valid authorization token found")
}

// GetUserClaims extracts user claims from context
func GetUserClaims(ctx context.Context) (*WeladeeUserClaims, error) {
	claims, ok := ctx.Value(UserClaimsKey).(*WeladeeUserClaims)
	if !ok {
		return nil, fmt.Errorf("no user claims in context")
	}
	return claims, nil
}

// wrappedServerStream wraps a ServerStream with a modified context
type wrappedServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

// Context returns the modified context
func (w *wrappedServerStream) Context() context.Context {
	return w.ctx
}
