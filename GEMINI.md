# Weladee Form Context

## Project Overview
Weladee Form is an open-source TypeForm alternative built with Next.js 16 (App Router). It allows users to create engaging, one-question-at-a-time forms with a focus on beautiful UX/UI and responsiveness.

**Key Features:**
- **Form Builder:** Create and edit forms with various question types (Text, Rating, File Upload, etc.).
- **Themes:** Customizable themes (Midnight, Ocean, Sunset, Weladee, etc.).
- **Form Player:** "TypeForm-style" navigation (Enter, arrows, scroll).
- **Responses:** Dashboard to view, filter, and export form responses.
- **Authentication:** Supabase Auth (Google OAuth, Magic Link).
- **Storage:** Cloudflare R2 (optional) for file uploads.
- **i18n:** Multi-language support (English, Thai, French).

## Tech Stack
- **Framework:** Next.js 16 (App Router), React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Animations:** Framer Motion
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Forms:** React Hook Form, Zod
- **i18n:** next-intl

## Project Structure
- `app/(main)/[locale]/`: Main application routes (dashboard, auth, landing) wrapped with localization provider.
- `app/(form-player)/`: Public-facing form player routes (unlocalized or handled separately).
- `app/api/`: Backend API routes (e.g., file upload).
- `i18n/`: Internationalization routing and configuration.
- `messages/`: Translation files (en, th, fr).
- `components/`:
    - `ui/`: Reusable UI components (likely shadcn/ui).
    - `form-builder/`: Components for the editor interface.
    - `form-player/`: Components for the public form rendering.
    - `dashboard/`: Dashboard-specific components.
- `lib/`:
    - `supabase/`: Supabase client initialization (client, server, middleware).
    - `database.types.ts`: TypeScript definitions for Supabase schema.
    - `questions.ts`: Definitions for supported question types.
    - `themes.ts`: Theme configurations.
- `supabase/schema.sql`: SQL schema for the database.

## Building and Running

### Prerequisites
- Node.js 18+
- Supabase project (configured with `schema.sql`)
- `.env.local` file with Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### Backend Configuration

The backend supports three configuration methods with the following priority:

1. **Command line flags** (highest priority)
2. **Environment variables**
3. **config.yaml file** (lowest priority)

#### Configuration Options

| Option | Flag | Environment Variable | Default | Description |
|--------|------|---------------------|---------|-------------|
| gRPC Port | `-p, --grpc-port` | `GRPC_PORT` | `50051` | gRPC server port |
| Database URL | `-d, --database-url` | `DATABASE_URL` | - | PostgreSQL connection URL (required) |
| Redis URL | `-r, --redis-url` | `REDIS_URL` | `redis://localhost:6379` | Redis server URL |
| Redis Prefix | `--redis-prefix` | `REDIS_KEY_PREFIX` | `weladee:auth:token` | Redis key prefix |
| S3 Region | `--s3-region` | `S3_REGION` | `auto` | S3 region |
| S3 Bucket | `--s3-bucket` | `S3_BUCKET` | - | S3 bucket name |
| S3 Access Key | `--s3-access-key` | `S3_ACCESS_KEY` | - | S3 access key |
| S3 Secret Key | `--s3-secret-key` | `S3_SECRET_KEY` | - | S3 secret key |
| S3 Endpoint | `--s3-endpoint` | `S3_ENDPOINT` | - | S3 endpoint URL |

#### Usage Examples

**Command Line:**
```bash
./weladee-form --database-url="postgresql://user:pass@localhost/db" --grpc-port=8080
```

**Environment Variables:**
```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
export GRPC_PORT="8080"
./weladee-form
```

**Configuration File:**
```yaml
grpc_port: "8080"
database_url: "postgresql://user:pass@localhost/db"
redis_url: "redis://localhost:6379"
```

### Commands
- **Install Dependencies:** `npm install`
- **Development Server:** `npm run dev` (Runs on http://localhost:3000)
- **Build for Production:** `npm run build`
- **Start Production Server:** `npm run start`
- **Lint:** `npm run lint`

## Development Conventions
- **Routing:** Uses Next.js App Router with Route Groups `(auth)` and `(dashboard)` to organize layouts.
- **Styling:** Tailwind CSS utility classes. Animations using `framer-motion`.
- **State Management:** React Server Components (RSC) for data fetching where possible. Client components for interactivity.
- **Database:** Supabase Client for client-side interactions, Supabase Server Client (cookies) for server-side/middleware.
- **Type Safety:** Strict TypeScript usage. Database types generated/defined in `lib/database.types.ts`.
