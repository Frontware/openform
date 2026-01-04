package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"connectrpc.com/connect"
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
	pbconnect "github.com/weladee/weladee-form/proto/pbconnect"
)

// Adapt gRPC service to Connect interface
type connectFormServiceAdapter struct {
	impl *gapi.FormServerImpl
}

func (a *connectFormServiceAdapter) CreateForm(ctx context.Context, req *connect.Request[pb.CreateFormRequest]) (*connect.Response[pb.CreateFormResponse], error) {
	resp, err := a.impl.CreateForm(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) GetForm(ctx context.Context, req *connect.Request[pb.GetFormRequest]) (*connect.Response[pb.GetFormResponse], error) {
	resp, err := a.impl.GetForm(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) GetFormBySlug(ctx context.Context, req *connect.Request[pb.GetFormBySlugRequest]) (*connect.Response[pb.GetFormBySlugResponse], error) {
	resp, err := a.impl.GetFormBySlug(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) UpdateForm(ctx context.Context, req *connect.Request[pb.UpdateFormRequest]) (*connect.Response[pb.UpdateFormResponse], error) {
	resp, err := a.impl.UpdateForm(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) DeleteForm(ctx context.Context, req *connect.Request[pb.DeleteFormRequest]) (*connect.Response[pb.DeleteFormResponse], error) {
	resp, err := a.impl.DeleteForm(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) ListForms(ctx context.Context, req *connect.Request[pb.ListFormsRequest]) (*connect.Response[pb.ListFormsResponse], error) {
	resp, err := a.impl.ListForms(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) PublishForm(ctx context.Context, req *connect.Request[pb.PublishFormRequest]) (*connect.Response[pb.PublishFormResponse], error) {
	resp, err := a.impl.PublishForm(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) GetFormStats(ctx context.Context, req *connect.Request[pb.GetFormStatsRequest]) (*connect.Response[pb.GetFormStatsResponse], error) {
	resp, err := a.impl.GetFormStats(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) CreateQuestion(ctx context.Context, req *connect.Request[pb.CreateQuestionRequest]) (*connect.Response[pb.CreateQuestionResponse], error) {
	resp, err := a.impl.CreateQuestion(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) UpdateQuestion(ctx context.Context, req *connect.Request[pb.UpdateQuestionRequest]) (*connect.Response[pb.UpdateQuestionResponse], error) {
	resp, err := a.impl.UpdateQuestion(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) DeleteQuestion(ctx context.Context, req *connect.Request[pb.DeleteQuestionRequest]) (*connect.Response[pb.DeleteQuestionResponse], error) {
	resp, err := a.impl.DeleteQuestion(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectFormServiceAdapter) ReorderQuestions(ctx context.Context, req *connect.Request[pb.ReorderQuestionsRequest]) (*connect.Response[pb.ReorderQuestionsResponse], error) {
	resp, err := a.impl.ReorderQuestions(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

// Adapt gRPC ResponseService to Connect interface
type connectResponseServiceAdapter struct {
	impl *gapi.ResponseServerImpl
}

func (a *connectResponseServiceAdapter) SubmitResponse(ctx context.Context, req *connect.Request[pb.SubmitResponseRequest]) (*connect.Response[pb.SubmitResponseResponse], error) {
	resp, err := a.impl.SubmitResponse(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectResponseServiceAdapter) GetResponse(ctx context.Context, req *connect.Request[pb.GetResponseRequest]) (*connect.Response[pb.GetResponseResponse], error) {
	resp, err := a.impl.GetResponse(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectResponseServiceAdapter) ListResponses(ctx context.Context, req *connect.Request[pb.ListResponsesRequest]) (*connect.Response[pb.ListResponsesResponse], error) {
	resp, err := a.impl.ListResponses(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectResponseServiceAdapter) DeleteResponse(ctx context.Context, req *connect.Request[pb.DeleteResponseRequest]) (*connect.Response[pb.DeleteResponseResponse], error) {
	resp, err := a.impl.DeleteResponse(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectResponseServiceAdapter) ExportResponses(ctx context.Context, req *connect.Request[pb.ExportResponsesRequest]) (*connect.Response[pb.ExportResponsesResponse], error) {
	resp, err := a.impl.ExportResponses(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

// Adapt gRPC AnalyticsService to Connect interface
type connectAnalyticsServiceAdapter struct {
	impl *gapi.AnalyticsServerImpl
}

func (a *connectAnalyticsServiceAdapter) GetOverviewStats(ctx context.Context, req *connect.Request[pb.GetOverviewStatsRequest]) (*connect.Response[pb.GetOverviewStatsResponse], error) {
	resp, err := a.impl.GetOverviewStats(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetResponseTrend(ctx context.Context, req *connect.Request[pb.GetResponseTrendRequest]) (*connect.Response[pb.GetResponseTrendResponse], error) {
	resp, err := a.impl.GetResponseTrend(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetDeviceBreakdown(ctx context.Context, req *connect.Request[pb.GetDeviceBreakdownRequest]) (*connect.Response[pb.GetDeviceBreakdownResponse], error) {
	resp, err := a.impl.GetDeviceBreakdown(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetCompletionFunnel(ctx context.Context, req *connect.Request[pb.GetCompletionFunnelRequest]) (*connect.Response[pb.GetCompletionFunnelResponse], error) {
	resp, err := a.impl.GetCompletionFunnel(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetQuestionAnalytics(ctx context.Context, req *connect.Request[pb.GetQuestionAnalyticsRequest]) (*connect.Response[pb.GetQuestionAnalyticsResponse], error) {
	resp, err := a.impl.GetQuestionAnalytics(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetQuestionDropOff(ctx context.Context, req *connect.Request[pb.GetQuestionDropOffRequest]) (*connect.Response[pb.GetQuestionDropOffResponse], error) {
	resp, err := a.impl.GetQuestionDropOff(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetGeographicDistribution(ctx context.Context, req *connect.Request[pb.GetGeographicDistributionRequest]) (*connect.Response[pb.GetGeographicDistributionResponse], error) {
	resp, err := a.impl.GetGeographicDistribution(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) GetTimeDistribution(ctx context.Context, req *connect.Request[pb.GetTimeDistributionRequest]) (*connect.Response[pb.GetTimeDistributionResponse], error) {
	resp, err := a.impl.GetTimeDistribution(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) TrackView(ctx context.Context, req *connect.Request[pb.TrackViewRequest]) (*connect.Response[pb.TrackViewResponse], error) {
	resp, err := a.impl.TrackView(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) TrackResponseStart(ctx context.Context, req *connect.Request[pb.TrackResponseStartRequest]) (*connect.Response[pb.TrackResponseStartResponse], error) {
	resp, err := a.impl.TrackResponseStart(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func (a *connectAnalyticsServiceAdapter) ExportAnalytics(ctx context.Context, req *connect.Request[pb.ExportAnalyticsRequest]) (*connect.Response[pb.ExportAnalyticsResponse], error) {
	resp, err := a.impl.ExportAnalytics(ctx, req.Msg)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(resp), nil
}

func main() {
	var rootCmd = &cobra.Command{
		Use:   "weladee-form",
		Short: "Weladee Form Server",
	}

	// Add serve command (the existing server functionality)
	var serveCmd = &cobra.Command{
		Use:   "serve",
		Short: "Start the Weladee Form server",
		RunE:  runServe,
	}

	config.AddFlags(serveCmd)
	rootCmd.AddCommand(serveCmd)

	// Add create-jwt command
	var createJWTCmd = &cobra.Command{
		Use:   "create-jwt",
		Short: "Create a JWT token for testing/debugging",
		RunE:  runCreateJWT,
	}
	createJWTCmd.Flags().String("name", "", "User display name")
	createJWTCmd.Flags().String("email", "", "User email address")
	rootCmd.AddCommand(createJWTCmd)

	// Add config command
	var configCmd = &cobra.Command{
		Use:   "config",
		Short: "Open configuration file in nano editor",
		Long:  "Opens the config.yaml file in the nano text editor for easy configuration editing.",
		RunE:  runConfig,
	}
	rootCmd.AddCommand(configCmd)

	if err := rootCmd.Execute(); err != nil {
		log.Fatalf("Failed to execute command: %v", err)
	}
}

func runServe(cmd *cobra.Command, args []string) error {
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
	tokenValidator := auth.NewJWTValidator(cfg.JWTSecret, cfg.JWTPublicKeyPath)
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

	// Register services (database mode)
	formServer := gapi.NewFormServer(database, s3Storage)
	responseServer := gapi.NewResponseServer(database, cfg.Recaptcha)
	fileServer := gapi.NewFileServer(database, s3Storage)
	analyticsServer := gapi.NewAnalyticsServer(database)

	// Register services with the gRPC server
	pb.RegisterFormServiceServer(grpcServer, formServer)
	pb.RegisterResponseServiceServer(grpcServer, responseServer)
	pb.RegisterFileServiceServer(grpcServer, fileServer)
	pb.RegisterAnalyticsServiceServer(grpcServer, analyticsServer)

	log.Println("✓ gRPC services registered")

	// Enable reflection for development tools
	reflection.Register(grpcServer)

	// Wrap gRPC server with gRPC-Web middleware
	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool { return true }), // Allow all origins for now
	)

	// Create Connect handlers (supports Connect protocol from @bufbuild/connect)
	// We use adapters to convert between gRPC and Connect interfaces
	formConnectAdapter := &connectFormServiceAdapter{impl: formServer.(*gapi.FormServer).FormServerImpl}
	responseConnectAdapter := &connectResponseServiceAdapter{impl: responseServer.(*gapi.ResponseServer).ResponseServerImpl}
	analyticsConnectAdapter := &connectAnalyticsServiceAdapter{impl: analyticsServer.(*gapi.AnalyticsServer).AnalyticsServerImpl}

	// Create a ServeMux for all Connect handlers
	connectMux := http.NewServeMux()

	// Register FormService handler
	formPath, formHandler := pbconnect.NewFormServiceHandler(
		formConnectAdapter,
		connect.WithInterceptors(auth.NewConnectAuthInterceptor(tokenValidator)),
	)
	connectMux.Handle(formPath, formHandler)
	log.Printf("✓ Connect FormService handler registered at %s", formPath)

	// Register ResponseService handler
	respPath, respHandler := pbconnect.NewResponseServiceHandler(
		responseConnectAdapter,
		connect.WithInterceptors(auth.NewConnectAuthInterceptor(tokenValidator)),
	)
	connectMux.Handle(respPath, respHandler)
	log.Printf("✓ Connect ResponseService handler registered at %s", respPath)

	// Register AnalyticsService handler
	analyticsPath, analyticsHandler := pbconnect.NewAnalyticsServiceHandler(
		analyticsConnectAdapter,
		connect.WithInterceptors(auth.NewConnectAuthInterceptor(tokenValidator)),
	)
	connectMux.Handle(analyticsPath, analyticsHandler)
	log.Printf("✓ Connect AnalyticsService handler registered at %s", analyticsPath)

	// Helper function to check if request is Connect protocol
	isConnectRequest := func(r *http.Request) bool {
		ct := r.Header.Get("Content-Type")
		// Connect protocol content types
		return strings.Contains(ct, "application/connect+") ||
			strings.Contains(ct, "application/json") && r.Method == "POST"
	}

	// Setup CORS
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // Allow all origins for dev
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	// Create HTTP handler
	httpHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle /api/config/recaptcha
		if r.Method == http.MethodGet && r.URL.Path == "/api/config/recaptcha" {
			w.Header().Set("Content-Type", "application/json")
			if cfg.Recaptcha.Enabled {
				fmt.Fprintf(w, `{"siteKey": "%s"}`, cfg.Recaptcha.SiteKey)
			} else {
				w.WriteHeader(http.StatusServiceUnavailable)
				fmt.Fprintf(w, `{"error": "reCAPTCHA not configured"}`)
			}
			return
		}

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

		// Check for Connect protocol requests (must be before gRPC-Web check)
		if isConnectRequest(r) {
			// Extract token from URL and add to context for Connect auth interceptor
			if token := r.URL.Query().Get("token"); token != "" {
				// Create new context with token value that Connect auth interceptor can read
				ctx := context.WithValue(r.Context(), "token", token)
				r = r.WithContext(ctx)
			}
			connectMux.ServeHTTP(w, r)
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
			// Redirect root to default locale, preserving token parameter
			if r.URL.Path == "/" {
				// Preserve query parameters (like ?token=...)
				targetURL := "/en/"
				if r.URL.RawQuery != "" {
					targetURL = "/en/?" + r.URL.RawQuery
				}
				http.Redirect(w, r, targetURL, http.StatusFound)
				return
			}

			// Redirect bare locale paths (e.g., /en -> /en/, /fr -> /fr/), preserving token
			if r.URL.Path == "/en" || r.URL.Path == "/fr" || r.URL.Path == "/th" {
				targetURL := r.URL.Path + "/"
				if r.URL.RawQuery != "" {
					targetURL += "?" + r.URL.RawQuery
				}
				http.Redirect(w, r, targetURL, http.StatusFound)
				return
			}

			// Auto-redirect to default locale for non-static, non-locale paths
			// e.g. /dashboard -> /en/dashboard
			// Exclude known static prefixes and existing locales
			if !strings.HasPrefix(r.URL.Path, "/_next/") &&
				!strings.HasPrefix(r.URL.Path, "/static/") &&
				!strings.HasPrefix(r.URL.Path, "/api/") &&
				!strings.HasPrefix(r.URL.Path, "/f/") && // Public forms
				!strings.HasPrefix(r.URL.Path, "/en/") &&
				!strings.HasPrefix(r.URL.Path, "/fr/") &&
				!strings.HasPrefix(r.URL.Path, "/th/") &&
				!strings.HasSuffix(r.URL.Path, ".ico") &&
				!strings.HasSuffix(r.URL.Path, ".svg") &&
				!strings.HasSuffix(r.URL.Path, ".png") &&
				!strings.HasSuffix(r.URL.Path, ".css") &&
				!strings.HasSuffix(r.URL.Path, ".js") {

				// Check if the localized version exists (optional, but good for safety)
				// For now, just assume any "clean" path without locale is intended for default locale
				target := "/en" + r.URL.Path
				http.Redirect(w, r, target, http.StatusFound)
				return
			}

			// Handle embedded static files (when built with embed tag)
			if strings.HasPrefix(r.URL.Path, "/_next/") ||
				strings.HasPrefix(r.URL.Path, "/static/") ||
				r.URL.Path == "/" ||
				strings.HasPrefix(r.URL.Path, "/f/") ||
				strings.HasPrefix(r.URL.Path, "/dashboard") ||
				strings.HasPrefix(r.URL.Path, "/en/") ||
				strings.HasPrefix(r.URL.Path, "/fr/") ||
				strings.HasPrefix(r.URL.Path, "/th/") ||
				r.URL.Path == "/weladee-logo.png" ||
				r.URL.Path == "/favicon.ico" {
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
	log.Printf("📡 gRPC-Web API: http://localhost:%s", cfg.GRPCPort)
	log.Printf("")

	// Generate a JWT token automatically for development
	secret := cfg.JWTSecret
	if secret == "" {
		secret = "weladee-form-secret-change-in-production"
	}

	token, err := auth.GenerateToken(1, "eric.fairon@gmail.com", "eric", "admin", secret, cfg.JWTPrivateKeyPath, 2*time.Hour)
	if err != nil {
		log.Printf("⚠️ Failed to generate JWT token: %v", err)
		log.Printf("💡 To get a valid JWT token, run: go run ./cmd/server create-jwt")
	} else {
		log.Printf("🔗 Client application: http://localhost:%s/?token=%s", cfg.GRPCPort, token)
		log.Printf("")
		log.Printf("✅ Auto-generated JWT token for eric (expires in 2 hours)")
		log.Printf("💡 To generate a new token, run: go run ./cmd/server create-jwt")
	}

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

func runCreateJWT(cmd *cobra.Command, args []string) error {
	// Get JWT secret from environment or use default
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "weladee-form-secret-change-in-production"
	}

	privateKeyPath := os.Getenv("JWT_PRIVATE_KEY_PATH")

	// Use pre-configured credentials for eric
	name := "eric"
	email := "eric.fairon@gmail.com"

	// Generate JWT token with eric's credentials
	token, err := auth.GenerateToken(1, email, name, "admin", secret, privateKeyPath, 2*time.Hour)
	if err != nil {
		return fmt.Errorf("failed to generate JWT token: %w", err)
	}

	fmt.Println("JWT Token generated successfully for eric:")
	fmt.Println(token)
	if privateKeyPath != "" {
		fmt.Println("Algorithm: RS256 (Asymmetric)")
	} else {
		fmt.Println("Algorithm: HS256 (Symmetric)")
	}
	fmt.Printf("User: %s (%s) - Role: admin\n", name, email)
	fmt.Println("Token expires in 2 hours.")
	return nil
}

func runConfig(cmd *cobra.Command, args []string) error {
	// Check if config.yaml exists
	configFile := "config.yaml"
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		fmt.Printf("Config file %s not found.\n", configFile)
		fmt.Println("You can create one by copying config.example.yaml:")
		fmt.Printf("  cp config.example.yaml %s\n", configFile)
		return nil
	}

	// Try to open with nano first
	editor := "nano"
	cmdExec := exec.Command(editor, configFile)
	cmdExec.Stdin = os.Stdin
	cmdExec.Stdout = os.Stdout
	cmdExec.Stderr = os.Stderr

	if err := cmdExec.Run(); err != nil {
		// If nano is not available, try vim
		fmt.Printf("Failed to open with %s: %v\n", editor, err)
		fmt.Println("Trying with vim...")

		editor = "vim"
		cmdExec = exec.Command(editor, configFile)
		cmdExec.Stdin = os.Stdin
		cmdExec.Stdout = os.Stdout
		cmdExec.Stderr = os.Stderr

		if err := cmdExec.Run(); err != nil {
			// If vim is not available, try vi
			fmt.Printf("Failed to open with %s: %v\n", editor, err)
			fmt.Println("Trying with vi...")

			editor = "vi"
			cmdExec = exec.Command(editor, configFile)
			cmdExec.Stdin = os.Stdin
			cmdExec.Stdout = os.Stdout
			cmdExec.Stderr = os.Stderr

			if err := cmdExec.Run(); err != nil {
				fmt.Printf("Failed to open with %s: %v\n", editor, err)
				fmt.Println("Please install a text editor (nano, vim, or vi) to edit the config file.")
				return fmt.Errorf("failed to open config file with any available editor")
			}
		}
	}

	fmt.Println("Config file closed.")
	return nil
}
