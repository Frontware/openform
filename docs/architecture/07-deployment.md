# Deployment Architecture

**Deployment Models:** Single binary, Docker, cloud-native
**Target Environments:** Development, staging, production

## Overview

Weladee Form supports multiple deployment strategies from simple single-binary deployments to containerized cloud-native architectures.

## Deployment Options

### 1. Single Binary Deployment (Embedded)

**Best For:**
- Quick starts
- On-premise deployment
- Resource-constrained environments

**Architecture:**
```
┌────────────────────────────────────────────────┐
│           weladee-form binary                  │
│  ┌───────────────────────────────────────────┐ │
│  │  Go Server (gRPC + HTTP)                  │ │
│  │  - gRPC handlers                          │ │
│  │  - Auth middleware                        │ │
│  │  - Business logic                         │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │  Embedded Next.js Build                   │ │
│  │  - Static HTML/JS/CSS                     │ │
│  │  - Server components                      │ │
│  └───────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    PostgreSQL           S3/R2
```

**Build Command:**
```bash
make build-local
```

**Output:** `bin/weladee-form` (~27MB)

**Run:**
```bash
export DATABASE_URL="postgresql://user:pass@host/db"
export S3_BUCKET="my-bucket"
export S3_ACCESS_KEY="key"
export S3_SECRET_KEY="secret"

./bin/weladee-form serve
```

**Access:**
- Frontend: `http://localhost:50051/`
- gRPC: `http://localhost:50051/` (same port)

### 2. Docker Deployment

**Best For:**
- Container orchestration (Kubernetes)
- Reproducible deployments
- Multi-environment setups

**Dockerfile:**
```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN apk add --no-cache make nodejs npm
RUN make build-local

# Runtime stage
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /app/bin/weladee-form /usr/local/bin/

EXPOSE 50051
ENV DATABASE_URL=""
ENV GRPC_PORT="50051"

CMD ["weladee-form", "serve"]
```

**Build:**
```bash
docker build -t weladee-form:latest .
```

**Run:**
```bash
docker run -d \
  -p 50051:50051 \
  -e DATABASE_URL="postgresql://..." \
  -e S3_BUCKET="my-bucket" \
  -e S3_ACCESS_KEY="..." \
  -e S3_SECRET_KEY="..." \
  weladee-form:latest
```

### 3. Development Deployment

**Best For:**
- Local development
- Hot reload
- Separate frontend/backend

**Architecture:**
```
┌──────────────────┐         ┌──────────────────┐
│  npm run dev     │         │  go run server   │
│  Next.js dev     │◄───────►│  gRPC server     │
│  :3000           │ gRPC-Web│  :50051          │
└──────────────────┘         └──────────────────┘
         │                            │
         └────────────┬───────────────┘
                      ▼
                PostgreSQL + S3
```

**Run:**
```bash
# Terminal 1: Backend
make dev

# Terminal 2: Frontend
npm run dev
```

**Access:**
- Frontend: `http://localhost:3000/`
- gRPC: `http://localhost:50051/`

## Infrastructure Requirements

### Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 512MB | 2GB+ |
| Storage | 1GB | 10GB+ |
| Database | PostgreSQL 14+ | PostgreSQL 15+ |
| Object Storage | S3-compatible | S3 or R2 |

### Database Setup

**PostgreSQL:**
```bash
# Create database
createdb weladee_form

# Run schema
psql -d weladee_form -f sql/schema/form_schema.sql

# Create user
psql -d weladee_form -c "CREATE USER weladee_form WITH PASSWORD 'secure_password';"
psql -d weladee_form -c "GRANT ALL PRIVILEGES ON SCHEMA form TO weladee_form;"
```

**Environment Variables:**
```bash
export DATABASE_URL="postgresql://weladee_form:secure_password@localhost:5432/weladee_form"
```

### Storage Setup

**AWS S3:**
```bash
# Create bucket
aws s3 mb s3://weladee-form-uploads

# Set up CORS (if needed)
aws s3api put-bucket-cors --bucket weladee-form-uploads \
  --cors-configuration file://cors.json
```

**Cloudflare R2:**
```bash
# Create bucket via dashboard
# Get credentials from R2 dashboard
```

**Environment Variables:**
```bash
export S3_BUCKET="weladee-form-uploads"
export S3_REGION="auto"
export S3_ENDPOINT="https://<endpoint>.r2.cloudflarestorage.com"
export S3_ACCESS_KEY="access-key"
export S3_SECRET_KEY="secret-key"
```

## Configuration Management

### Configuration Priority

1. **CLI flags** (highest priority)
2. **Environment variables**
3. **config.yaml** (lowest priority)

### Configuration File

**config.yaml:**
```yaml
grpc_port: "50051"
database_url: "postgresql://user:pass@localhost/db"

# S3 configuration
s3_region: "auto"
s3_bucket: "your-bucket"
s3_access_key: "your-key"
s3_secret_key: "your-secret"
s3_endpoint: "https://your-endpoint.com"

# reCAPTCHA v3 (optional)
recaptcha:
  enabled: true
  site_key: "6Lxxxxxxxxxxxxxxxx"
  secret_key: "6Lxxxxxxxxxxxxxxxx"
  threshold: 0.5
```

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string

