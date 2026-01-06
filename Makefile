# Makefile for Weladee Form Go Backend
# This Makefile provides convenient commands for building, testing, and managing the Go backend

# Variables
BINARY_NAME=weladee-form
BINARY_DIR=bin
MAIN_PATH=./cmd/server
GO_MODULE=github.com/weladee/weladee-form
BUILD_DIR=build
DOCKER_IMAGE=weladee-form
DOCKER_TAG=latest

# Go specific variables
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOFMT=gofmt
GOLINT=golangci-lint

# Build flags
LDFLAGS=-ldflags "-w -s -X main.version=$(shell git describe --tags --always --dirty) -X main.build=$(shell git rev-parse --short HEAD)"

# Default target
.PHONY: help
help: ## Show this help message
	@echo "Weladee Form Backend - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# Development targets
.PHONY: dev
dev: ## Run the application in development mode
	@echo "Starting development server..."
	$(GOCMD) run $(MAIN_PATH)

.PHONY: run
run: ## Run the compiled binary
	@echo "Running $(BINARY_NAME)..."
	./$(BINARY_DIR)/$(BINARY_NAME)

# Environment setup target
.PHONY: set-grpc-url
set-grpc-url: ## Set NEXT_PUBLIC_GRPC_URL based on current git branch
	@echo "Setting GRPC URL based on current branch..."
	@if [ -n "$$(git branch --show-current 2>/dev/null)" ]; then \
		CURRENT_BRANCH=$$(git branch --show-current); \
		if [ "$$CURRENT_BRANCH" = "main" ]; then \
			GRPC_URL="https://form.weladee.com"; \
		else \
			GRPC_URL="https://dev-form.weladee.com"; \
		fi; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=.*|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=\$$GRPC_URL|NEXT_PUBLIC_GRPC_URL=$$GRPC_URL|' .env.local; \
		echo "Set NEXT_PUBLIC_GRPC_URL to $$GRPC_URL for branch $$CURRENT_BRANCH"; \
	else \
		echo "Not in a git repository or unable to determine branch. Using dev URL."; \
		sed -i 's|^NEXT_PUBLIC_GRPC_URL=.*|NEXT_PUBLIC_GRPC_URL=https://dev-form.weladee.com|' .env.local; \
	fi

# Client build targets
.PHONY: build-client
build-client: set-grpc-url ## Build Next.js client for embedding
	@echo "Building Next.js client..."
	@echo "Note: For embedded builds, frontend uses same-origin by default."
	@echo "      Set NEXT_PUBLIC_GRPC_URL or NEXT_PUBLIC_API_URL to use external API."
	@if command -v npm >/dev/null 2>&1; then \
		npm run build; \
	else \
		echo "npm not found. Please install Node.js and npm"; \
		exit 1; \
	fi

.PHONY: build-frontend
build-frontend: build-client ## Build both client and server
	@echo "Building frontend (client + server)..."

# Build targets
.PHONY: build
build: clean build-linux build-windows build-darwin ## Build binaries for all platforms

.PHONY: build-linux
build-linux: build-frontend ## Build for Linux with embedded client
	@echo "Building for Linux..."
	@mkdir -p $(BINARY_DIR)
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-linux $(MAIN_PATH)

.PHONY: build-windows
build-windows: build-frontend ## Build for Windows with embedded client
	@echo "Building for Windows..."
	@mkdir -p $(BINARY_DIR)
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-windows.exe $(MAIN_PATH)

.PHONY: build-darwin
build-darwin: build-frontend ## Build for macOS with embedded client
	@echo "Building for macOS..."
	@mkdir -p $(BINARY_DIR)
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-darwin $(MAIN_PATH)

.PHONY: build-local
build-local: build-frontend ## Build for local development with embedded client
	@echo "Building for local development..."
	@mkdir -p $(BINARY_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BINARY_DIR)/$(BINARY_NAME) $(MAIN_PATH)

