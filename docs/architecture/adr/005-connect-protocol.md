# ADR 005: Connect RPC Protocol for Browser Communication

**Status:** Accepted
**Date:** 2024-01-01
**Context:** Choosing gRPC-Web implementation
**Authors:** Architecture team

## Context

We needed to enable gRPC communication between browsers and our Go server. Standard gRPC uses HTTP/2 which isn't fully supported in browsers. The options were:

1. Official gRPC-Web
2. Connect RPC (Buf)
3. Twirp
4. REST proxy (grpc-gateway)

### Requirements

- Browser compatibility
- Streaming support (for file uploads)
- Good TypeScript support
- Compatibility with standard gRPC services
- Developer experience

## Decision

We chose **Connect RPC** by Buf.

### What is Connect RPC?

Connect is a family of libraries for building browser and gRPC-compatible APIs. It provides:

- gRPC-Web protocol for browsers
- Connect protocol (improvement over gRPC-Web)
- First-class TypeScript support
- Streaming support (unary and server streaming)
- Works with standard gRPC services

## Rationale

### Advantages

1. **TypeScript Support**
   - Auto-generated TypeScript clients
   - Type-safe requests and responses
   - Excellent IDE integration

2. **Streaming**
   - Server streaming for large responses
   - Client streaming for file uploads
   - Bidirectional streaming (future)

3. **Protocol Options**
   - gRPC-Web: Compatible with existing gRPC-Web proxies
   - Connect: Better performance, simpler protocol
   - GRPC: Standard gRPC over HTTP/2 (server-to-server)

4. **Browser Compatibility**
   - Works in all modern browsers
   - No special server configuration needed
   - CORS handled properly

5. **Developer Experience**
   - Clean API design
   - Good error handling
   - Interceptor pattern for middleware

### Comparison with gRPC-Web

| Feature | Connect RPC | gRPC-Web |
|---------|-------------|----------|
| TypeScript Support | ✅ Excellent | ⚠️ Requires extra tools |
| Streaming | ✅ Built-in | ❌ Limited |
| Protocol | gRPC-Web + Connect | gRPC-Web only |
| Generated Code | ✅ Clean | ⚠️ Verbose |
| Interceptors | ✅ Easy | ⚠️ Complex |
| Error Handling | ✅ Connect errors | ⚠️ Google errors |

## Implementation

### Protocol Buffers Definition

**File:** `proto/form.proto`
```protobuf
syntax = "proto3";

package weladee.form.v1;

option go_package = "github.com/weladee/weladee-form/proto/pb";

service FormService {
  rpc CreateForm(CreateFormRequest) returns (CreateFormResponse);
}

message CreateFormRequest {
  string title = 1;
  FormTheme theme = 2;
}

message CreateFormResponse {
  Form form = 1;
}
```

### Code Generation

**Install Buf CLI:**
```bash
go install github.com/bufbuild/buf/cmd/buf@latest
```

**buf.gen.yaml:**
```yaml
version: v1
plugins:
  - plugin: buf.build/connectrpc/go
    out: proto/pb
    opt: paths=source_relative
  - plugin: buf.build/connectrpc/es
    out: lib/proto/proto
    opt: target=ts
```

**Generate:**
```bash
buf generate proto
```

### Go Server Setup

**File:** `internal/gapi/server.go`
```go
import (
    "connectrpc.com/connect"
    "github.com/bufbuild/connect-grpchealth-go"
    grpchealth "google.golang.org/grpc/health/grpc_health_v1"
)

func NewServer(mux *http.ServeMux, queries *db.Queries) {
    // Create gRPC service implementations
    formService := &FormService{queries: queries}

    // Create Connect handlers
    formPath, formHandler := formv1connect.NewFormServiceHandler(formService)

    // Mount to HTTP mux
    mux.Handle(formPath, formHandler)

    // Health check
    mux.Handle(grpchealth.NewHandler(
        &grpchealth.HealthChecker{},
    ))
}
```

### TypeScript Client Setup

**File:** `lib/grpc-client.ts`
```typescript
import { createPromiseClient } from "@bufbuild/connect"
import { createGrpcWebTransport } from "@bufbuild/connect-web"
import { FormService } from "@/proto/proto/form_connect"

// Create transport
const transport = createGrpcWebTransport({
  baseUrl: process.env.NEXT_PUBLIC_GRPC_URL || "",
  interceptors: [
    // Auth interceptor
    authInterceptor,
    // Error interceptor
    errorInterceptor
  ]
})

// Create client
export const formClient = createPromiseClient(FormService, transport)
```

### Auth Interceptor

```typescript
const authInterceptor: Interceptor = (next) => async (req) => {
  // Public methods whitelist
  const publicMethods = [
    '/weladee.form.v1.FormService/GetFormBySlug',
    '/weladee.form.v1.ResponseService/SubmitResponse',
  ]

  const isPublic = publicMethods.includes(req.url)

  if (!isPublic) {
    const token = getToken()
    if (token) {
      req.header.set("Authorization", `Bearer ${token}`)
    }
  }

  return next(req)
}
```

