# Weladee Form

A beautiful, open-source TypeForm alternative. Create engaging forms with a one-question-at-a-time experience.

![Weladee Form Logo](logo.png)

## Features

- **7 beautiful themes** - Midnight, Ocean, Sunset, Forest, Lavender, Weladee, Minimal
- **Keyboard navigation** - Navigate with Enter, arrow keys, and scroll wheel
- **Mobile-first forms** - Responsive form-taking experience
- **Secure authentication** - Weladee Redis token validation
- **Response dashboard** - View, search, filter, and export to CSV/JSON
- **13 question types** - Text, multiple choice, rating, file upload, and more
- **Internationalization** - Support for English and Thai

## Question types

| Type | Description |
|------|-------------|
| Short text | Single line text input |
| Long text | Multi-line textarea |
| Dropdown | Select one option |
| Checkboxes | Select multiple options |
| Email | Email with validation |
| Phone | Phone number input |
| Number | Numeric input |
| Date | Date picker |
| Rating | Star rating (1-5) |
| Opinion scale | Numeric scale (1-10) |
| Yes/No | Binary choice |
| File upload | Images and PDFs |
| Website URL | URL with validation |

## Tech stack

- **Frontend**: Next.js 16 (App Router) + React 19
- **Backend**: Go 1.21+ with gRPC
- **Database**: PostgreSQL with SQLC for type-safe queries
- **Auth**: Weladee Redis token validation
- **i18n**: next-intl
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Animations**: Framer Motion
- **File storage**: S3-compatible (MinIO / AWS S3 / Cloudflare R2)

## Getting started

### Prerequisites

- Node.js 18+
- Go 1.21+
- PostgreSQL
- Redis (for Weladee token validation)
- S3-compatible storage (optional, for file uploads)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/weladee-form.git
cd weladee-form
```

### 2. Set up Database

**Option A: Using Makefile (recommended)**

```bash
# Set DATABASE_URL or update config.yaml first
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Run the schema
make db-setup
```

**Option B: Using psql directly**

```bash
psql -d your_database -f sql/schema/form_schema.sql
```

**Option C: Using Docker (local development)**

```bash
# Start PostgreSQL
docker run --name weladee-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=weladee_form \
  -p 5432:5432 \
  -d postgres:16

# Run the schema
docker exec -i weladee-postgres psql -U postgres -d weladee_form < sql/schema/form_schema.sql
```

The schema creates the `form` schema with the following tables:
- `users` - Form users linked to Weladee accounts
- `forms` - Form definitions
- `questions` - Form questions
- `responses` - Form submissions
- `answers` - Response answers
- `file_uploads` - Uploaded file metadata
- `analytics` - Daily form analytics

### 3. Configure Environment

Weladee Form supports three methods for configuration, in order of priority:

#### Priority Order
1. **Command line flags** (highest priority)
2. **Environment variables**
3. **config.yaml file** (lowest priority)

#### Method 1: Command Line Flags
```bash
# Using long flags
./bin/weladee-form --database-url="postgresql://user:pass@localhost/db" --grpc-port=8080

# Using short flags
./bin/weladee-form -d "postgresql://user:pass@localhost/db" -p 8080
```

Available flags:
- `-p, --grpc-port`: gRPC server port (default: 50051)
- `-d, --database-url`: PostgreSQL database URL (required)
- `-r, --redis-url`: Redis server URL (default: redis://localhost:6379)
- `--redis-prefix`: Redis key prefix (default: weladee:auth:token)
- `--s3-region`: S3 region (default: auto)
- `--s3-bucket`: S3 bucket name
- `--s3-access-key`: S3 access key
- `--s3-secret-key`: S3 secret key
- `--s3-endpoint`: S3 endpoint URL

#### Method 2: Environment Variables
```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
export GRPC_PORT="50051"
export REDIS_URL="redis://localhost:6379"
export REDIS_KEY_PREFIX="weladee:auth:token"
# ... other variables

./bin/weladee-form
```

#### Method 3: Configuration File
Copy `config.example.yaml` to `config.yaml` and modify the values:

```bash
cp config.example.yaml config.yaml
# Edit config.yaml with your values
```

Example `config.yaml`:
```yaml
grpc_port: "50051"
database_url: "postgresql://user:pass@localhost/db"
redis_url: "redis://localhost:6379"
redis_prefix: "weladee:auth:token"

# Optional S3 configuration
s3_region: "auto"
s3_bucket: "your-bucket"
s3_access_key: "your-key"
s3_secret_key: "your-secret"
s3_endpoint: "https://your-endpoint.com"
```

**Note:** The application will automatically load `config.yaml` from the current directory or `./config/` directory if it exists.

### 4. Run the application

**Backend:**
```bash
# Using Makefile (recommended)
make dev

# Or directly
go run cmd/server/main.go

