# GEMINI.md

This file provides guidance to Google Gemini when working with code in this repository.

## Project Overview

Weladee Form is an open-source TypeForm alternative built with:
- **Frontend**: Next.js 16 (App Router) with React 19
- **Backend**: Go 1.21+ with gRPC
- **Database**: PostgreSQL with SQLC for type-safe queries
- **Auth**: JWT token validation

Users can create beautiful, one-question-at-a-time forms with 10 themes and 15 question types. Forms are published publicly via unique slugs and responses are collected with optional authentication.

**Key Features:**
- **Form Builder** - Create forms with drag-and-drop question ordering (app/(main)/dashboard/forms/[id]/edit). Includes validation to prevent publishing empty forms.
- **Form Player** - TypeForm-style one-question-at-a-time taking experience with keyboard navigation (app/(form-player)/f/[slug])
- **Response Dashboard** - View, search, filter, and export responses to CSV/JSON (app/(main)/dashboard/forms/[id]/responses)
- **Analytics Dashboard** - Visualize views, starts, completions, and question-level insights.
- **Themes** - 10 preset themes: midnight, ocean, sunset, forest, lavender, weladee, minimal, aurora, cyberpunk, desert (lib/themes.ts)
- **Progress Bar Styles** - Multiple styles supported: none, linear, steps, circular (form.progress_bar_style enum)
- **Authentication** - JWT token validation
- **Smart Menu States** - Menu items automatically disable for draft forms (Responses, Copy Link) with visual feedback
- **Language Switcher** - User can change language (English, Thai, French) from the user dropdown menu with flag icons and persistent cookie storage
- **Dynamic Branding** - Dashboard and navigation links dynamically reflect the user's name (e.g., "Frontware's forms").
- **UX Standards** - Standardized singular/plural logic (0 and 1 use singular) and collapsible search filters when no data is present.

## Backend Architecture

### gRPC Services

The Go backend implements three gRPC services defined in `proto/`:

**FormService** (`proto/form.proto`)
- `CreateForm` - Create a new form with questions
- `GetForm` - Get a form by ID (with optional questions)
- `UpdateForm` - Update form properties (with robust enum mapping and logging)
- `DeleteForm` - Delete a form
- `ListForms` - List user's forms with pagination
- `PublishForm` - Publish a form
- `GetFormStats` - Get form response statistics
- `CreateQuestion` - Add a question to a form

**ResponseService** (`proto/response.proto`)
- `SubmitResponse` - Submit or partially save form responses. Any user with the URL can submit (no login required for respondents).
- `GetResponse` - Get a response by ID
- `ListResponses` - List form responses with pagination
- `ExportResponses` - Export responses to CSV or JSON

**FileService** (`proto/file.proto`)
- `UploadFile` - Streaming file upload (for file upload questions)
- `GetFileUrl` - Get a presigned URL for file download

**AnalyticsService** (`proto/analytics.proto`)
- `TrackView`, `TrackResponseStart` - Event tracking
- `GetOverviewStats`, `GetQuestionAnalytics`, etc. - Data retrieval

### Database Layer (SQLC)

The database layer uses SQLC for type-safe SQL queries:

- **SQL Queries**: `sql/queries/*.sql`
  - `user.sql` - User queries (CreateFormUser, GetFormUserByWeladeeID)
  - `form.sql` - Form queries (CreateForm, GetForm, ListUserForms, CountUserForms, etc. supports progress_bar_style)
  - `question.sql` - Question queries (CreateQuestion, ListFormQuestions)
  - `response.sql` - Response queries (CreateResponse, GetResponse, CountFormResponses, etc.)
  - `analytics.sql` - Analytics queries (IncrementFormViews, etc.)
  - `file.sql` - File upload queries

- **Generated Code**: `internal/db/sqlc/*.go`
  - `models.go` - Database table models (FormForm, FormQuestion, FormResponse, FormAnswer, etc.)
  - `querier.go` - Query interface
  - `*.sql.go` - Generated query functions

### Authentication Flow

**Important:** There is **NO** login page. The application must be accessed with a valid token.

