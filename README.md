# Weladee Form

A beautiful, open-source TypeForm alternative. Create engaging forms with a one-question-at-a-time experience.

![Weladee Form Logo](logo.png)

## Features

- **7 beautiful themes** - Midnight, Ocean, Sunset, Forest, Lavender, Weladee, Minimal
- **Keyboard navigation** - Navigate with Enter, arrow keys, and scroll wheel
- **Visual progress indicators** - Linear bar, step indicator, or circular progress with theme-aware colors
- **Mobile-first forms** - Responsive form-taking experience
- **Secure authentication** - JWT token validation with RSA key support
- **Customer-based feature tiers** - SME, Standard, and Enterprise with different capabilities
- **Company branding** - Enterprise users can add their logo to forms
- **Response dashboard** - View, search, filter, and export to CSV/JSON/Excel
- **15 question types** - Text, multiple choice, rating, matrix (Standard+), ranking (Enterprise), file upload (Enterprise), and more
- **Internationalization** - Support for English, Thai, and French with in-app language switcher
- **Bot protection** - Optional Google reCAPTCHA v3 for form submissions

## Customer Type Features

Weladee Form supports three customer tiers with different feature sets:

| Feature | SME | Standard | Enterprise |
|:---|:---:|:---:|:---:|
| Max Forms | 5 | 15 | Unlimited |
| File Upload Questions | ❌ | ❌ | ✅ |
| Company Branding | ❌ | ❌ | ✅ |
| Export to CSV | ✅ | ✅ | ✅ |
| Export to Excel | ❌ | ❌ | ✅ |

### Feature Enforcement

Feature restrictions are enforced at both backend and frontend levels:

- **Backend**: gRPC services validate customer type before allowing restricted operations
- **Frontend**: UI hides/disables options based on the user's customer type from their JWT token

## Question types

| Type | Description | Customer Type |
|------|-------------|---------------|
| Short text | Single line text input | All |
| Long text | Multi-line textarea | All |
| Dropdown | Select one option | All |
| Checkboxes | Select multiple options | All |
| Email | Email with validation | All |
| Phone | Phone number input | All |
| Number | Numeric input | All |
| Date | Date picker | All |
| Rating | Star rating (1-5) | All |
| Opinion scale | Numeric scale (1-10) | All |
| Yes/No | Binary choice | All |
| Matrix | Rate multiple items using same scale | Standard & Enterprise |
| Ranking | Drag-and-drop ordering by preference | Enterprise |
| File upload | Images and PDFs | Enterprise |
| Website URL | URL with validation | All |

## Tech stack

- **Frontend**: Next.js 16 (App Router) + React 19
- **Backend**: Go 1.21+ with gRPC
- **Database**: PostgreSQL with SQLC for type-safe queries
- **Auth**: JWT token validation
- **i18n**: next-intl
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Animations**: Framer Motion
- **File storage**: S3-compatible (MinIO / AWS S3 / Cloudflare R2)

## Getting started

### Prerequisites

- Node.js 18+
- Go 1.21+
- PostgreSQL
- S3-compatible storage (optional, for file uploads)

### Installation Options

#### Option 1: Development Setup (Separate Frontend/Backend)

1. **Clone and install**
```bash
git clone https://github.com/yourusername/weladee-form.git
cd weladee-form
npm install
```

#### Option 2: Single Binary Distribution (Embedded Client)

Weladee Form can be built as a single binary containing both the Go backend and embedded Next.js frontend:

```bash
# Build the embedded binary (includes frontend)
make build-local

# The resulting binary (bin/weladee-form) contains:
# - Go gRPC server
# - Complete Next.js React frontend
# - All static assets (CSS, JS, images)
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
- `file_uploads` - File metadata
- `form_views` - View & interaction tracking
- `response_starts` - Response start tracking
- `question_interactions` - Question interaction tracking
- `daily_stats` - Aggregated daily analytics
- `question_stats` - Question statistics

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
- `--s3-region`: S3 region (default: auto)
- `--s3-bucket`: S3 bucket name
- `--s3-access-key`: S3 access key
- `--s3-secret-key`: S3 secret key
- `--s3-endpoint`: S3 endpoint URL
- `--recaptcha-enabled`: Enable reCAPTCHA v3 globally (default: false)
- `--recaptcha-site-key`: Google reCAPTCHA site key
- `--recaptcha-secret-key`: Google reCAPTCHA secret key
- `--recaptcha-threshold`: Score threshold (0.0-1.0, default: 0.5)

#### Method 2: Environment Variables
```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
export GRPC_PORT="50051"