### Error Handling Interceptor

```typescript
const errorInterceptor: Interceptor = (next) => async (req) => {
  try {
    return await next(req)
  } catch (err) {
    if (err instanceof ConnectError) {
      // Handle authentication errors
      if (err.code === Code.Unauthenticated) {
        clearToken()
        redirect('/?auth=expired')
      }

      // Handle permission errors
      if (err.code === Code.PermissionDenied) {
        showError(err.message)
      }
    }
    throw err
  }
}
```

## Streaming Example

### File Upload (Client Streaming)

**Proto Definition:**
```protobuf
service FileService {
  rpc UploadFile(stream UploadFileRequest) returns (UploadFileResponse);
}

message UploadFileRequest {
  oneof data {
    UploadFileMetadata metadata = 1;
    bytes file_data = 2;
  }
}

message UploadFileMetadata {
  string form_id = 1;
  string question_id = 2;
  string filename = 3;
  string mime_type = 4;
  int64 file_size = 5;
}

message UploadFileResponse {
  string file_url = 1;
  string filename = 2;
}
```

**Client Implementation:**
```typescript
async function uploadFile(
  formId: string,
  questionId: string,
  file: File
): Promise<string> {
  const chunkSize = 1024 * 1024 // 1MB chunks

  // Create async generator for chunks
  async function* chunkFile(file: File) {
    // Send metadata first
    yield {
      metadata: {
        formId,
        questionId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size
      }
    }

    // Stream chunks
    let offset = 0
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize)
      const bytes = await chunk.arrayBuffer()
      yield { fileData: new Uint8Array(bytes) }
      offset += chunkSize
    }
  }

  // Upload via client streaming
  const response = await fileClient.uploadFile(chunkFile(file))
  return response.fileUrl
}
```

**Server Implementation:**
```go
func (s *FileService) UploadFile(ctx context.Context, stream *connect.BidiStream[pb.UploadFileRequest, pb.UploadFileResponse]) error {
    var metadata *pb.UploadFileMetadata
    var buffer []byte

    for {
        req, err := stream.Receive()
        if err == io.EOF {
            break
        }
        if err != nil {
            return err
        }

        switch d := req.Data.(type) {
        case *pb.UploadFileRequest_Metadata:
            metadata = d.Metadata
        case *pb.UploadFileRequest_FileData:
            buffer = append(buffer, d.FileData...)
        }
    }

    // Upload to S3
    url, err := s.storage.Upload(ctx, metadata, buffer)
    if err != nil {
        return err
    }

    return stream.Send(&pb.UploadFileResponse{
        FileUrl:  url,
        Filename: metadata.Filename,
    })
}
```

## Consequences

### Positive

- **TypeScript Support:** Excellent generated clients
- **Streaming:** Native support for file uploads
- **Browser Compatible:** Works in all modern browsers
- **Developer Experience:** Clean API, good error handling
- **Performance:** Efficient binary protocol
- **Interceptors:** Easy middleware pattern

### Negative

- **Additional Dependency:** Adds Buf tooling
- **Learning Curve:** Team must learn Connect RPC
- **Generated Code:** More files in repository

### Trade-offs

- Accepting additional tooling for better TypeScript support
- Using Connect protocol over gRPC-Web for better features
- Committing generated code to repository

## Alternatives Considered

### Official gRPC-Web

**Why not chosen:**
- Poor TypeScript support
- Limited streaming capabilities
- More complex setup
- Less active development

### Twirp

**Why not chosen:**
- Uses JSON (slower than Protobuf)
- Less standard than gRPC
- Smaller community

### grpc-gateway (REST proxy)

**Why not chosen:**
- Loses gRPC benefits in browser
- REST vs gRPC impedance mismatch
- Additional translation layer

## Best Practices

### 1. Error Handling

```typescript
try {
  const response = await formClient.createForm(req)
} catch (err) {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.Unauthenticated:
        // Handle auth error
        break
      case Code.PermissionDenied:
        // Handle permission error
        break
      case Code.InvalidArgument:
        // Handle validation error
        break
    }
  }
}
```

### 2. Interceptor Composition

```typescript
const transport = createGrpcWebTransport({
  baseUrl,
  interceptors: [
    authInterceptor,      // Add auth headers
    errorInterceptor,     // Handle errors
    loggingInterceptor,   // Log requests
    retryInterceptor,     // Retry failed requests
  ]
})
```

### 3. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

## Related Decisions

- [ADR 001: gRPC over REST](./001-grpc-over-rest.md)
- [ADR 004: Protobuf Types](./004-protobuf-types.md)

## References

- [Connect RPC Documentation](https://connectrpc.com/)
- [Connect RPC TypeScript](https://connectrpc.com/docs/ts/getting-started)
- [Buf CLI](https://buf.build/docs/cli)
