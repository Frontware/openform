package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/rs/cors"
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

	// Wrap gRPC server with gRPC-Web middleware
	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool { return true }), // Allow all origins for now
	)

	// Setup CORS
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // Allow all origins for dev
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	// Create HTTP handler
	httpHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if wrappedGrpc.IsGrpcWebRequest(r) || wrappedGrpc.IsAcceptableGrpcCorsRequest(r) {
			wrappedGrpc.ServeHTTP(w, r)
		} else {
			// Handle embedded static files (when built with embed tag)
			if strings.HasPrefix(r.URL.Path, "/_next/") ||
			   strings.HasPrefix(r.URL.Path, "/static/") ||
			   r.URL.Path == "/" ||
			   strings.HasPrefix(r.URL.Path, "/f/") ||
			   strings.HasPrefix(r.URL.Path, "/dashboard") ||
			   strings.HasPrefix(r.URL.Path, "/login") ||
			   strings.HasPrefix(r.URL.Path, "/en/") ||
			   strings.HasPrefix(r.URL.Path, "/fr/") ||
			   strings.HasPrefix(r.URL.Path, "/th/") {
				serveEmbeddedFiles(w, r)
				return
			}

			// Fallback to standard gRPC if needed, or handle other HTTP requests
			// Since we can't easily multiplex standard gRPC on the same port with this setup
			// without cmux, we'll assume this port is primarily for gRPC-Web/HTTP.
			// Standard gRPC clients might need a separate port or cmux.
			// For simplicity in this migration, we serve gRPC-Web.
			w.WriteHeader(http.StatusNotFound)
		}
	})

	// Start HTTP server
	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.GRPCPort),
		Handler: corsHandler.Handler(httpHandler),
	}

	log.Printf("🚀 Weladee Form gRPC-Web server starting on port %s", cfg.GRPCPort)

	// Graceful shutdown
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Failed to serve: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
	
	grpcServer.GracefulStop()

	// Try to shutdown the database connection
	dbPool.Close()
	
	log.Println("✓ Server stopped")
	return nil
}

// serveEmbeddedFiles serves embedded static files when built with embed tag
func serveEmbeddedFiles(w http.ResponseWriter, r *http.Request) {
	// This function is only available when built with the embed tag
	// When not built with embed, this will return 404
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("Static files not available - server not built with embedded client"))
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
