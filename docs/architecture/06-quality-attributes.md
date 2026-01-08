# Quality Attributes

**Non-Functional Requirements:** Performance, scalability, maintainability, and observability

## Overview

This document describes the quality attributes that guide architectural decisions and implementation trade-offs in Weladee Form.

## Performance

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time | < 200ms (p95) | gRPC interceptor timing |
| Form Rendering | < 100ms | Next.js SSR timing |
| Database Query | < 50ms (p95) | SQLC query logging |
| File Upload | > 10MB/s | Streaming throughput |
| Page Load (LCP) | < 2.5s | Core Web Vitals |

### Performance Strategies

#### 1. gRPC Binary Protocol

**Why:** More efficient than JSON/REST

- Binary serialization (Protobuf)
- Smaller payload size
- Faster serialization/deserialization
- Built-in streaming support

```protobuf
// Protobuf definition
message Form {
    string id = 1;
    string title = 2;
    FormTheme theme = 3;
    // ...
}
```

#### 2. Database Query Optimization

**Indexes on:**
- Foreign keys (JOIN performance)
- `form_id` + `order_index` (question ordering)
- `submitted_at DESC` (chronological queries)
- `form_id` + `stat_date` (time-series analytics)

**SQLC Prepared Statements:**
```go
// Generated code uses prepared statements
stmt := `
    SELECT id, title, theme, created_at
    FROM form.forms
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
`
```

#### 3. Next.js Performance Features

- **Server Components:** Reduce client JavaScript
- **Streaming:** Progressive page rendering
- **Image Optimization:** Next.js Image component
- **Route Prefetching:** Instant navigation

#### 4. Caching Strategy

**Implemented:**
- Next.js static asset caching
- Browser caching for public forms

**Future:**
- Redis cache for form definitions
- CDN caching for public forms
- Database query result caching

### Performance Monitoring

```go
// Timing middleware (future)
func TimingInterceptor() grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
        start := time.Now()
        resp, err := handler(ctx, req)
        duration := time.Since(start)

        metrics.RecordRPCDuration(info.FullMethod, duration)
        return resp, err
    }
}
```

## Scalability

### Target Metrics

| Metric | Target | Strategy |
|--------|--------|----------|
| Concurrent Users | 10,000 | Stateless services |
| Forms per User | Unlimited (Enterprise) | Efficient pagination |
| Responses per Form | 100,000+ | Partitioning strategy |
| Storage | TB-scale | S3/R2 for files |

### Scalability Strategies

#### 1. Stateless Services

**Go gRPC Server:**
- No in-memory session state
- All state in database
- Horizontal scaling via load balancer

```go
// No global state
type FormService struct {
    queries *db.Queries  // Database connection pool only
}
```

#### 2. Database Scalability

**Connection Pooling:**
```go
// pgx/v5 connection pool
config, _ := pgxpool.ParseConfig(databaseURL)
config.MaxConns = 25
config.MinConns = 5
```

**Partitioning Strategy (Future):**
- Partition responses by `form_id`
- Partition analytics by `stat_date`
- Archive old responses to cold storage

#### 3. Storage Scalability

**S3/R2 Object Storage:**
- Unlimited storage capacity
- Multipart upload for large files
- Presigned URLs for direct access

```go
// Streaming upload
func (s *FileService) UploadFile(stream FileService_UploadFileServer) error {
    // Stream directly to S3
    uploader := manager.NewUploader(s3Client)
    _, err := uploader.Upload(context.Background(), input)
}
```

#### 4. Frontend Scalability

- **Client-Side Rendering:** Offload work to browser
- **Pagination:** Limit data transfer
- **Lazy Loading:** Load components on demand
- **Virtual Scrolling:** For long lists (future)

### Scalability Limits

| Component | Bottleneck | Mitigation |
|-----------|------------|------------|
| Go Server | CPU (gRPC processing) | Scale horizontally |
| PostgreSQL | IOPS / Connections | Connection pool, read replicas |
| S3/R2 | Network bandwidth | Multi-part upload, CDN |

## Maintainability

### Target Metrics

| Metric | Target | Approach |
|--------|--------|----------|
| Code Coverage | > 80% | Unit + integration tests |
| Cyclomatic Complexity | < 10 | Code review, linters |
| Technical Debt Ratio | < 5% | Regular refactoring |
| Documentation Coverage | 100% | ADRs, code comments |

