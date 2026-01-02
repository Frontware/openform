package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/weladee/weladee-form/internal/auth"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/gapi"
	"github.com/weladee/weladee-form/internal/storage"
	pb "github.com/weladee/weladee-form/proto/pb"
)

type Config struct {
	GRPCPort    string
	DatabaseURL string
	RedisURL    string
	RedisPrefix string

	// S3 Configuration
	S3Region     string
	S3Bucket     string
	S3AccessKey  string
	S3SecretKey  string
	S3Endpoint   string
}

func loadConfig() *Config {
	return &Config{
		GRPCPort:     getEnv("GRPC_PORT", "50051"),
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379"),
		RedisPrefix:  getEnv("REDIS_KEY_PREFIX", "weladee:auth:token"),
		S3Region:     getEnv("S3_REGION", "auto"),
		S3Bucket:     getEnv("S3_BUCKET", ""),
		S3AccessKey:  getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey:  getEnv("S3_SECRET_KEY", ""),
		S3Endpoint:   getEnv("S3_ENDPOINT", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	cfg := loadConfig()

	// Validate required environment variables
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// Connect to PostgreSQL
	dbPool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	database := db.NewDatabase(dbPool)
	log.Println("✓ Connected to PostgreSQL")

	// Connect to Redis
	tokenValidator, err := auth.NewRedisTokenValidator(cfg.RedisURL, cfg.RedisPrefix)
	if err != nil {
		log.Fatalf("Failed to setup Redis: %v", err)
	}
	defer tokenValidator.Close()
	log.Println("✓ Connected to Redis")

	// Setup S3 storage
	var s3Storage *storage.S3Storage
	if cfg.S3Bucket != "" {
		s3Storage, err = storage.NewS3Storage(storage.S3Config{
			Region:    cfg.S3Region,
			Bucket:    cfg.S3Bucket,
			AccessKey: cfg.S3AccessKey,
			SecretKey: cfg.S3SecretKey,
			Endpoint:  cfg.S3Endpoint,
		})
		if err != nil {
			log.Fatalf("Failed to setup S3 storage: %v", err)
		}
		log.Println("✓ Connected to S3")
	} else {
		log.Println("⚠ S3 not configured, file uploads will be disabled")
	}

	// Create gRPC server with auth interceptor
	authInterceptor := auth.NewAuthInterceptor(tokenValidator)

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(authInterceptor.Unary()),
		grpc.StreamInterceptor(authInterceptor.Stream()),
		grpc.MaxRecvMsgSize(10*1024*1024), // 10MB for file uploads
	)

	// Register services
	formServer := gapi.NewFormServer(database, s3Storage)
	responseServer := gapi.NewResponseServer(database)
	fileServer := gapi.NewFileServer(database, s3Storage)

	// Register services with the gRPC server
	pb.RegisterFormServiceServer(grpcServer, formServer)
	pb.RegisterResponseServiceServer(grpcServer, responseServer)
	pb.RegisterFileServiceServer(grpcServer, fileServer)

	log.Println("✓ gRPC services registered")

	// Enable reflection for development tools
	reflection.Register(grpcServer)

	// Start server
	listener, err := net.Listen("tcp", fmt.Sprintf(":%s", cfg.GRPCPort))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	log.Printf("🚀 Weladee Form gRPC server starting on port %s", cfg.GRPCPort)

	// Graceful shutdown
	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("Failed to serve: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	grpcServer.GracefulStop()

	// Wait for graceful shutdown or timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try to shutdown the database connection
	dbPool.Close()
	if ctx.Err() == context.DeadlineExceeded {
		log.Println("Warning: database shutdown timed out")
	}

	log.Println("✓ Server stopped")
}