**JWT Token Validation**:
1. **Mandatory Token:** A valid JWT token is required for all access.
2. **Transport**:
   - `Authorization` header: `Bearer <token>` (standard gRPC calls)
   - URL parameter: `?token=<jwt_token>` (initial access/gRPC-Web)
3. **Validation:** Auth interceptor (`internal/auth/interceptor.go`) validates tokens using the configured secret. Invalid tokens result in an error.
4. **Context:** User claims (UserID, Email, DisplayName, RedirectURL) are extracted and added to the context.
5. **Public Endpoints:** Only specific public endpoints (like GetFormBySlug for answering forms) bypass auth.

**Auth Files**:
- `internal/auth/jwt.go` - JWT token validation
- `internal/auth/interceptor.go` - gRPC auth interceptor with public method whitelist

### Storage Layer

**S3/Cloudflare R2** for file uploads:
- `internal/storage/s3.go` - S3Storage client with presigned URL generation
- Supports AWS S3 and S3-compatible storage (Cloudflare R2, MinIO)

### Bot Protection Layer

**Google reCAPTCHA v3** for bot protection:
- `internal/utils/recaptcha.go` - `VerifyRecaptcha()` function for server-side token validation
- `config/config.go` - `RecaptchaConfig` with CLI flags, env vars, and YAML support
- **Invisible CAPTCHA** - No user interaction required, score-based verification (0.0-1.0)
- **Per-form control** - Enable/disable via "Force CAPTCHA" toggle in form builder
- Configuration priority: CLI flags > Environment variables > config.yaml

## Backend Configuration

The Go backend supports three configuration methods with the following priority:

1. **Command line flags** (highest priority)
2. **Environment variables**
3. **config.yaml file** (lowest priority)

### Configuration Options

| Setting | CLI Flag | Environment Variable | Default | Required |
|---------|----------|---------------------|---------|----------|
| gRPC Port | `-p, --grpc-port` | `GRPC_PORT` | `50051` | No |
| Database URL | `-d, --database-url` | `DATABASE_URL` | - | **Yes** |
| S3 Region | `--s3-region` | `S3_REGION` | `auto` | No |
| S3 Bucket | `--s3-bucket` | `S3_BUCKET` | - | No |
| S3 Access Key | `--s3-access-key` | `S3_ACCESS_KEY` | - | No |
| S3 Secret Key | `--s3-secret-key` | `S3_SECRET_KEY` | - | No |
| S3 Endpoint | `--s3-endpoint` | `S3_ENDPOINT` | - | No |
| reCAPTCHA Enabled | `--recaptcha-enabled` | `RECAPTCHA_ENABLED` | `false` | No |
| reCAPTCHA Site Key | `--recaptcha-site-key` | `RECAPTCHA_SITE_KEY` | - | No |
| reCAPTCHA Secret Key | `--recaptcha-secret-key` | `RECAPTCHA_SECRET_KEY` | - | No |
| reCAPTCHA Threshold | `--recaptcha-threshold` | `RECAPTCHA_THRESHOLD` | `0.5` | No |

### Usage Examples

**Command Line Flags:**
```bash
./bin/weladee-form --database-url="postgresql://user:pass@localhost/db" --grpc-port=8080
./bin/weladee-form -d "postgresql://user:pass@localhost/db" -p 8080
```

**Environment Variables:**
```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
export GRPC_PORT="8080"

# Optional: Enable reCAPTCHA v3
export RECAPTCHA_ENABLED=true
export RECAPTCHA_SITE_KEY="6Lxxxxxxxxxxxxxxxx"
export RECAPTCHA_SECRET_KEY="6Lxxxxxxxxxxxxxxxx"
export RECAPTCHA_THRESHOLD=0.5

./bin/weladee-form
```

**Configuration File:**
```yaml
grpc_port: "8080"
database_url: "postgresql://user:pass@localhost/db"

# S3 configuration
s3_region: "auto"
s3_bucket: "your-bucket"
s3_access_key: "your-key"
s3_secret_key: "your-secret"
s3_endpoint: "https://your-endpoint.com"

# reCAPTCHA v3 configuration
recaptcha:
  enabled: true          # Global toggle for reCAPTCHA
  site_key: "6Lxxxxxxxxxxxxxxxx"
  secret_key: "6Lxxxxxxxxxxxxxxxx"
  threshold: 0.5         # Score threshold (0.0-1.0), default 0.5
```

