# ADR 004: End-to-End Type Safety with Protobuf

**Status:** Accepted
**Date:** 2024-01-01
**Context:** Architecture decision for type safety
**Authors:** Architecture team

## Context

We wanted to achieve end-to-end type safety across the entire stack - from database to frontend. The challenge was maintaining type consistency across:

1. PostgreSQL database schema
2. Go backend (gRPC services)
3. TypeScript/React frontend

### Requirements

- Single source of truth for types
- Compile-time type checking
- No manual type maintenance
- Detect breaking changes at compile time

## Decision

We achieved end-to-end type safety through **code generation at each layer**:

1. **Database Layer:** SQLC generates Go types from SQL schema
2. **API Layer:** Protobuf generates Go and TypeScript types from `.proto` files
3. **Conversion Layer:** Manual mapping between SQLC and Protobuf types

## Architecture

```
┌─────────────────┐     SQLC      ┌─────────────────┐
│  PostgreSQL     │ ──────────►  │  Go Types       │
│  Schema         │              │  (SQLC)         │
└─────────────────┘              └─────────────────┘
                                              │
                                              │ Manual mapping
                                              ▼
┌─────────────────┐    Protobuf   ┌─────────────────┐
│  TypeScript     │ ◄─────────── │  Protobuf       │
│  Frontend       │              │  Definitions    │
└─────────────────┘              └─────────────────┘
```

## Implementation

### 1. Database Schema (Source of Truth)

**File:** `sql/schema/form_schema.sql`
```sql
CREATE TABLE IF NOT EXISTS form.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES form.users(id),
    title VARCHAR(500) NOT NULL,
    theme VARCHAR(50) NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. SQLC Generates Go Types

**Generated:** `internal/db/sqlc/models.go`
```go
type FormForm struct {
    ID          uuid.UUID
    UserID      uuid.UUID
    Title       string
    Description sql.NullString
    Theme       string
    IsPublished bool
    CreatedAt   time.Time
}
```

### 3. Protobuf Definitions

**File:** `proto/form.proto`
```protobuf
message Form {
  string id = 1;
  string user_id = 2;
  string title = 3;
  string description = 4;
  FormTheme theme = 5;
  bool is_published = 6;
  google.protobuf.Timestamp created_at = 7;
}

enum FormTheme {
  FORM_THEME_MINIMAL = 1;
  FORM_THEME_MIDNIGHT = 2;
  // ...
}
```

### 4. Protobuf Generates Go Types

**Generated:** `proto/pb/form.pb.go`
```go
type Form struct {
    Id          string
    UserId      string
    Title       string
    Description string
    Theme       FormTheme
    IsPublished bool
    CreatedAt   *timestamppb.Timestamp
}
```

### 5. Protobuf Generates TypeScript Types

**Generated:** `lib/proto/proto/form.ts`
```typescript
export interface Form {
  id: string
  userId: string
  title: string
  description: string
  theme: FormTheme
  isPublished: boolean
  createdAt?: Date
}

export enum FormTheme {
  FORM_THEME_MINIMAL = 1,
  FORM_THEME_MIDNIGHT = 2,
  // ...
}
```

### 6. Conversion Functions

**File:** `internal/gapi/mappers.go`
```go
// SQLC → Protobuf
func FormFormToProto(form db.FormForm) *pb.Form {
    return &pb.Form{
        Id:          form.ID.String(),
        UserId:      form.UserID.String(),
        Title:       form.Title,
        Description: form.Description.String,
        Theme:       FormThemeFromString(form.Theme),
        IsPublished: form.IsPublished,
        CreatedAt:   timestamppb.New(form.CreatedAt),
    }
}