### Maintainability Strategies

#### 1. Type Safety

**End-to-End Type Safety:**
- Protobuf for API contracts
- SQLC for database queries
- TypeScript for frontend

```go
// SQLC generates types
type FormForm struct {
    ID        uuid.UUID
    Title     string
    Theme     string
    CreatedAt time.Time
}
```

```typescript
// TypeScript types from Protobuf
interface Form {
    id: string
    title: string
    theme: FormTheme
}
```

#### 2. Code Generation

**Benefits:**
- Less boilerplate code
- Consistent patterns
- Auto-sync with schema changes

**Tools:**
- `protoc` - gRPC code generation
- `sqlc generate` - Database query code
- `buf` - Protobuf package management

#### 3. Clean Architecture

**Layer Separation:**
```
proto/          - API contracts
internal/gapi/  - gRPC handlers
internal/db/    - Database layer
internal/auth/  - Authentication
internal/utils/ - Utilities
```

#### 4. Testing Strategy

**Unit Tests:**
- Business logic in services
- Utility functions
- Validation logic

**Integration Tests:**
- gRPC endpoint testing
- Database query testing
- Authentication flow

**E2E Tests:**
- Form creation flow
- Response submission
- Export functionality

#### 5. Documentation

**Architecture Decision Records (ADRs):**
- Document significant decisions
- Track trade-offs
- Historical context

**Code Comments:**
- Package-level documentation
- Complex algorithm explanations
- API usage examples

## Reliability

### Target Metrics

| Metric | Target | Strategy |
|--------|--------|----------|
| Availability | 99.9% uptime | Health checks, auto-restart |
| Error Rate | < 0.1% | Input validation, retry logic |
| Data Durability | 99.999% | Database backups, S3 durability |

### Reliability Strategies

#### 1. Error Handling

**gRPC Error Codes:**
```go
if formNotFound {
    return nil, status.Error(codes.NotFound, "form not found")
}

if invalidInput {
    return nil, status.Error(codes.InvalidArgument, "invalid title")
}

if notAuthorized {
    return nil, status.Error(codes.PermissionDenied, "insufficient permissions")
}
```

**Frontend Error Handling:**
```typescript
try {
    await formClient.createForm(req)
} catch (err) {
    if (err instanceof ConnectError) {
        switch (err.code) {
            case Code.Unauthenticated:
                redirectToLogin()
                break
            case Code.PermissionDenied:
                showError("You don't have permission")
                break
        }
    }
}
```

#### 2. Transaction Management

```go
// Atomic multi-table operations
tx, err := s.db.Begin(ctx)
if err != nil {
    return nil, err
}

defer tx.Rollback(ctx)

// Multiple operations
form, err := s.queries.WithTx(tx).CreateForm(ctx, params)
for _, q := range questions {
    s.queries.WithTx(tx).CreateQuestion(ctx, q)
}

return tx.Commit(ctx)
```

#### 3. Idempotent Operations

**Database Schema:**
```sql
-- Use IF NOT EXISTS for idempotency
CREATE TABLE IF NOT EXISTS form.forms (...)

-- Unique constraints prevent duplicates
UNIQUE(form_id, stat_date)
```

#### 4. Graceful Degradation

**Future:**
- Feature flags for new functionality
- Fallback to simpler features
- Offline mode for form builder

## Observability

### Target Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Request Tracing | 100% | OpenTelemetry |
| Error Logging | 100% | Structured logging |
| Metrics | All endpoints | Prometheus |
| Alerting | P0/P1 issues | PagerDuty |

### Observability Strategies

#### 1. Structured Logging

```go
// Use structured logging
log.Info("Form created",
    "form_id", form.ID,
    "user_id", claims.UserID,
    "customer_type", claims.CustomerType,
)
```

#### 2. Distributed Tracing

**Future:**
```go
import "go.opentelemetry.io/otel"

func (s *FormService) CreateForm(ctx context.Context, req *pb.CreateFormRequest) (*pb.CreateFormResponse, error) {
    ctx, span := otel.Tracer("form").Start(ctx, "CreateForm")
    defer span.End()
    // ...
}
```

#### 3. Metrics Collection

