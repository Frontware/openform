# Weladee Form Context

## Project Overview
Weladee Form is an open-source TypeForm alternative built with Next.js 16 (App Router) and Go 1.21+. It allows users to create engaging, one-question-at-a-time forms with a focus on beautiful UX/UI and responsiveness.

**Key Features:**
- **Form Builder:** Create and edit forms with various question types.
- **Themes:** Customizable themes (Midnight, Ocean, Sunset, Weladee, etc.).
- **Form Player:** "TypeForm-style" navigation.
- **Responses:** Dashboard to view, filter, and export form responses.
- **Authentication:** JWT token validation.
- **Backend:** Go gRPC server with gRPC-Web support.
- **Database:** PostgreSQL with SQLC.
- **Storage:** S3-compatible (AWS/R2/MinIO) for file uploads.
- **i18n:** Multi-language support (English, Thai, French).

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Go 1.21+, gRPC, ConnectRPC (Web)
- **Database:** PostgreSQL
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Animations:** Framer Motion
- **Communication:** gRPC-Web (Connect)

## Project Structure
- `app/`: Next.js App Router frontend.
- `cmd/server/`: Go backend entry point.
- `internal/`: Private Go code (auth, db, gapi, storage).
- `proto/`: Protocol Buffer definitions.
- `sql/`: SQL queries and schema.
- `lib/grpc-client.ts`: gRPC-Web client configuration.

## Building and Running

### Prerequisites
- Node.js 18+
- Go 1.21+
- PostgreSQL

### Two Build Options

#### Option 1: Development Setup (Separate Frontend/Backend)
```bash
# Backend only (for development with separate frontend)
make dev                    # Run Go server
npm run dev                 # Run Next.js frontend separately
```

#### Option 2: Embedded Client Build (Single Binary)
```bash
# Build single binary with embedded Next.js frontend
make build-local           # Creates bin/weladee-form (27MB)

# The binary contains:
# - Complete Go gRPC backend
# - Full Next.js React frontend
# - All static assets (CSS, JS, images)

# Run the embedded binary
./bin/weladee-form --database-url="postgresql://..."
```

### Backend Configuration
The backend supports configuration via flags, env vars, or `config.yaml`.

**Key Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string.
- `GRPC_PORT`: Port for gRPC server (default 50051).

### Commands
- **Backend Dev:** `make dev`
- **Backend Build:** `make build`
- **Embedded Build:** `make build-local` (includes frontend)
- **Frontend Dev:** `npm run dev`
- **Frontend Build:** `npm run build`
- **Generate Proto:** `make proto` (requires `protoc` and plugins)
