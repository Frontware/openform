# Weladee Form

A beautiful, open-source TypeForm alternative. Create engaging forms with a one-question-at-a-time experience.

![Weladee Form Logo](logo.png)

## Features

- **7 beautiful themes** - Midnight, Ocean, Sunset, Forest, Lavender, Weladee, Minimal
- **Keyboard navigation** - Navigate with Enter, arrow keys, and scroll wheel
- **Mobile-first forms** - Responsive form-taking experience
- **Secure authentication** - Google OAuth and Magic Link
- **Response dashboard** - View, search, filter, and export to CSV
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

- **Framework**: Next.js 16 (App Router)
- **Backend**: Go (gRPC)
- **Database**: PostgreSQL
- **Auth**: Google OAuth + Magic Link
- **i18n**: next-intl
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Animations**: Framer Motion
- **File storage**: S3 (MinIO / AWS)

## Getting started

### Prerequisites

- Node.js 18+
- Go 1.22+
- PostgreSQL
- Redis (for session management)
- SMTP server (for email authentication)
- S3-compatible storage (optional, for file uploads)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/weladee-form.git
cd weladee-form
```

### 2. Set up Database

1. Create a PostgreSQL database.
2. Run the schema migration:
   ```bash
   psql -d your_database -f sql/schema/form_schema.sql
   ```

### 3. Configure Environment

Weladee Form supports three methods for configuration, in order of priority:

#### Priority Order
1. **Command line flags** (highest priority)
2. **Environment variables**
3. **config.yaml file** (lowest priority)

#### Method 1: Command Line Flags
```bash
# Using long flags
./weladee-form --database-url="postgresql://user:pass@localhost/db" --grpc-port=8080

# Using short flags
./weladee-form -d "postgresql://user:pass@localhost/db" -p 8080
```

Available flags:
- `-p, --grpc-port`: gRPC server port (default: 50051)
- `-d, --database-url`: PostgreSQL database URL (required)
- `-r, --redis-url`: Redis server URL (default: redis://localhost:6379)
- `--redis-prefix`: Redis key prefix (default: weladee:auth:token)
- `--smtp-host`: SMTP server host (e.g., smtp.gmail.com)
- `--smtp-port`: SMTP server port (default: 587)
- `--smtp-username`: SMTP server username
- `--smtp-password`: SMTP server password
- `--smtp-from`: SMTP from email address
- `--google-client-id`: Google OAuth client ID
- `--google-client-secret`: Google OAuth client secret
- `--oauth-redirect-url`: OAuth redirect URL
- `--jwt-secret`: JWT secret key
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
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USERNAME="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
export SMTP_FROM="noreply@yourdomain.com"
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export OAUTH_REDIRECT_URL="http://localhost:3000/auth/callback"
export JWT_SECRET="your-jwt-secret-key"
# ... other variables

./weladee-form
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

# SMTP configuration (required for email authentication)
smtp_host: "smtp.gmail.com"
smtp_port: "587"
smtp_username: "your-email@gmail.com"
smtp_password: "your-app-password"
smtp_from: "noreply@yourdomain.com"

# OAuth configuration (required for Google authentication)
google_client_id: "your-google-client-id"
google_client_secret: "your-google-client-secret"
oauth_redirect_url: "http://localhost:3000/auth/callback"
jwt_secret: "your-jwt-secret-key"

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
go run cmd/server/main.go
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
├── app/
│   ├── (main)/           # Main application routes (localized)
│   ├── (form-player)/    # Public form player routes
│   └── api/              # API routes
├── cmd/                  # Go application entrypoints
├── internal/             # Private application code
├── sql/                  # SQL queries and schemas
├── proto/                # gRPC protocol buffers
├── components/           # React components
├── lib/                  # Shared libraries
├── i18n/                 # Internationalization config
└── messages/             # Translation files
```

## License

MIT License - feel free to use this for any project.

## Contributing

Contributions are welcome. Please open an issue or pull request.
