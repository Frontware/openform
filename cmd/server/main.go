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
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"

	"github.com/weladee/weladee-form/config"
	"github.com/weladee/weladee-form/internal/auth"
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/gapi"
	"github.com/weladee/weladee-form/internal/storage"
	pb "github.com/weladee/weladee-form/proto/pb"
)

func main() {
	var rootCmd = &cobra.Command{
		Use:   "weladee-form",
		Short: "Weladee Form Server",
		RunE: func(cmd *cobra.Command, args []string) error {
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
				// Handle /api/upload
				if r.Method == http.MethodPost && r.URL.Path == "/api/upload" {
					if s3Storage == nil {
						w.WriteHeader(http.StatusServiceUnavailable)
						fmt.Fprintf(w, `{"error": "Storage not configured"}`)
						return
					}

					// Max 10MB
					r.ParseMultipartForm(10 << 20)
					file, handler, err := r.FormFile("file")
					if err != nil {
						w.WriteHeader(http.StatusBadRequest)
						fmt.Fprintf(w, `{"error": "Failed to get file: %v"}`, err)
						return
					}
					defer file.Close()

					// Upload to S3
					key := fmt.Sprintf("uploads/%d-%s", time.Now().Unix(), handler.Filename)
					_, fileURL, err := s3Storage.UploadFileReader(r.Context(), key, handler.Header.Get("Content-Type"), file)
					if err != nil {
						w.WriteHeader(http.StatusInternalServerError)
						fmt.Fprintf(w, `{"error": "Upload failed: %v"}`, err)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					fmt.Fprintf(w, `{"success": true, "url": "%s", "file": {"name": "%s", "type": "%s", "size": %d}}`,
						fileURL, handler.Filename, handler.Header.Get("Content-Type"), handler.Size)
					return
				}

				if wrappedGrpc.IsGrpcWebRequest(r) || wrappedGrpc.IsAcceptableGrpcCorsRequest(r) {
					// Check for JWT token in URL parameters and add to metadata
					if token := r.URL.Query().Get("token"); token != "" {
						// Add token to gRPC metadata for authentication
						md := metadata.MD{}
						if existingMd, ok := metadata.FromIncomingContext(r.Context()); ok {
							md = existingMd.Copy()
						}
						md.Set("authorization", "Bearer "+token)
						ctx := metadata.NewIncomingContext(r.Context(), md)
						r = r.WithContext(ctx)
					}
					wrappedGrpc.ServeHTTP(w, r)
				} else {
					// Redirect root to default locale
					if r.URL.Path == "/" {
						http.Redirect(w, r, "/en/", http.StatusFound)
						return
					}

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
					w.WriteHeader(http.StatusNotFound)
				}
			})

			// Start HTTP server
			httpServer := &http.Server{
				Addr:    fmt.Sprintf(":%s", cfg.GRPCPort),
				Handler: corsHandler.Handler(httpHandler),
			}

			log.Printf("🚀 Weladee Form server starting on port %s", cfg.GRPCPort)
			log.Printf("🔗 Client application: http://localhost:%s/?token=TEST", cfg.GRPCPort)
			log.Printf("📡 gRPC-Web API: http://localhost:%s", cfg.GRPCPort)

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
		},
	}

	config.AddFlags(rootCmd)

	if err := rootCmd.Execute(); err != nil {
		log.Fatalf("Failed to execute command: %v", err)
	}
}