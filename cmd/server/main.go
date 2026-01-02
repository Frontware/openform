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

	"github.com/spf13/cobra"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/weladee/weladee-form/config"
	"github.com/weladee/weladee-form/internal/auth"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/gapi"
	"github.com/weladee/weladee-form/internal/storage"
	pb "github.com/weladee/weladee-form/proto/pb"
)

func runServer(cmd *cobra.Command, args []string) error {
	cfg, err := config.LoadConfig(cmd)
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Connect to PostgreSQL
	dbPool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer dbPool.Close()

	database := db.NewDatabase(dbPool)
	log.Println("✓ Connected to PostgreSQL")

	// Setup JWT token validator
	tokenValidator := auth.NewJWTValidator(cfg.JWTSecret)
	log.Println("✓ JWT token validator initialized")

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
			return fmt.Errorf("failed to setup S3 storage: %w", err)
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
		return fmt.Errorf("failed to listen: %w", err)
	}

	log.Printf("🚀 Weladee Form gRPC server starting on port %s", cfg.GRPCPort)

	// Graceful shutdown
	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			log.Printf("Failed to serve: %v", err)
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
	return nil
}

func main() {
	var rootCmd = &cobra.Command{
		Use:   "weladee-form",
		Short: "Weladee Form - A beautiful, open-source TypeForm alternative",
		Long: `Weladee Form is a beautiful, open-source TypeForm alternative built with Next.js.
It allows users to create engaging forms with a one-question-at-a-time experience.`,
		RunE: runServer,
	}

	// Add configuration flags
	config.AddFlags(rootCmd)

	if err := rootCmd.Execute(); err != nil {
		log.Fatalf("Failed to execute command: %v", err)
	}
}
