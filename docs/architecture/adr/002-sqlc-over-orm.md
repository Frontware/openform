# ADR 002: SQLC over ORM

**Status:** Accepted
**Date:** 2024-01-01
**Context:** Initial architecture decision
**Authors:** Architecture team

## Context

We needed to choose a database access layer for the Go backend. The primary options were:

1. Traditional ORM (GORM, sqlx)
2. SQLC (type-safe SQL code generation)

### Requirements

- Type-safe database operations
- Performance (prepared statements)
- Explicit SQL control
- Easy schema migrations
- Compatibility with PostgreSQL

## Decision

We chose **SQLC** for database access.

### What is SQLC?

SQLC is a code generator that produces type-safe Go code from SQL queries. You write SQL queries, and SQLC generates Go functions with proper types.

## Rationale

### Advantages

1. **Type Safety**
   - Generated Go structs match database schema exactly
   - Query parameters are type-checked at compile time
   - No runtime type assertions needed

2. **Performance**
   - Uses prepared statements
   - No reflection overhead
   - Minimal abstraction overhead

3. **SQL Control**
   - Write explicit SQL queries
   - Optimize queries as needed
   - No hidden N+1 problems
   - Easy to understand what SQL executes

4. **Schema as Source of Truth**
   - Database schema is authoritative
   - Generated code derives from schema
   - Changes detected at compile time

5. **No Magic**
   - Queries are visible in `sql/queries/*.sql`
   - No dynamic query generation
   - Predictable performance

### Example

**SQL Query:**
```sql
-- name: GetForm :one
SELECT * FROM form.forms
WHERE id = $1 LIMIT 1;
```

**Generated Go Code:**
```go
func (q *Queries) GetForm(ctx context.Context, id uuid.UUID) (FormForm, error) {
    row := q.db.QueryRow(ctx, getForm, id)
    var form FormForm
    err := row.Scan(
        &form.ID, &form.UserID, &form.Title,
        &form.Description, &form.Theme,
        // ... all columns
    )
    return form, err
}
```

**Usage:**
```go
form, err := queries.GetForm(ctx, formID)
// form is a FormForm struct with all fields
```

## Alternatives Considered

### GORM (Traditional ORM)

**Advantages:**
- Very popular Go ORM
- Rich feature set (associations, hooks, migrations)
- Easy to use for simple CRUD
- Large community

**Disadvantages:**
- Interface{} type usage reduces type safety
- Reflection overhead impacts performance
- Hidden query generation (harder to optimize)
- N+1 query problems common
- Complex API for advanced features

**Why not chosen:**
- Type safety was critical
- Performance matters for high-throughput API
- We prefer explicit SQL over query builders
- Our data model is straightforward (no complex associations)

### sqlx

**Advantages:**
- Lightweight extension to database/sql
- Explicit SQL queries
- Better performance than full ORM
- Simple API

**Disadvantages:**
- No type-safe query generation
- Manual struct scanning
- No compile-time verification
- Boilerplate for common queries

**Why not chosen:**
- SQLC provides same benefits with less boilerplate
- Compile-time type checking is valuable
- Code generation reduces repetitive code

### Upper/db

**Advantages:**
- Type-safe query builder
- Good PostgreSQL support
- Active development

**Disadvantages:**
- Still a query builder (not raw SQL)
- Less control over query execution
- Additional abstraction layer

**Why not chosen:**
- Prefer raw SQL for transparency
- SQLC's approach is simpler

## Implementation

### Schema Definition

**File:** `sql/schema/form_schema.sql`
```sql
CREATE TABLE IF NOT EXISTS form.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES form.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL DEFAULT 'Untitled Form',
    theme VARCHAR(50) NOT NULL DEFAULT 'minimal',
    -- ...
);
```

### Query Definitions

**File:** `sql/queries/form.sql`
```sql
-- name: CreateForm :one
INSERT INTO form.forms (
    user_id, title, description, theme
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetForm :one
SELECT * FROM form.forms
WHERE id = $1 LIMIT 1;

-- name: ListUserForms :many
SELECT * FROM form.forms
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUserForms :one
SELECT COUNT(*) FROM form.forms
WHERE user_id = $1;
```

### Code Generation

```bash
sqlc generate
```

**Generated Files:**
- `internal/db/sqlc/models.go` - Database models
- `internal/db/sqlc/form.sql.go` - Form query functions
- `internal/db/sqlc/response.sql.go` - Response query functions
- etc.

### Usage in Service Layer

```go
func (s *FormService) CreateForm(ctx context.Context, req *pb.CreateFormRequest) (*pb.CreateFormResponse, error) {
    // Type-safe query execution
    form, err := s.queries.CreateForm(ctx, db.CreateFormParams{
        UserID:      userID,
        Title:       req.Title,
        Description: sql.NullString{String: req.Description, Valid: req.Description != ""},
        Theme:       req.Theme.String(),
    })
    if err != nil {
        return nil, status.Error(codes.Internal, "failed to create form")
    }

    return &pb.CreateFormResponse{Form: convertFormToProto(form)}, nil
}
```

## Consequences

### Positive

- **Type Safety:** All database operations are type-checked
- **Performance:** Prepared statements, no reflection
- **Maintainability:** SQL queries are visible and explicit
- **Refactoring:** Schema changes break compilation
- **Testing:** Easy to mock generated interfaces

### Negative

- **Query Repetition:** Similar queries may be duplicated
- **Learning Curve:** Team must learn SQLC syntax
- **Generated Code:** Large generated files in repository

### Trade-offs

- Accepting query verbosity for type safety
- Writing SQL manually instead of query builder
- Committing generated code to repository

## Best Practices

### 1. Naming Conventions

**SQLC Comments:**
```sql
-- name: CreateForm :one
-- name: ListUserForms :many
-- name: UpdateFormTitle :exec
-- name: DeleteForm :exec
```

### 2. Null Handling

```go
// Optional fields use sql.Null* types
description := sql.NullString{
    String: req.Description,
    Valid:   req.Description != "",
}
```

### 3. Transactions

```go
tx, err := s.db.Begin(ctx)
if err != nil {
    return nil, err
}
defer tx.Rollback(ctx)

// Use transaction
form, err := s.queries.WithTx(tx).CreateForm(ctx, params)

// Commit
if err := tx.Commit(ctx); err != nil {
    return nil, err
}
```

## Related Decisions

- [ADR 001: gRPC over REST](./001-grpc-over-rest.md)
- [ADR 004: Protobuf Types](./004-protobuf-types.md)

## References

- [SQLC Documentation](https://docs.sqlc.dev/)
- [SQLC Best Practices](https://docs.sqlc.dev/en/latest/overview/how.html)