**Optional (S3):**
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_ENDPOINT`

**Optional (reCAPTCHA):**
- `RECAPTCHA_ENABLED` - `true`/`false`
- `RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`
- `RECAPTCHA_THRESHOLD`

**Optional (Server):**
- `GRPC_PORT` - Default: `50051`

## Production Deployment

### Systemd Service

**/etc/systemd/system/weladee-form.service:**
```ini
[Unit]
Description=Weladee Form Server
After=network.target postgresql.service

[Service]
Type=simple
User=weladee
Group=weladee
WorkingDirectory=/opt/weladee-form
Environment="DATABASE_URL=postgresql://user:pass@localhost/db"
Environment="S3_BUCKET=weladee-uploads"
Environment="S3_ACCESS_KEY=key"
Environment="S3_SECRET_KEY=secret"
ExecStart=/opt/weladee-form/bin/weladee-form serve
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable weladee-form
sudo systemctl start weladee-form
sudo systemctl status weladee-form
```

### Nginx Reverse Proxy

**/etc/nginx/sites-available/weladee-form:**
```nginx
upstream weladee_form {
    server localhost:50051;
}

server {
    listen 80;
    server_name forms.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name forms.example.com;

    ssl_certificate /etc/ssl/certs/weladee-form.crt;
    ssl_certificate_key /etc/ssl/private/weladee-form.key;

    client_max_body_size 10M;

    location / {
        proxy_pass http://weladee_form;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable:**
```bash
sudo ln -s /etc/nginx/sites-available/weladee-form /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Kubernetes Deployment

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: weladee-form
  labels:
    app: weladee-form
spec:
  replicas: 3
  selector:
    matchLabels:
      app: weladee-form
  template:
    metadata:
      labels:
        app: weladee-form
    spec:
      containers:
      - name: weladee-form
        image: weladee-form:latest
        ports:
        - containerPort: 50051
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: weladee-form-secrets
              key: database-url
        - name: S3_BUCKET
          value: "weladee-uploads"
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: weladee-form-secrets
              key: s3-access-key
        - name: S3_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: weladee-form-secrets
              key: s3-secret-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 50051
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 50051
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: weladee-form-service
spec:
  selector:
    app: weladee-form
  ports:
  - protocol: TCP
    port: 80
    targetPort: 50051
  type: LoadBalancer
```

**Deploy:**
```bash
kubectl apply -f deployment.yaml
```

## Monitoring & Logging

### Health Checks

**Future Implementation:**
```go
// Health endpoint
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

### Logging

**Structured Logging (Future):**
```go
log.Info("Request received",
    "method", info.FullMethod,
    "user_id", claims.UserID,
    "duration_ms", duration.Milliseconds(),
)
```

### Metrics (Future)

**Prometheus Endpoint:**
- Request rate
- Error rate
- Response time (p50, p95, p99)
- Database connection pool
- Active goroutines

## Backup & Recovery

### Database Backup

**Daily Backup:**
```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d)
pg_dump -Fc weladee_form > $BACKUP_DIR/weladee_form_$DATE.dump

# Keep last 7 days
find $BACKUP_DIR -name "weladee_form_*.dump" -mtime +7 -delete
```

**Restore:**
```bash
pg_restore -d weladee_form /backups/postgres/weladee_form_20250108.dump
```

### File Backup

S3/R2 provides built-in durability. For additional backup:

**Versioning:**
```bash
aws s3api put-bucket-versioning \
  --bucket weladee-uploads \
  --versioning-configuration Status=Enabled
```

**Cross-Region Replication:**
```bash
aws s3api put-bucket-replication \
  --bucket weladee-uploads \
  --replication-configuration file://replication.json
```

## Scaling Strategies

### Horizontal Scaling

**Load Balancer:**
```
        ┌─────────────────┐
        │   Load Balancer │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌───────┐   ┌───────┐   ┌───────┐
│ Pod 1 │   │ Pod 2 │   │ Pod 3 │
└───────┘   └───────┘   └───────┘
    │            │            │
    └────────────┼────────────┘
                 ▼
         PostgreSQL (Primary)
```

**Stateless Design:**
- No session state in application
- All state in database
- Easy to add/remove instances

### Database Scaling

**Read Replicas (Future):**
- Primary for writes
- Replicas for read-heavy queries
- Connection routing by operation type

**Connection Pooling:**
```go
config.MaxConns = 25  // Per instance
// With 3 instances = 75 max connections
```

### CDN for Public Forms

**Future Implementation:**
- Cache form definitions at edge
- Serve static assets via CDN
- Reduce origin load

## Security Hardening

### TLS/SSL

**Always use HTTPS in production:**
- Let's Encrypt for free certificates
- nginx reverse proxy for SSL termination
- HSTS header for enforced HTTPS

### Firewall Rules

```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Secrets Management

**Never commit secrets:**
- Use `.env` files (gitignored)
- Use Kubernetes secrets
- Use AWS Secrets Manager / HashiCorp Vault

### Security Headers

**nginx Configuration:**
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

**Next:** [API Documentation](./api/grpc-services.md)
