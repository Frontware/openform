# ADR 001: gRPC over REST

**Status:** Accepted
**Date:** 2024-01-01
**Context:** Initial architecture decision
**Authors:** Architecture team

## Context

We needed to choose a communication protocol between the Next.js frontend and Go backend for the Weladee Form application. The primary options were:

1. REST with JSON
2. GraphQL
3. gRPC with Protobuf
4. gRPC-Web with Protobuf

### Requirements

- Type safety across the stack
- High performance for form submissions
- Good developer experience
- Browser compatibility
- Support for streaming (file uploads)

## Decision

We chose **gRPC with Connect RPC (gRPC-Web compatible)**.

### What is Connect RPC?

Connect is a family of libraries for building browser and gRPC-compatible APIs. It provides:

- gRPC-Web protocol support for browsers
- First-class TypeScript support
- Streaming support
- Compatibility with standard gRPC services

### Architecture

```
┌─────────────────┐     gRPC-Web     ┌─────────────────┐
│  Next.js SPA    │ ◄──────────────► │  Go gRPC Server │
│  (TypeScript)   │   Connect RPC    │   (Protobuf)    │
└─────────────────┘                  └─────────────────┘
```

## Rationale

### Advantages

1. **Type Safety**
   - Single source of truth in `.proto` files
   - Generate TypeScript types from Protobuf definitions
   - Generate Go types from same definitions
   - Compile-time type checking on both sides

2. **Performance**
   - Binary serialization (Protobuf) is faster than JSON
   - Smaller payload size over the wire
   - Built-in streaming support for large file uploads

3. **Developer Experience**
   - Clean API definitions in `.proto` files
   - Auto-generated client libraries
   - No manual type maintenance
   - Clear API contracts

4. **Code Generation**
   - `protoc` generates server and client code
   - SQLC generates database code from SQL
   - End-to-end type safety with minimal manual code

5. **Browser Compatibility**
   - Connect RPC works in browsers via gRPC-Web
   - No need for separate REST API

### Disadvantages

1. **Learning Curve**
   - Team must learn Protobuf syntax
   - Additional build step for code generation
   - Debugging binary protocol is harder than JSON

2. **Tooling Maturity**
   - Fewer tools than REST/JSON
   - Less community knowledge
   - Harder to test manually (curl, Postman)

## Alternatives Considered

### REST with JSON

**Advantages:**
- Ubiquitous, well-understood
- Easy to test manually
- Huge ecosystem of tools
- No code generation needed

**Disadvantages:**
- No type safety across languages
- JSON serialization overhead
- Manual API documentation needed
- Swagger/OpenAPI maintenance burden

**Why not chosen:**
- Type safety was a key requirement
- JSON parsing is slower than Protobuf
- API documentation would drift from implementation

### GraphQL

**Advantages:**
- Flexible queries
- Strong typing
- Single endpoint
- Good ecosystem

**Disadvantages:**
- No browser streaming support
- Complexity for simple CRUD operations
- N+1 query problems
- Additional abstraction layer

**Why not chosen:**
- Overkill for our use case (mostly CRUD)
- No streaming for file uploads
- Adds complexity without clear benefits

## Implementation

### Protocol Definitions

**File:** `proto/form.proto`
```protobuf
syntax = "proto3";

package weladee.form.v1;

service FormService {
  rpc CreateForm(CreateFormRequest) returns (CreateFormResponse);
  rpc GetForm(GetFormRequest) returns (GetFormResponse);
  // ...
}

message Form {
  string id = 1;
  string title = 2;
  FormTheme theme = 3;
  // ...
}
```

### Code Generation

**Go:**
```bash
protoc --go_out=. --go-grpc_out=. proto/*.proto
```

**TypeScript:**
```bash
buf generate proto
```

### Client Usage

**TypeScript:**
```typescript
import { createPromiseClient } from "@bufbuild/connect"
import { createGrpcWebTransport } from "@bufbuild/connect-web"
import { FormService } from "@/proto/proto/form_connect"

const transport = createGrpcWebTransport({
  baseUrl: process.env.NEXT_PUBLIC_GRPC_URL || ""
})

const client = createPromiseClient(FormService, transport)

// Type-safe request
const response = await client.createForm({
  title: "My Form",
  theme: FormTheme.FORM_THEME_MINIMAL
})
```

### Server Implementation

**Go:**
```go
func (s *FormService) CreateForm(ctx context.Context, req *pb.CreateFormRequest) (*pb.CreateFormResponse, error) {
    // Type-safe access to request fields
    form, err := s.queries.CreateForm(ctx, db.CreateFormParams{
        Title: req.Title,
        Theme: req.Theme.String(),
    })
    return &pb.CreateFormResponse{Form: form}, nil
}
```

## Consequences

### Positive

- **Type Safety:** Compile-time checking catches errors before runtime
- **Performance:** Binary protocol reduces latency and bandwidth
- **Documentation:** `.proto` files serve as living documentation
- **Refactoring:** Changes propagate across the stack automatically
- **Streaming:** Native support for file uploads

### Negative

- **Build Complexity:** Additional code generation step
- **Debugging:** Binary protocol harder to inspect
- **Learning:** Team needs to learn Protobuf and Connect RPC

### Trade-offs

- Accepting additional build complexity for type safety
- Trading debugging ease for performance
- Investing in learning curve for long-term maintainability

## Related Decisions

- [ADR 002: SQLC over ORM](./002-sqlc-over-orm.md)
- [ADR 004: Protobuf Types](./004-protobuf-types.md)
- [ADR 005: Connect Protocol](./005-connect-protocol.md)

## References

- [Connect RPC Documentation](https://connectrpc.com/)
- [Protocol Buffers](https://protobuf.dev/)
- [gRPC Web](https://grpc.io/docs/languages/web/)
