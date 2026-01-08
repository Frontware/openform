# ADR 003: Next.js App Router with React Server Components

**Status:** Accepted
**Date:** 2024-01-01
**Context:** Frontend architecture decision
**Authors:** Frontend team

## Context

We needed to choose a React framework and routing strategy for the Weladee Form frontend. The primary options were:

1. Next.js Pages Router (traditional)
2. Next.js App Router (React Server Components)
3. Single Page App (Vite + React Router)
4. Remix

### Requirements

- Server-side rendering for SEO and performance
- Type-safe API communication
- Fast initial page load
- Good developer experience
- Support for public and authenticated routes

## Decision

We chose **Next.js 16 with App Router and React Server Components**.

### What is App Router?

Next.js App Router is the new routing system in Next.js 13+ that:
- Uses React Server Components by default
- Supports streaming and suspense
- Provides simpler data fetching patterns
- Has built-in layouts and error boundaries

## Rationale

### Advantages

1. **Performance**
   - Server Components render on the server (no client JS)
   - Streaming enables progressive page rendering
   - Automatic code splitting for Client Components
   - Faster initial page load

2. **Simplified Data Fetching**
   - Fetch data directly in Server Components
   - No need for useEffect + useState pattern
   - Parallel data fetching with Promise.all
   - Built-in fetch caching

3. **Type Safety**
   - Works seamlessly with our gRPC TypeScript types
   - Compile-time type checking across stack
   - Server-side validation before client render

4. **Route Organization**
   - Route groups for shared layouts `(main)`, `(form-player)`
   - Colocated components and pages
   - Simple file-based routing

5. **Built-in Features**
   - Image optimization
   - Font optimization
   - Internationalization (next-intl)
   - Error boundaries

### Architecture

```
app/
├── (main)/                    # Authenticated routes group
│   ├── layout.tsx            # Auth layout wrapper
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard (Server Component)
│   └── forms/
│       ├── [id]/
│       │   └── edit/
│       │       └── page.tsx  # Form builder (Server + Client)
│       └── new/
│           └── page.tsx
├── (form-player)/             # Public routes group
│   ├── layout.tsx            # Public layout (minimal)
│   └── f/
│       └── [slug]/
│           └── page.tsx      # Form player (Server + Client)
└── layout.tsx                # Root layout
```

## Alternatives Considered

### Next.js Pages Router

**Advantages:**
- Stable and mature
- Large ecosystem
- Simpler mental model (traditional SPA)

**Disadvantages:**
- No Server Components (everything renders on client)
- Slower initial page load
- More client-side JavaScript
- Less efficient data fetching

**Why not chosen:**
- App Router provides better performance
- Server Components reduce client JavaScript
- Future of Next.js development

### Vite + React Router

**Advantages:**
- Fast development server
- Simple setup
- Flexible routing

**Disadvantages:**
- No built-in SSR (need to add)
- No built-in optimizations
- More configuration needed
- Less opinionated architecture

**Why not chosen:**
- Next.js provides more out-of-the-box
- Better integration with our requirements
- Built-in image/font optimization

### Remix

**Advantages:**
- Server-first approach
- Built-in form handling
- Nested routes

**Disadvantages:**
- Smaller community than Next.js
- Less mature ecosystem
- Different mental model
- Fewer third-party integrations

**Why not chosen:**
- Next.js has larger community
- Better alignment with our tech stack
- More familiar to our team

## Implementation

### Route Structure

**Authenticated Routes (app/(main)):**
```typescript
// app/(main)/layout.tsx
export default function MainLayout({ children }) {
  const token = getToken()
  if (!token) {
    redirect('/?auth=required')
  }
  return <main>{children}</main>
}
```

**Public Routes (app/(form-player)):**
```typescript
// app/(form-player)/f/[slug]/page.tsx
export default async function FormPage({ params }) {
  // Server-side data fetching
  const form = await getFormBySlug(params.slug)

  return <FormPlayer form={form} />
}
```

### Server vs Client Components

**Server Component (Default):**
```typescript
// Data fetching on server
async function DashboardPage() {
  const forms = await getUserForms()

  return (
    <div>
      <h1>My Forms</h1>
      <FormsList forms={forms} />
    </div>
  )
}
```

**Client Component (when needed):**
```typescript
'use client'

import { useState } from 'react'

export function FormBuilder({ form }) {
  const [dirty, setDirty] = useState(false)

  return <form>{/* interactive UI */}</form>
}
```

### Data Fetching

**Server Component:**
```typescript
import { formClient } from '@/lib/grpc-client'

export default async function FormsPage() {
  // Fetch on server
  const response = await formClient.listForms({
    pagination: { page: 1, pageSize: 50 }
  })

  return <FormsTable forms={response.forms} />
}
```

**Client Component with Server Data:**
```typescript
async function loadData(formId: string) {
  'use server'

  const response = await formClient.getForm({
    id: formId,
    includeQuestions: true
  })

  return response.form
}

export default function FormEditor({ formId }) {
  const [form, setForm] = useState(null)

  useEffect(() => {
    loadData(formId).then(setForm)
  }, [formId])

  return <Editor form={form} />
}
```

### Middleware for Auth

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')
  const isAuthPage = request.nextUrl.pathname.startsWith('/dashboard')

  if (isAuthPage && !token) {
    return NextResponse.redirect(new URL('/?auth=required', request.url))
  }
}
```

## Consequences

### Positive

- **Performance:** Server Components reduce client JavaScript
- **SEO:** Public forms are server-rendered
- **Developer Experience:** Simpler data fetching patterns
- **Type Safety:** Works well with our gRPC types
- **Future-Proof:** App Router is the future of Next.js

### Negative

- **Learning Curve:** New paradigm for the team
- **Split Mental Model:** Server vs Client Components
- **Smaller Ecosystem:** Fewer libraries support RSC yet

### Trade-offs

- Accepting learning curve for better performance
- Splitting components by capability (server vs client)
- Investing in Next.js future over stable patterns

## Best Practices

### 1. Default to Server Components

Only use `'use client'` when you need:
- Event handlers (onClick, onChange)
- State (useState, useReducer)
- Browser APIs (localStorage, window)
- React hooks (useEffect, useContext)

### 2. Co-locate Components

Keep components close to where they're used:
```
app/(main)/dashboard/
├── page.tsx           # Dashboard page
├── components/        # Dashboard-specific components
│   ├── stats-card.tsx
│   └── forms-list.tsx
```

### 3. Error Boundaries

```typescript
// app/(main)/dashboard/error.tsx
'use client'

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Related Decisions

- [ADR 001: gRPC over REST](./001-grpc-over-rest.md)
- [ADR 004: Protobuf Types](./004-protobuf-types.md)

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [React Server Components](https://react.dev/reference/rsc/server-components)
