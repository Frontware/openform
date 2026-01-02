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
- **i18n:** Multi-language support (English, Thai).

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
- `app/(auth)/`: Authentication routes (login).
- `app/(dashboard)/`: Protected routes for authenticated users (dashboard, editor, settings).
- `app/f/[slug]/`: Public-facing form player routes.
- `app/api/`: Backend API routes (e.g., file upload).
- `src/i18n/`: Internationalization routing and configuration.
- `src/messages/`: Translation files (en, th).
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
