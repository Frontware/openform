---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [framework] | --c4-model | --arc42 | --adr | --plantuml | --mermaid | --postgres-doc | --full-suite
description: Generate comprehensive architecture documentation for Weladee Form with C4 diagrams, ADRs, database schema docs, and interactive visualization
---

# Weladee Form Architecture Documentation Generator

Generate comprehensive architecture documentation: $ARGUMENTS

## Current Architecture Context (Weladee Form)

- **Project**: Weladee Form (open-source Typeform alternative) – https://github.com/Frontware/openform (branch: feature/grpc-migration)
- **Stack**: Go (gRPC backend) + Next.js (React/TypeScript frontend) + PostgreSQL (with SQLC) + Protobuf
- **Project structure overview**:
  - Backend: `cmd/`, `internal/`, `proto/`, `sql/`
  - Frontend: `app/`, `components/`, `lib/`, `hooks/`, `types/`
  - Database: `sql/schema/` (migrations), `sql/queries/` (SQLC queries)
- **Key files**:
  - gRPC definitions: `proto/form.proto`, `proto/response.proto`, etc.
  - Database schemas & queries: `sql/schema/`, `sql/queries/`
  - Configuration: `config.yaml`, `.env.example`
  - Frontend routes: `app/(main)/` (dashboard/editor), `app/(form-player)/` (public form renderer)
- **Database documentation**: `sql/Makefile` supports `make doc` for automated PostgreSQL schema documentation

## Task

Generate comprehensive, up-to-date architecture documentation for **Weladee Form** using modern tooling and best practices:

1. **Architecture Analysis and Discovery**
   - Analyze the full-stack architecture: Next.js frontend ↔ Go gRPC backend ↔ PostgreSQL
   - Identify key components: Form Editor, Form Player, gRPC services (FormService, ResponseService, AuthService), SQLC query layer
   - Document data flow: form creation → storage → public rendering → submission → response storage
   - Identify architectural patterns: Clean Architecture (internal layers), gRPC communication, server-side rendering in Next.js
   - Highlight current strengths (type-safety via protobuf/SQLC) and potential debt (e.g., duplication, missing abstractions)

2. **Architecture Documentation Framework**
   - Recommended primary framework: **C4 Model** (Context, Containers, Components, Code)
   - Alternatives: arc42 sections where deeper narrative is needed
   - Diagrams: Prefer **Mermaid.js** (already compatible with Next.js/MDX) and **PlantUML** for complex views
   - ADRs: Use standard ADR format in `docs/adr/`

3. **System Context Documentation (C4 Level 1)**
   - Create System Context diagram showing:
     - Users (Form Creators, Respondents)
     - Weladee Form system
     - External integrations (future: Google reCAPTCHA, email notifications, etc.)
   - Document user personas: Team admins, form designers, anonymous respondents
   - Define system scope and boundaries

4. **Container Architecture (C4 Level 2)**
   - Document containers:
     - Next.js Web Application (SSR + Client)
     - Go gRPC Server
     - PostgreSQL Database
   - Create Container diagram with communication flows (HTTP → gRPC-Web → gRPC → SQLC → PostgreSQL)
   - Document deployment model (single binary + Next.js build, Docker support if present)
   - API contracts: Reference protobuf definitions

5. **Component Architecture (C4 Level 3)**
   - Backend components:
     - gRPC handlers (internal/gapi/)
     - Business logic (internal/service/)
     - Repository layer (SQLC-generated + custom queries)
     - Auth (JWT, session handling)
   - Frontend components:
     - Form Editor (app/(main)/forms/)
     - Form Player (app/(form-player)/f/[id]/)
     - Shared components (shadcn/ui, question types)
     - gRPC client layer (lib/grpc/)
   - Create detailed Component diagrams for both frontend and backend

6. **Data Architecture Documentation**
   - Document PostgreSQL schema (tables: forms, questions, responses, users, etc.)
   - **Automated PostgreSQL Documentation**:
     - Run `cd sql && make doc` to generate latest schema docs
     - Include generated HTML/PDF in final documentation
   - Create ER diagram from schema (via make doc or external tool)
   - Document SQLC query patterns and mapping to Go structs
   - Data flow: Form → Questions → Responses → Analytics (if any)
   - Document constraints, indexes, row-level security (if implemented)
   - Generate data dictionary with table/column descriptions and relationships

7. **Security Architecture**
   - Document authentication flow (JWT via gRPC metadata)
   - Public vs authenticated endpoints
   - Form access control (private/public, ownership)
   - Potential bot protection (future CAPTCHA integration)
   - Database security considerations (connection pooling, least privilege)

8. **Quality Attributes and Cross-Cutting Concerns**
   - Performance: SSR for form player, gRPC efficiency
   - Scalability: Stateless services, database as potential bottleneck
   - Maintainability: Protobuf → Go/TS code generation, SQLC
   - Observability: Logging, error handling patterns
   - Database backup/recovery strategy recommendations

9. **Architecture Decision Records (ADRs)**
   - Create `docs/adr/` directory with template
   - Propose and document key past/present decisions:
     - Choice of gRPC over REST
     - Use of SQLC instead of ORM
     - Next.js App Router + React Server Components
     - Protobuf for full-stack type safety
     - Migration to gRPC (current branch context)
   - Document trade-offs and alternatives considered

10. **Documentation Automation and Maintenance**
    - Set up Mermaid diagrams in Markdown/MDX files
    - Integrate `make doc` from sql/ into documentation build
    - Recommend CI pipeline to regenerate docs on schema changes
    - Suggest documentation site (e.g., Next.js docs section or Docusaurus)
    - Version documentation with git tags/releases
    - **Database Documentation Automation**:
      - Automate `cd sql && make doc` in CI
      - Generate schema diff reports on migrations
      - Include SQLC query overview in docs
      - Track database changelog

## Output Expectations

Produce a complete, professional architecture documentation package suitable for:
- Onboarding new developers
- Future feature planning (e.g., CAPTCHA, analytics, integrations)
- Open-source community contribution

Include diagrams as Mermaid code blocks (runnable in docs), reference generated PostgreSQL docs, and organize everything under a new `docs/architecture/` directory structure.
```