## Development Commands

### Frontend (Next.js)
```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend (Go)
```bash
# Using Makefile
make dev             # Run Go server in development mode
make build           # Build for all platforms
make build-local     # Build for local platform (with embedded frontend)
make build-dev       # Build for local platform (no embedded frontend)
make test            # Run tests
make db-generate     # Regenerate SQLC code from SQL queries
make proto           # Regenerate protobuf Go code

# Direct Go commands
go run cmd/server/main.go                    # Run server directly
./bin/weladee-form serve                     # Run server
./bin/weladee-form create-jwt --name "John Doe" --email "john@example.com"  # Generate JWT token
./bin/weladee-form config                    # Open config.yaml in nano editor
go build -o bin/weladee-form cmd/server/main.go  # Build binary
sqlc generate                                  # Generate SQLC code
protoc --go_out=. --go-grpc_out=. proto/*.proto  # Generate proto code
```

## Embedded Client Build System

Weladee Form supports building as a single binary that contains both the Go backend and embedded Next.js frontend. This enables easy distribution and deployment.

### How Embedded Builds Work

1. **Next.js Build**: `npm run build` creates optimized static files in `internal/embed/dist/`
2. **Go Embed**: Go's `//go:embed` directive bundles the `internal/embed/dist/` directory
3. **Single Binary**: Result is one executable containing everything

### Robust Embedded Serving

The server handles SPA routing and Next.js internal files with fallbacks:
- Clean URLs (e.g. `/en/dashboard`) are automatically matched to `.html` files.
- Next.js internal files (like `__next._tree.txt`) in dynamic routes fallback to static templates (`/f/form/`, `/forms/__dynamic__/`) to ensure prefetching works correctly.

### Build Commands

```bash
# Build embedded binary (includes frontend)
make build-local     # Creates bin/weladee-form (27MB)

# Build without embedding (for development)
make build-dev       # Creates bin/weladee-form-dev

# Build for all platforms with embedding
make build          # Creates binaries for Linux, Windows, macOS
```

### Embedded Binary Features

- **Complete Application**: Contains Go server + React frontend + all assets
- **Single Port**: Serves both API and frontend on same port
- **SPA Routing**: Handles Next.js App Router routes correctly
- **Static Assets**: CSS, JS, images all embedded
- **Zero Dependencies**: Just run the binary with database config

### Usage Example

```bash
# Build the embedded binary
make build-local

# Run with database configuration
./bin/weladee-form --database-url="postgresql://user:pass@localhost/db"

# Access the application at http://localhost:50051
# - Frontend routes: /, /dashboard, /f/form-slug
# - API endpoints: gRPC-Web calls to same port
```

## Environment Setup

### 1. Database Setup

Create a PostgreSQL database and run the schema:

```bash
psql -d your_database -f sql/schema/form_schema.sql
```

The schema creates the `form` schema with tables:
- `users` - Form users (linked to Weladee user ID)
- `forms` - Form definitions (supports progress_bar_style enum)
- `questions` - Form questions
- `responses` - Form submissions
- `answers` - Response answers
- `file_uploads` - Uploaded file metadata
- `analytics` - Form analytics (views, starts, completions)

### 2. Generate Code

After modifying SQL queries or proto definitions:

```bash
# Regenerate SQLC code
sqlc generate

# Regenerate protobuf Go code
make proto
# or
protoc --go_out=. --go-grpc_out=. proto/*.proto
```

### 3. Configure Environment

Set required environment variables:
```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
```

Optional (for file uploads):
```bash
export S3_BUCKET="your-bucket"
export S3_ACCESS_KEY="your-key"
export S3_SECRET_KEY="your-secret"
export S3_ENDPOINT="https://your-endpoint.com"
```

## Frontend Architecture

### Route Structure (App Router)

- `app/(main)/` - Main application routes (localized, auth required)
  - `dashboard/` - List of user's forms
  - `forms/new` - Create new form
  - `forms/[id]/edit` - Form builder/editor
  - `forms/[id]/responses` - View and manage form responses
  - `forms/[id]/analytics` - Analytics dashboard
  - `settings/` - User settings
- `app/(form-player)/` - Public form pages (no auth required)
  - `f/[slug]` - Public form player
- `app/api/` - API routes (if any Next.js API routes needed)
- `middleware.ts` - Auth middleware for route protection

### Key Directories

Frontend:
- `components/ui/` - shadcn/ui base components (Radix UI primitives)
- `components/form-builder/` - Form creation/editing UI
- `components/form-player/` - Public form display with one-question-at-a-time navigation
- `components/dashboard/` - Dashboard-specific components
- `components/responses/` - Response management UI with search/filter/export
- `components/analytics/` - Analytics visualization components
- `lib/questions.ts` - Question type definitions and helper functions
- `lib/themes.ts` - Theme configuration objects
- `lib/grpc-client.ts` - gRPC client for backend communication
- `i18n/` - Internationalization configuration
- `messages/` - Translation files (en.json, th.json, fr.json)

Backend:
- `cmd/server/main.go` - Server entry point
- `proto/` - Protocol buffer definitions
- `proto/pb/` - Generated protobuf Go code
- `internal/gapi/` - gRPC service implementations
  - `rpc_form.go` - FormService implementation (with robust enum mapping)
  - `rpc_response.go` - ResponseService implementation
  - `rpc_file.go` - FileService implementation
  - `rpc_analytics_*.go` - AnalyticsService implementation
  - `server.go` - Server constructors
- `internal/db/` - Database layer
  - `database.go` - Database connection wrapper
  - `sqlc/` - SQLC generated code
- `internal/auth/` - Authentication
  - `jwt.go` - JWT token validation
  - `interceptor.go` - gRPC auth interceptor
- `internal/storage/s3.go` - S3 storage client
- `internal/utils/export.go` - CSV/JSON export utilities
- `sql/schema/` - Database schemas
- `sql/queries/` - SQLC query definitions

## Data Model

### PostgreSQL Tables (form schema)

**form.users** - Form users linked to Weladee accounts
- `id` (UUID, primary key)
- `weladee_user_id` (int32, references Weladee user)
- `email`, `full_name`, `avatar_url`
- `created_at`, `updated_at`

**form.forms** - Form definitions
- `id` (UUID, primary key)
- `user_id` (UUID, references form.users)
- `title`, `description` (text)
- `theme` (enum: midnight, ocean, sunset, forest, lavender, weladee, minimal, aurora, cyberpunk, desert)
- `is_published`, `is_accepting_responses`, `allow_multiple_submissions`
- `progress_bar_style` (enum: none, linear, steps, circular)
- `custom_thank_you_message`, `redirect_url`
- `settings` (JSONB)
- `created_at`, `updated_at`

**form.questions** - Form questions
- `id` (UUID, primary key)
- `form_id` (UUID, references form.forms)
- `type` (enum: short_text, long_text, dropdown, checkboxes, email, phone, number, date, rating, opinion_scale, yes_no, file_upload, url, matrix, ranking)
- `label`, `description`, `placeholder`
- `required`
- `order_index`
- `options`, `validation_rules`, `settings` (JSONB)
- `created_at`, `updated_at`

**form.responses** - Form submissions
- `id` (UUID, primary key)
- `form_id` (UUID, references form.forms)
- `respondent_user_id` (UUID, nullable, references form.users)
- `respondent_email`, `respondent_name` (text, nullable)
- `ip_address` (inet)
- `user_agent` (text)
- `completed` (boolean)
- `submitted_at` (timestamptz, nullable)
- `created_at`, `updated_at`

**form.answers** - Response answers
- `id` (UUID, primary key)
- `response_id` (UUID, references form.responses)
- `question_id` (UUID, references form.questions)
- `answer_text` (text, nullable)
- `answer_number` (numeric, nullable)
- `answer_date` (date, nullable)
- `answer_time` (time, nullable)
- `answer_choices` (JSONB, nullable)
- `answer_file_url` (text, nullable)
- `created_at`, `updated_at`

**form.file_uploads** - File metadata
- `id` (UUID, primary key)
- `form_id`, `question_id`, `response_id` (UUIDs)
- `filename`, `original_filename`, `mime_type`
- `file_size`
- `s3_key`, `s3_url`
- `created_at`

**form.daily_stats** - Aggregated analytics
- `id` (UUID, primary key)
- `form_id` (UUID)
- `stat_date` (date)
- `total_views`, `total_starts`, `total_completions`
- `desktop_views`, `mobile_views`, `tablet_views`

### SQLC Generated Types

- `FormUser` - User model
- `FormForm` - Form model
- `FormQuestion` - Question model
- `FormResponse` - Response model
- `FormAnswer` - Answer model
- `FormFileUpload` - File upload model
- `FormDailyStat` - Analytics model
- `CreateFormParams`, `UpdateFormParams`, etc. - Query parameters

## Question Types (15 total)

Defined in `lib/questions.ts`:

| Type | Description | Config Properties |
|------|-------------|-------------------|
| `short_text` | Single line input | `placeholder` |
| `long_text` | Multi-line textarea | `placeholder` |
| `dropdown` | Select one option | `options[]` |
| `checkboxes` | Select multiple | `options[]` |
| `email` | Email with validation | `placeholder` |
| `phone` | Phone number | `placeholder` |
| `number` | Numeric input | `placeholder` |
| `date` | Date picker | - |
| `rating` | Star rating (1-5) | `minValue`, `maxValue` |
| `opinion_scale` | Numeric scale (1-10) | `minValue`, `maxValue` |
| `yes_no` | Binary choice | - |
| `file_upload` | Images and PDFs | `allowedFileTypes[]`, `maxFileSize` (MB) |
| `url` | Website URL | `placeholder` |
| `matrix` | Grid rating | `rows[]`, `columns[]` |
| `ranking` | Item reordering | `items[]` |

Helper functions:
- `getQuestionTypeInfo(type)` - Get info for a question type
- `createDefaultQuestion(type)` - Create a new question with defaults

## Theme System

Defined in `lib/themes.ts` with 10 presets. Each theme has:
- `primaryColor`, `backgroundColor`, `textColor`, `accentColor`
- `fontFamily`

Helper functions:
- `getTheme(preset)` - Get theme config by preset name
- `getThemeCSSVariables(theme)` - Convert to CSS custom properties

## gRPC Client Usage

The frontend uses a gRPC client (implemented in `lib/grpc-client.ts`) to communicate with the backend via gRPC-Web or Connect protocol.

```typescript
// Example: Create a form
const client = new WeladeeFormClient('http://localhost:50051');
const form = await client.formService.createForm({
  title: 'My Form',
  theme: FormTheme.MINIMAL,
  questions: [{
    type: QuestionType.SHORT_TEXT,
    label: 'What is your name?',
    required: true,
    orderIndex: 0,
  }],
});
```

## Keyboard Navigation (Form Player)

The form player (`components/form-player/`) supports:
- **Enter** - Submit answer and move to next question
- **Arrow keys** - Navigate between questions
- **Scroll wheel** - Navigate between questions

## File Upload Flow

1. File selected in form player
2. Upload via gRPC streaming to FileService.UploadFile (or /api/upload for simpler handling)
3. File stored in S3/R2, metadata saved to database
4. Returns file URL to be stored in response answers

## Clipboard API Fallback

For robustness in non-secure (HTTP) environments (e.g. IP-based access), clipboard operations use a hybrid approach:
- Use `navigator.clipboard.writeText` if available.
- Fallback to `document.execCommand('copy')` with a temporary `textarea` if the modern API is blocked by security policies.

## Common Patterns

### Creating a new form (gRPC)

```typescript
const client = new WeladeeFormClient('http://localhost:50051');
const { form } = await client.formService.createForm({
  title: 'My Form',
  theme: FormTheme.MINIMAL,
  questions: [
    createDefaultQuestion('short_text'),
  ],
});
```

### Submitting a response (gRPC)

```typescript
const { response } = await client.responseService.submitResponse({
  formId: form.id,
  complete: true,
  answers: [
    {
      questionId: question.id,
      answerText: 'John Doe',
    },
  ],
});
```

### Exporting responses

The responses dashboard supports exporting form data in both CSV and JSON formats. The implementation uses a hybrid approach:

- **Client-side generation** for datasets under 1,000 responses (faster, no network latency)
- **Server-side gRPC** for datasets with 1,000+ responses (better memory handling)

**Frontend (components/responses/responses-dashboard.tsx):**
- Dropdown menu with "Export as CSV" (FileText icon) and "Export as JSON" (FileJson icon)
- Loading state with spinner during server-side exports
- Toast notifications for success/error feedback

**Client-side JSON export structure:**
```json
{
  "form_id": "uuid",
  "form_title": "Form Name",
  "exported_at": "2026-01-03T10:30:00.000Z",
  "total_responses": 2,
  "questions": [
    { "id": "q-uuid", "title": "Question?", "type": "short_text", "required": true }
  ],
  "responses": [
    {
      "id": "r-uuid",
      "submitted_at": "2026-01-03T10:00:00.000Z",
      "answers": { "q-uuid": "Answer value" }
    }
  ]
}
```

**Server-side gRPC export (for large datasets):**

```typescript
const { data, filename, mimeType } = await client.responseService.exportResponses({
  formId: form.id,
  format: 'csv', // or 'json'
});
```

## Type Safety

### SQLC Types

Database types are defined in `internal/db/sqlc/models.go`:
- `FormForm`, `FormQuestion`, `FormResponse`, `FormAnswer`, `FormUser`, `FormFileUpload`, `FormDailyStat`
- `CreateFormParams`, `UpdateFormParams`, etc. - Query parameter types

### Protobuf Types

gRPC types are defined in `proto/pb/*.pb.go` and `lib/proto/proto/*_pb.ts`:
- `Form`, `Question`, `Response`, `Answer`
- Request/Response types for all gRPC methods
- Enums: `FormTheme`, `QuestionType`, `FormStatus`, `ProgressBarStyle`

### TypeScript Types

Frontend types are generated from protobuf definitions and also defined manually in `lib/database.types.ts`.

## Dependencies

### Backend
- **Go 1.21+**
- **gRPC / ConnectRPC** - RPC framework
- **PostgreSQL** - Database with pgx/v5 driver
- **SQLC** - Type-safe SQL generation
- **JWT** - Token validation
- **AWS SDK v2** - S3 storage

### Frontend
- **Next.js 16** - App Router with React 19
- **shadcn/ui** - Component library built on Radix UI
- **Tailwind CSS 4** - Styling
- **Framer Motion** - Animations
- **next-intl** - Internationalization
- **Lucide React** - Icons

## Makefile Commands

The project includes a comprehensive Makefile for common operations:

```bash
make help            # Show all available commands
make dev             # Run Go server in development mode
make build           # Build binaries for all platforms
make build-local     # Build for local development
make test            # Run all tests
make fmt             # Format Go code
make lint            # Run linter
make vet             # Run go vet
make proto           # Generate protobuf Go code
make db-generate     # Generate SQLC code from SQL queries
make deps-tidy       # Clean up Go dependencies
make clean           # Clean build artifacts
```

## Development Workflow

1. **Modify SQL queries**: Edit files in `sql/queries/`, then run `make db-generate`
2. **Modify proto definitions**: Edit files in `proto/`, then run `make proto`
3. **Modify Go code**: Use `make dev` or `go run cmd/server/main.go`
4. **Run tests**: `make test`
5. **Build for deployment**: `make build`

## Notes

- The backend uses gRPC reflection for development tools (grpcurl)
- All gRPC calls require authentication except public endpoints (defined in `internal/auth/interceptor.go`)
- File uploads use streaming gRPC or multi-part POST for efficient handling
- Responses can be partially saved (completed=false) and finalized later
- The database schema uses a separate `form` schema for organization