**Future:**
```go
// Prometheus metrics
var formsCreated = promauto.NewCounter(prometheus.CounterOpts{
    Name: "weladee_forms_created_total",
    Help: "Total number of forms created",
})

formsCreated.Inc()
```

#### 4. Health Checks

```go
// Health endpoint (future)
func (s *Server) Health(ctx context.Context, req *emptypb.Empty) (*emptypb.Empty, error) {
    // Check database
    if err := s.db.Ping(ctx); err != nil {
        return nil, status.Error(codes.Unavailable, "database unavailable")
    }

    // Check S3
    if err := s.storage.HealthCheck(); err != nil {
        return nil, status.Error(codes.Unavailable, "storage unavailable")
    }

    return &emptypb.Empty{}, nil
}
```

## Usability

### Target Metrics

| Metric | Target | Approach |
|--------|--------|----------|
| Time to Create Form | < 2 minutes | Intuitive builder |
| Form Completion Time | < 60 seconds | One-question-at-a-time |
| Mobile Usability | 100% features | Responsive design |
| Accessibility | WCAG 2.1 AA | ARIA labels, keyboard nav |

### Usability Strategies

#### 1. Form Builder UX

- Drag-and-drop question ordering
- Live preview
- Auto-save debouncing
- Question templates
- Keyboard shortcuts

#### 2. Form Player UX

- One-question-at-a-time (reduces cognitive load)
- Progress indication (4 styles)
- Keyboard navigation (Enter, arrows, scroll)
- Mobile-responsive
- Partial save support

#### 3. Dashboard UX

- Visual stats overview
- Quick actions
- Search and filtering
- Bulk operations
- Export functionality

#### 4. Accessibility

**Implemented:**
- Semantic HTML
- Keyboard navigation support
- Focus management

**Future:**
- ARIA labels and roles
- Screen reader testing
- High contrast mode
- Reduced motion support

## Testability

### Target Metrics

| Metric | Target | Approach |
|--------|--------|----------|
| Unit Test Coverage | > 80% | TDD for new features |
| Integration Tests | Critical paths | API testing |
| E2E Tests | User journeys | Playwright |

### Testability Strategies

#### 1. Dependency Injection

```go
type FormService struct {
    queries  *db.Queries
    storage  Storage
}

// Easy to mock in tests
mockQueries := &MockQueries{}
service := NewFormService(mockQueries, mockStorage)
```

#### 2. Environment Isolation

```bash
# Test database
TEST_DATABASE_URL="postgresql://test:test@localhost/test_db"

# Run tests
go test ./...
```

#### 3. Test Utilities

```go
// Test fixtures
func createTestForm(t *testing.T, db *db.Queries) FormForm {
    return db.CreateForm(ctx, CreateFormParams{
        Title: "Test Form",
        Theme: "minimal",
    })
}
```

## Portability

### Target Metrics

| Metric | Target | Approach |
|--------|--------|----------|
| Platform Support | Linux, macOS, Windows | Go cross-compilation |
| Database Support | PostgreSQL 14+ | Standard SQL |
| Deployment | Docker, binary | Single artifact |

### Portability Strategies

#### 1. Container Support

**Dockerfile:**
```dockerfile
FROM golang:1.21 AS builder
WORKDIR /app
COPY . .
RUN make build-local

FROM debian:bookworm-slim
COPY --from=builder /app/bin/weladee-form /usr/local/bin/
EXPOSE 50051
CMD ["weladee-form", "serve"]
```

#### 2. Cross-Compilation

```bash
# Makefile
build-linux:
    GOOS=linux GOARCH=amd64 go build -o bin/weladee-form-linux

build-mac:
    GOOS=darwin GOARCH=amd64 go build -o bin/weladee-form-mac

build-windows:
    GOOS=windows GOARCH=amd64 go build -o bin/weladee-form.exe
```

#### 3. Configuration Flexibility

**Priority:**
1. CLI flags (highest)
2. Environment variables
3. config.yaml file (lowest)

```bash
# Any configuration method works
./weladee-form --database-url="postgresql://..."
export DATABASE_URL="postgresql://..." && ./weladee-form
./weladee-form --config /path/to/config.yaml
```

---

**Next:** [Deployment Architecture](./07-deployment.md)