// Protobuf → SQLC
func ProtoToFormForm(form *pb.Form) db.FormForm {
    return db.FormForm{
        ID:          uuid.MustParse(form.Id),
        UserId:      uuid.MustParse(form.UserId),
        Title:       form.Title,
        Description: sql.NullString{String: form.Description, Valid: true},
        Theme:       form.Theme.String(),
        IsPublished: form.IsPublished,
        CreatedAt:   form.CreatedAt.AsTime(),
    }
}
```

## Benefits

### 1. Compile-Time Type Checking

```typescript
// TypeScript catches this at compile time
const response = await formClient.createForm({
  title: "My Form",
  theme: FormTheme.FORM_THEME_MINIMAL,
  invalidField: "oops" // ❌ Type error: 'invalidField' does not exist
})
```

```go
// Go compiler catches this
form, err := s.queries.CreateForm(ctx, db.CreateFormParams{
    Title: req.Title,
    Theme: req.Theme.String(),
    InvalidField: "oops", // ❌ Compile error: unknown field
})
```

### 2. No API Documentation Drift

The `.proto` files ARE the API documentation. Any change automatically updates:
- Go server code
- Go client code
- TypeScript types
- API documentation (from proto comments)

### 3. Refactoring Safety

If you rename a field in the proto:
- Compilation breaks in Go
- Type checking fails in TypeScript
- You must update all call sites

### 4. Self-Documenting Code

```typescript
// IDE shows all available fields and types
const form: Form = {
  id: string,
  title: string,
  theme: FormTheme,
  isPublished: boolean,
  // ...
}
```

## Trade-offs

### Advantages

1. **Type Safety:** Entire stack type-checked
2. **Single Source:** Proto files define API contracts
3. **No Drift:** Types always in sync
4. **Refactoring:** Safe with compiler support
5. **Documentation:** Live in code, not separate docs

### Disadvantages

1. **Code Generation:** Additional build step
2. **Generated Code:** Large files in repository
3. **Conversion Layer:** Manual mapping between SQLC and Protobuf
4. **Complexity:** More moving parts

### Mitigation Strategies

**1. Conversion Layer:**
- Create helper functions for common conversions
- Use consistent naming patterns
- Add tests for conversion functions

**2. Build Process:**
- Integrate code generation into Makefile
- Run `make proto` and `make db-generate` in CI
- Auto-format generated code

**3. Error Handling:**
- Validate at API boundaries
- Handle null/optional fields explicitly
- Add runtime assertions in development

## Example Flow

### Creating a Form

**1. Frontend (TypeScript):**
```typescript
// Type-safe request
const response = await formClient.createForm({
  title: "Customer Feedback",
  theme: FormTheme.FORM_THEME_OCEAN,
  questions: [{
    type: QuestionType.QUESTION_TYPE_SHORT_TEXT,
    label: "What is your name?",
    required: true,
    orderIndex: 0
  }]
})

// Type-safe response
const form: Form = response.form
console.log(form.id) // string
```

**2. Backend (Go):**
```go
// Type-safe request (generated from proto)
func (s *FormService) CreateForm(ctx context.Context, req *pb.CreateFormRequest) (*pb.CreateFormResponse, error) {
    // Type-safe database operation (generated by SQLC)
    form, err := s.queries.CreateForm(ctx, db.CreateFormParams{
        Title: req.Title,
        Theme: req.Theme.String(),
    })

    // Type-safe response (generated from proto)
    return &pb.CreateFormResponse{
        Form: FormFormToProto(form),
    }, nil
}
```

**3. Database (PostgreSQL):**
```sql
-- Type-safe schema
CREATE TABLE form.forms (
    id UUID,
    title VARCHAR(500) NOT NULL,
    theme VARCHAR(50) NOT NULL,
    CHECK (theme IN ('minimal', 'midnight', 'ocean', ...))
);
```

## Best Practices

### 1. Naming Conventions

**Database:** `snake_case`
```sql
form_id, is_published, created_at
```

**Go:** `PascalCase` (exported), `camelCase` (unexported)
```go
type FormForm struct {
    FormID     string
    IsPublished bool
}
```

**Protobuf:** `snake_case` for field names
```protobuf
string form_id = 1;
bool is_published = 6;
```

**TypeScript:** `camelCase`
```typescript
interface Form {
  formId: string
  isPublished: boolean
}
```

### 2. Null Handling

**PostgreSQL:**
```sql
description TEXT
```

**Go (SQLC):**
```go
Description sql.NullString
```

**Protobuf:**
```protobuf
optional string description = 4;  // Proto 3+
// or
string description = 4;  // Empty string = null
```

**TypeScript:**
```typescript
description?: string  // Optional
// or
description: string   // Empty string = null
```

### 3. Enum Handling

**PostgreSQL:**
```sql
theme VARCHAR(50) CHECK (theme IN ('minimal', 'midnight', ...))
```

**Protobuf:**
```protobuf
enum FormTheme {
  FORM_THEME_MINIMAL = 1;
  FORM_THEME_MIDNIGHT = 2;
  // ...
}
```

**Go Conversion:**
```go
func FormThemeFromString(s string) pb.FormTheme {
    switch s {
    case "minimal": return pb.FormTheme_FORM_THEME_MINIMAL
    case "midnight": return pb.FormTheme_FORM_THEME_MIDNIGHT
    default: return pb.FormTheme_FORM_THEME_UNSPECIFIED
    }
}
```

## Related Decisions

- [ADR 001: gRPC over REST](./001-grpc-over-rest.md)
- [ADR 002: SQLC over ORM](./002-sqlc-over-orm.md)
- [ADR 005: Connect Protocol](./005-connect-protocol.md)

## References

- [Protocol Buffers](https://protobuf.dev/)
- [SQLC](https://docs.sqlc.dev/)
