# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenForm is an open-source TypeForm alternative built with Next.js 16 (App Router). It allows users to create beautiful, one-question-at-a-time forms with 6 themes and 13 question types. Forms are published publicly via unique slugs and responses are collected with optional authentication.

**Key Features:**
- **Form Builder** - Create forms with drag-and-drop question ordering (components/form-builder/)
- **Form Player** - TypeForm-style one-question-at-a-time taking experience with keyboard navigation (components/form-player/)
- **Response Dashboard** - View, search, filter, and export responses to CSV (components/responses/)
- **Themes** - 6 preset themes: midnight, ocean, sunset, forest, lavender, minimal (lib/themes.ts)
- **Authentication** - Supabase Auth (Google OAuth + Magic Link)

## Development Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Configure required Supabase environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

3. (Optional) For file uploads, configure Cloudflare R2:
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

4. Run the database schema from `supabase/schema.sql` in Supabase SQL Editor

## Architecture

### Route Structure (App Router)

- `app/(auth)/` - Authentication routes (login page)
- `app/(dashboard)/` - Protected routes requiring authentication
  - `dashboard/` - List of user's forms
  - `forms/new` - Create new form
  - `forms/[id]/edit` - Form builder/editor
  - `forms/[id]/responses` - View and manage form responses
  - `settings/` - User settings
- `app/f/[slug]/` - Public form pages (no auth required, handled by middleware exclusion)
- `app/api/upload` - File upload API endpoint
- `app/auth/callback` - OAuth callback handler

### Middleware Protection

The middleware (`middleware.ts`) protects all routes except:
- Static files (`_next/static`, `_next/image`, public folder)
- Public form pages (`/f/*` - used by respondents to take forms)
- Auth callback (`/auth/callback`)

### Key Directories

- `components/ui/` - shadcn/ui base components (Radix UI primitives)
- `components/form-builder/` - Form creation/editing UI
- `components/form-player/` - Public form display with one-question-at-a-time navigation
- `components/dashboard/` - Dashboard-specific components
- `components/responses/` - Response management UI with search/filter/export
- `lib/supabase/` - Supabase client initialization (client, server, middleware)
- `lib/database.types.ts` - TypeScript types for database schema
- `lib/questions.ts` - Question type definitions and helper functions
- `lib/themes.ts` - Theme configuration objects
- `supabase/schema.sql` - PostgreSQL schema with RLS policies

## Data Model

### Tables (Supabase/PostgreSQL)

**profiles** - User profiles extending `auth.users`
- `id` (UUID, references auth.users)
- `email`, `full_name`, `avatar_url`

**forms** - Form definitions
- `id`, `user_id`, `title`, `description`, `slug` (unique per user)
- `status` (enum: draft, published, closed)
- `theme` (enum: midnight, ocean, sunset, forest, lavender, minimal)
- `questions` (JSONB array of QuestionConfig)
- `thank_you_message`

**responses** - Form submissions
- `id`, `form_id`, `answers` (JSONB), `submitted_at`

### Row Level Security (RLS)

All tables have RLS policies:
- Users can only access their own profiles, forms, and responses
- Published forms are publicly readable (for `/f/[slug]` pages)
- Anyone can submit responses to published forms

## Question Types (13 total)

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
| `file_upload` | Images/PDFs | `allowedFileTypes[]`, `maxFileSize` (MB) |
| `url` | Website URL | `placeholder` |

Helper functions:
- `getQuestionTypeInfo(type)` - Get info for a question type
- `createDefaultQuestion(type)` - Create a new question with defaults

## Theme System

Defined in `lib/themes.ts` with 6 presets. Each theme has:
- `primaryColor`, `backgroundColor`, `textColor`, `accentColor`
- `fontFamily`

Helper functions:
- `getTheme(preset)` - Get theme config by preset name
- `getThemeCSSVariables(theme)` - Convert to CSS custom properties

## Supabase Client Usage

- **Client-side** - `createClient()` from `lib/supabase/client.ts`
- **Server-side** - `createClient()` from `lib/supabase/server.ts` (uses cookies)
- **Middleware** - `updateSession()` from `lib/supabase/middleware.ts`

## Keyboard Navigation (Form Player)

The form player (`components/form-player/`) supports:
- **Enter** - Submit answer and move to next question
- **Arrow keys** - Navigate between questions
- **Scroll wheel** - Navigate between questions

## File Upload Flow

1. File selected in form player
2. Upload to `app/api/upload/route.ts` (Cloudflare R2)
3. Returns file URL to be stored in response answers
4. Requires R2 environment variables to be configured

## Common Patterns

### Creating a new form

```typescript
import { createClient } from '@/lib/supabase/server'
import { createDefaultQuestion } from '@/lib/questions'

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()

const slug = generateUniqueSlug(title, user.id) // Uses PostgreSQL function

const { data: form } = await supabase
  .from('forms')
  .insert({
    user_id: user.id,
    title,
    slug,
    questions: [createDefaultQuestion('short_text')],
    theme: 'minimal',
  })
  .select()
  .single()
```

### Fetching form by slug (public)

```typescript
const supabase = createClient()
const { data: form } = await supabase
  .from('forms')
  .select('*')
  .eq('slug', slug)
  .eq('status', 'published')
  .single()
```

### Submitting a response

```typescript
const { data: response } = await supabase
  .from('responses')
  .insert({
    form_id: form.id,
    answers: {
      'question-id-1': 'answer value',
      'question-id-2': ['choice1', 'choice2'],
    },
  })
  .select()
  .single()
```

## Type Safety

All database types are defined in `lib/database.types.ts`:
- `Profile`, `Form`, `Response` - Database row types
- `FormInsert`, `FormUpdate` - Insert/update types
- `QuestionConfig`, `ThemeConfig` - Domain types

When updating Supabase schema, regenerate types:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
```

## Dependencies

- **Next.js 16** - App Router with React 19
- **Supabase** - Database, Auth, Storage (@supabase/supabase-js, @supabase/ssr)
- **shadcn/ui** - Component library built on Radix UI
- **Tailwind CSS 4** - Styling
- **Framer Motion** - Animations
- **React Hook Form + Zod** - Form validation
- **Lucide React** - Icons