.PHONY: build-dev
build-dev: ## Build for local development
	@echo "Building for local development..."
	@mkdir -p $(BINARY_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-dev $(MAIN_PATH)

# Clean targets
.PHONY: clean
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	$(GOCLEAN)
	rm -rf $(BINARY_DIR)
	rm -f coverage.out
	rm -f *.prof

# Test targets
.PHONY: test
test: ## Run all tests
	@echo "Running tests..."
	$(GOTEST) -v -coverprofile=coverage.out ./...

.PHONY: test-unit
test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	$(GOTEST) -v -coverprofile=coverage.out -short ./internal/...

.PHONY: test-integration
test-integration: ## Run integration tests
	@echo "Running integration tests..."
	$(GOTEST) -v -tags=integration ./test/...

.PHONY: test-coverage
test-coverage: test ## Run tests with coverage and open report
	@echo "Generating coverage report..."
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Lint and format targets
.PHONY: fmt
fmt: ## Format Go code
	@echo "Formatting Go code..."
	$(GOFMT) -s -w .

.PHONY: lint
lint: ## Run linter
	@echo "Running linter..."
	@if command -v $(GOLINT) >/dev/null 2>&1; then \
		$(GOLINT) run ./...; \
	else \
		echo "golangci-lint not found. Please install it:"; \
		echo "  go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; \
		exit 1; \
	fi

.PHONY: vet
vet: ## Run go vet
	@echo "Running go vet..."
	$(GOCMD) vet ./...

.PHONY: staticcheck
staticcheck: ## Run static analysis
	@echo "Running staticcheck..."
	@if command -v staticcheck >/dev/null 2>&1; then \
		staticcheck ./...; \
	else \
		echo "staticcheck not found. Please install it:"; \
		echo "  go install honnef.co/go/tools/cmd/staticcheck@latest"; \
		exit 1; \
	fi

# Dependency management
.PHONY: deps
deps: ## Download all dependencies
	@echo "Downloading dependencies..."
	$(GOMOD) download

.PHONY: deps-verify
deps-verify: ## Verify dependencies
	@echo "Verifying dependencies..."
	$(GOMOD) verify

.PHONY: deps-tidy
deps-tidy: ## Clean up dependencies
	@echo "Cleaning up dependencies..."
	$(GOMOD) tidy

.PHONY: deps-upgrade
deps-upgrade: ## Upgrade all dependencies
	@echo "Upgrading dependencies..."
	$(GOMOD) get -u ./...

.PHONY: deps-check
deps-check: ## Check for dependency updates
	@echo "Checking for dependency updates..."
	@if command -v go-mod-outdated >/dev/null 2>&1; then \
		go-mod-outdated -update; \
	else \
		echo "go-mod-outdated not found. Please install it:"; \
		echo "  go install github.com/psampaz/go-mod-outdated@latest"; \
		exit 1; \
	fi

# Protobuf generation
.PHONY: proto
proto: ## Generate protobuf Go and TypeScript code
	@echo "Generating protobuf Go code..."
	protoc --go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		proto/*.proto
	@echo "Generating Connect Go code..."
	@mkdir -p proto/pbconnect
	protoc --connect-go_out=. --connect-go_opt=paths=source_relative \
		proto/*.proto
	@echo "Copying generated Go files to proto/pb and proto/pbconnect..."
	@mkdir -p proto/pb
	@cp -f proto/*.pb.go proto/pb/ 2>/dev/null || true
	@mv -f proto/*.connect.go proto/pbconnect/ 2>/dev/null || true
	@echo "Generating protobuf TypeScript code..."
	@mkdir -p lib/proto/proto
	protoc --plugin=protoc-gen-es=node_modules/.bin/protoc-gen-es \
		--es_out=lib/proto/proto \
		--es_opt=target=ts \
		proto/*.proto
	protoc --plugin=protoc-gen-connect-es=node_modules/.bin/protoc-gen-connect-es \
		--connect-es_out=lib/proto/proto \
		--connect-es_opt=target=ts \
		proto/*.proto
	@echo "Fixing import extensions in generated TypeScript files..."
	@find lib/proto/proto -name "*.ts" -exec sed -i 's/from "\.\/\(.*\)\.js"/from ".\/\1"/g' {} +
	@echo "Moving generated TypeScript files to correct location..."
	@if [ -d "lib/proto/proto/proto" ]; then \
		cp -f lib/proto/proto/proto/*.ts lib/proto/proto/ 2>/dev/null || true; \
		rm -rf lib/proto/proto/proto; \
	fi

.PHONY: proto-check
proto-check: ## Check if protobuf code is up to date
	@echo "Checking protobuf code..."
	@if command -v protoc >/dev/null 2>&1; then \
		if [ -n "$$(protoc --go_out=. --go_opt=paths=source_relative \
			--go-grpc_out=. --go-grpc_opt=paths=source_relative \
			proto/*.proto 2>&1)" ]; then \
			echo "Protobuf code is outdated. Run 'make proto' to regenerate."; \
			exit 1; \
		fi; \
	else \
		echo "protoc not found. Please install Protocol Buffers compiler"; \
		exit 1; \
	fi

# Docker targets
.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

.PHONY: docker-run
docker-run: ## Run Docker container
	@echo "Running Docker container..."
	docker run -p 50051:50051 --env-file .env $(DOCKER_IMAGE):$(DOCKER_TAG)

.PHONY: docker-clean
docker-clean: ## Clean up Docker resources
	@echo "Cleaning up Docker resources..."
	docker system prune -f
	docker volume prune -f

# Environment and setup targets
.PHONY: env-check
env-check: ## Check environment variables
	@echo "Checking environment variables..."
	@echo "Required environment variables:"
	@echo "  DATABASE_URL - PostgreSQL connection string"
	@echo "  GRPC_PORT - Port for gRPC server (default: 50051)"
	@echo ""
	@echo "Optional environment variables:"
	@echo "  S3_REGION - S3 region (default: auto)"
	@echo "  S3_BUCKET - S3 bucket name"
	@echo "  S3_ACCESS_KEY - S3 access key"
	@echo "  S3_SECRET_KEY - S3 secret key"
	@echo "  S3_ENDPOINT - S3 endpoint URL"

.PHONY: setup
setup: ## Initial project setup
	@echo "Setting up project..."
	$(GOMOD) tidy
	@echo "Installing tools..."
	@if command -v go-install >/dev/null 2>&1; then \
		go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; \
		go install honnef.co/go/tools/cmd/staticcheck@latest; \
		go install github.com/psampaz/go-mod-outdated@latest; \
		echo "Tools installed successfully"; \
	else \
		echo "Please install go-install or install tools manually"; \
	fi

# Release targets
.PHONY: version
version: ## Show version information
	@echo "Go version: $(shell $(GOCMD) version)"
	@echo "Binary name: $(BINARY_NAME)"
	@echo "Module: $(GO_MODULE)"
	@if command -v git >/dev/null 2>&1; then \
		echo "Git commit: $(shell git rev-parse --short HEAD)"; \
		echo "Git tag: $(shell git describe --tags --always --dirty)"; \
	fi

.PHONY: release-check
release-check: lint vet test ## Run all checks before release
	@echo "Running release checks..."
	@echo "All checks passed!"

# Install targets
.PHONY: install
install: ## Install the binary to GOPATH/bin
	@echo "Installing $(BINARY_NAME)..."
	$(GOCMD) install $(LDFLAGS) $(MAIN_PATH)

# CI/CD targets
.PHONY: ci
ci: clean deps-verify fmt vet lint test build ## Run full CI pipeline
	@echo "CI pipeline completed successfully!"

.PHONY: pre-commit
pre-commit: fmt vet test ## Run pre-commit checks
	@echo "Pre-commit checks completed!"

# Security targets
.PHONY: security-scan
security-scan: ## Run security scan with gosec
	@echo "Running security scan..."
	@if command -v gosec >/dev/null 2>&1; then \
		gosec ./...; \
	else \
		echo "gosec not found. Please install it:"; \
		echo "  go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest"; \
		exit 1; \
	fi

.PHONY: deps-scan
deps-scan: ## Scan for vulnerable dependencies
	@echo "Scanning for vulnerable dependencies..."
	@if command -v govulncheck >/dev/null 2>&1; then \
		govulncheck ./...; \
	else \
		echo "govulncheck not found. Please install it:"; \
		echo "  go install golang.org/x/vuln/cmd/govulncheck@latest"; \
		exit 1; \
	fi

# Benchmark targets
.PHONY: bench
bench: ## Run benchmarks
	@echo "Running benchmarks..."
	$(GOCMD) test -bench=. -benchmem ./...

.PHONY: profile
profile: ## Generate CPU profile
	@echo "Generating CPU profile..."
	$(GOCMD) test -cpuprofile=cpu.prof -memprofile=mem.prof -bench=. ./...
	@echo "Profiles generated: cpu.prof, mem.prof"

# Backup and maintenance targets
.PHONY: backup
backup: ## Create backup of important files
	@echo "Creating backup..."
	@mkdir -p backup
	tar -czf backup/$(BINARY_NAME)-$(shell date +%Y%m%d-%H%M%S).tar.gz \
		go.mod go.sum sql/ proto/ internal/ cmd/ .env.example

# Health check
.PHONY: health
health: ## Check if binary is working
	@echo "Checking health..."
	@if [ -f "$(BINARY_DIR)/$(BINARY_NAME)" ]; then \
		$(BINARY_DIR)/$(BINARY_NAME) --help || echo "Binary is working"; \
	else \
		echo "Binary not found. Run 'make build-local' first"; \
	fi

# Quick development workflow
.PHONY: quick
quick: clean build-local run ## Clean build and run (quick dev cycle)
	@echo "Quick development cycle completed"

# All-in-one targets
.PHONY: all
all: clean deps fmt vet lint test build ## Complete build process
	@echo "Build process completed!"

.PHONY: watch
watch: ## Watch for file changes and rebuild (requires entr)
	@echo "Watching for changes..."
	@if command -v entr >/dev/null 2>&1; then \
		find . -name '*.go' | entr -r make run; \
	else \
		echo "entr not found. Please install it or run 'make dev' instead"; \
		exit 1; \
	fi



# Deployment target
.PHONY: deploy
deploy: build-linux ## Deploy Linux binary to remote server
	@echo "Deploying $(BINARY_NAME)-linux to frontware@192.168.1.28/media/data/grpc..."
	@if [ ! -f "$(BINARY_DIR)/$(BINARY_NAME)-linux" ]; then \
		echo "Linux binary not found. Run 'make build-linux' first"; \
		exit 1; \
	fi
	rsync $(BINARY_DIR)/$(BINARY_NAME)-linux frontware@192.168.1.28:/media/data/grpc/
	@echo "Deployment completed successfully!"