# Or build and run
make build-local
./bin/weladee-form-linux
```

**Frontend:**
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Project structure

```
weladee-form/
├── app/                  # Next.js App Router
│   ├── (main)/           # Main application routes (localized)
│   ├── (form-player)/    # Public form player routes
│   └── api/              # API routes
├── cmd/                  # Go application entrypoints
│   └── server/
│       └── main.go       # gRPC server entry point
├── internal/             # Private Go application code
│   ├── auth/             # Authentication (Redis token validation)
│   ├── db/               # Database layer (SQLC)
│   ├── gapi/             # gRPC service implementations
│   ├── storage/          # S3 storage client
│   └── utils/            # Utilities (CSV/JSON export)
├── proto/                # gRPC protocol buffer definitions
│   └── pb/               # Generated protobuf Go code
├── sql/                  # SQL queries and schemas
│   ├── schema/           # Database schemas
│   └── queries/          # SQLC query definitions
├── components/           # React components
├── lib/                  # Shared libraries
├── i18n/                 # Internationalization config
├── messages/             # Translation files
└── Makefile             # Build automation
```

## Backend (Go/gRPC)

### gRPC Services

**FormService**
- `CreateForm` - Create a new form with questions
- `GetForm` - Get a form by ID
- `UpdateForm` - Update form properties
- `DeleteForm` - Delete a form
- `ListForms` - List user's forms with pagination
- `PublishForm` - Publish a form
- `GetFormStats` - Get form response statistics
- `CreateQuestion` - Add a question to a form

**ResponseService**
- `SubmitResponse` - Submit or partially save form responses
- `GetResponse` - Get a response by ID
- `ListResponses` - List form responses with pagination
- `ExportResponses` - Export responses to CSV or JSON

**FileService**
- `UploadFile` - Streaming file upload
- `GetFileUrl` - Get a presigned URL for file download

### Database Layer

The database layer uses [SQLC](https://sqlc.dev/) for type-safe SQL queries:

- **SQL Queries**: `sql/queries/*.sql`
  - `user.sql` - User queries
  - `form.sql` - Form queries
  - `question.sql` - Question queries
  - `response.sql` - Response queries
  - `analytics.sql` - Analytics queries
  - `file.sql` - File upload queries

- **Generated Code**: `internal/db/sqlc/*.go`
  - `models.go` - Database table models
  - `querier.go` - Query interface
  - `*.sql.go` - Generated query functions

### Authentication

Authentication uses Weladee Redis token validation:
- Frontend obtains Weladee token (from external auth service)
- Token passed in gRPC metadata: `authorization: Bearer <token>`
- Auth interceptor validates token against Weladee Redis
- User claims extracted and added to request context

## Development

### Frontend Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend Development

```bash
# Using Makefile (recommended)
make dev             # Run Go server in development mode
make build           # Build for all platforms
make build-local     # Build for local platform
make test            # Run tests
make db-generate     # Regenerate SQLC code from SQL queries
make proto           # Regenerate protobuf Go code
make fmt             # Format Go code
make lint            # Run linter
make vet             # Run go vet
make help            # Show all available commands

# Direct Go commands
go run cmd/server/main.go                    # Run server directly
go build -o bin/weladee-form cmd/server/main.go  # Build binary
sqlc generate                                  # Generate SQLC code
```

### Code Generation

After modifying SQL queries or proto definitions:

```bash
# Regenerate SQLC code
sqlc generate

# Regenerate protobuf Go code
make proto
# or
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/*.proto
```

## Database Schema

### Tables (PostgreSQL - form schema)

**form.users** - Form users linked to Weladee accounts
- `id` (UUID)
- `weladee_user_id` (int32)
- `email`, `full_name`, `avatar_url`
- `created_at`, `updated_at`

**form.forms** - Form definitions
- `id` (UUID)
- `user_id` (UUID)
- `title`, `description`, `theme`
- `is_published`, `is_accepting_responses`, `require_login`, `allow_multiple_submissions`
- `show_progress_bar`
- `custom_thank_you_message`, `redirect_url`
- `settings` (JSONB)
- `created_at`, `updated_at`

**form.questions** - Form questions
- `id`, `form_id` (UUIDs)
- `type`, `label`, `description`, `placeholder`
- `required`, `order_index`
- `options`, `validation_rules`, `settings` (JSONB)
- `created_at`, `updated_at`

**form.responses** - Form submissions
- `id`, `form_id` (UUIDs)
- `respondent_user_id` (UUID, nullable)
- `respondent_email`, `respondent_name` (text, nullable)
- `ip_address` (inet), `user_agent` (text)
- `completed` (boolean), `submitted_at` (timestamptz)
- `created_at`, `updated_at`

**form.answers** - Response answers
- `id`, `response_id`, `question_id` (UUIDs)
- `answer_text` (text, nullable)
- `answer_number` (numeric, nullable)
- `answer_date` (date, nullable)
- `answer_time` (time, nullable)
- `answer_choices` (JSONB, nullable)
- `answer_file_url` (text, nullable)
- `created_at`, `updated_at`

**form.file_uploads** - File metadata
- `id` (UUID)
- `form_id`, `question_id`, `response_id` (UUIDs)
- `filename`, `original_filename`, `mime_type`
- `file_size`
- `s3_key`, `s3_url`
- `created_at`

**form.analytics** - Daily analytics
- `id` (UUID)
- `form_id` (UUID)
- `date` (date)
- `total_views`, `total_starts`, `total_completions`

## License

MIT License - feel free to use this for any project.

## Contributing

Contributions are welcome. Please open an issue or pull request.