# Optional: reCAPTCHA v3 for bot protection
export RECAPTCHA_ENABLED=true
export RECAPTCHA_SITE_KEY="your-site-key-here"
export RECAPTCHA_SECRET_KEY="your-secret-key-here"
export RECAPTCHA_THRESHOLD=0.5

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

# Optional S3 configuration
s3_region: "auto"
s3_bucket: "your-bucket"
s3_access_key: "your-key"
s3_secret_key: "your-secret"
s3_endpoint: "https://your-endpoint.com"

# Optional reCAPTCHA v3 configuration
recaptcha:
  enabled: false          # Global toggle for reCAPTCHA
  site_key: "your-site-key-here"
  secret_key: "your-secret-key-here"
  threshold: 0.5         # Score threshold (0.0-1.0), default 0.5
```

**Note:** The application will automatically load `config.yaml` from the current directory or `./config/` directory if it exists.

### 4. Generate RSA Keys for JWT Authentication

For production use with asymmetric JWT signing (RS256), generate RSA key pairs:

```bash
# Generate RSA key pair (default: 2048-bit)
./bin/weladee-form generate-keys

# Generate with custom output directory
./bin/weladee-form generate-keys --output-dir /path/to/keys

# Generate with custom file names
./bin/weladee-form generate-keys --private-key-file my-private.pem --public-key-file my-public.pem

# Generate 4096-bit keys
./bin/weladee-form generate-keys --bits 4096
```

**Key Usage**:
- **Private key** (`jwt-private.pem`): Used by calling applications (e.g., Weladee portal) to sign JWT tokens
- **Public key** (`jwt-public.pem`): Used by Weladee Form to validate JWT tokens

Configure the public key path:
```bash
export JWT_PUBLIC_KEY_PATH="/path/to/jwt-public.pem"
./bin/weladee-form serve
```

### 4.1. Generate JWT Tokens (for testing/debugging)

For testing and debugging purposes, you can generate JWT tokens using the built-in CLI:

```bash
# Generate JWT token with command line flags
./bin/weladee-form create-jwt --name "John Doe" --email "john@example.com"

# Generate JWT token with customer type (affects feature access)
./bin/weladee-form create-jwt --name "Enterprise User" --email "user@company.com" --customer-type enterprise --logo-url "https://company.com/logo.png"

# Generate for different customer types
./bin/weladee-form create-jwt --name "SME User" --email "sme@example.com" --customer-type sme
./bin/weladee-form create-jwt --name "Standard User" --email "standard@example.com" --customer-type standard

# Generate JWT token interactively (will prompt for name and email)
./bin/weladee-form create-jwt

# Generate with Redirect URL (for token expiration)
./bin/weladee-form create-jwt --redirect-url "https://myapp.com/login"

# Use custom JWT secret (defaults to built-in secret)
JWT_SECRET="your-custom-secret" ./bin/weladee-form create-jwt --name "John Doe" --email "john@example.com"
```

**Available Flags**:
- `--name`: User display name (default: "eric")
- `--email`: User email address (default: "eric.fairon@gmail.com")
- `--customer-type`: Customer tier - `sme`, `standard`, or `enterprise` (default: "enterprise")
- `--logo-url`: Company logo URL for enterprise branding (optional)
- `--redirect-url`: URL to redirect when token expires (optional)

The generated token will be valid for 2 hours and can be used for authentication with the backend API.

### 4.2. Configure reCAPTCHA v3 (Optional)

Weladee Form supports Google reCAPTCHA v3 for bot protection. This is an **invisible** CAPTCHA that doesn't require user interaction.

#### Getting reCAPTCHA Keys

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register your site/domain
3. Select **reCAPTCHA v3**
4. Add your domain (e.g., `localhost` for development)
5. Copy the **Site Key** and **Secret Key**

#### Configuration

Add reCAPTCHA configuration via any of the three methods:

**Command line flags:**
```bash
./bin/weladee-form \
  --recaptcha-enabled=true \
  --recaptcha-site-key="6Lxxxxxxxxxxxxxxxx" \
  --recaptcha-secret-key="6Lxxxxxxxxxxxxxxxx" \
  --recaptcha-threshold=0.5
```

**Environment variables:**
```bash
export RECAPTCHA_ENABLED=true
export RECAPTCHA_SITE_KEY="6Lxxxxxxxxxxxxxxxx"
export RECAPTCHA_SECRET_KEY="6Lxxxxxxxxxxxxxxxx"
export RECAPTCHA_THRESHOLD=0.5
```

**Configuration file (`config.yaml`):**
```yaml
recaptcha:
  enabled: true
  site_key: "6Lxxxxxxxxxxxxxxxx"
  secret_key: "6Lxxxxxxxxxxxxxxxx"
  threshold: 0.5
```

#### Per-Form Setting

Once reCAPTCHA is globally enabled, you can enable it per-form in the form builder:

1. Go to **Settings** tab in the form builder
2. Toggle **Force CAPTCHA** to enable
3. Save the form

The form will now require reCAPTCHA verification on submission.

#### How it Works

- **Invisible**: No user interaction required
- **Score-based**: Returns a score (0.0 = likely bot, 1.0 = likely human)
- **Configurable threshold**: Submissions below the threshold are rejected (default: 0.5)
- **Per-form control**: Enable/disable per form in the form builder

### 5. Run the Application

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
│   ├── auth/             # Authentication (JWT token validation)
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

**Important:** This application has **NO** standalone login page. It is designed to be embedded or accessed from another application that provides a JWT token.

- **Access:** A valid JWT token is mandatory to access the application. Accessing without a token will result in an error or a mandatory token page.
- **Transport:**
    - **URL:** Passed via the `?token=<jwt_token>` parameter for initial access.
    - **gRPC:** Passed in the `Authorization: Bearer <token>` header for API calls.
- **Validation:** The Go backend's auth interceptor validates the token on every request.
- **Internal:** Uses JWT token validation. User claims are extracted and added to the request context.

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
./bin/weladee-form serve                       # Run server
./bin/weladee-form create-jwt --name "John Doe" --email "john@example.com"  # Generate JWT token
./bin/weladee-form config                      # Open config.yaml in nano editor
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
- `progress_bar_style` (enum: none, linear, steps, circular)
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
- `uploaded_by_user_id` (UUID, nullable)
- `created_at`

**form.form_views** - View & interaction tracking
- `id` (UUID)
- `form_id` (UUID)
- `session_id` (varchar, nullable)
- `user_id` (UUID, nullable)
- `ip_address` (inet), `user_agent` (text)
- `referrer` (text), `device_type` (varchar)
- `browser` (varchar), `os` (varchar)
- `country` (varchar), `city` (varchar)
- `viewed_at` (timestamptz)

**form.response_starts** - Response start tracking
- `id` (UUID)
- `form_id` (UUID)
- `session_id` (varchar)
- `started_at` (timestamptz)

**form.question_interactions** - Question interaction tracking
- `id` (UUID)
- `form_id`, `question_id`, `response_id` (UUIDs)
- `session_id` (varchar)
- `interaction_type` (varchar)
- `time_spent_seconds` (integer)
- `created_at` (timestamptz)

**form.daily_stats** - Aggregated daily analytics
- `id` (UUID)
- `form_id` (UUID)
- `stat_date` (date)
- `total_views`, `unique_views`, `total_starts`, `total_completions`
- `desktop_views`, `mobile_views`, `tablet_views`
- `avg_completion_time_seconds` (integer)
- `created_at`, `updated_at`

**form.question_stats** - Question statistics
- `id` (UUID)
- `question_id` (UUID)
- `answer_value` (text)
- `response_count` (integer)
- `percentage` (decimal)
- `last_updated` (timestamptz)

## License

MIT License - feel free to use this for any project.

## Contributing

Contributions are welcome. Please open an issue or pull request.
