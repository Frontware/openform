# Weladee Form Migration Plan - Detailed Instructions for AI Agent

## 📋 Project Analysis & Migration Overview

**Source Project:** https://github.com/Frontware/openform  
**New Name:** Weladee Form  
**Goal:** Migrate from Node.js/Supabase/REST to Go/PostgreSQL/gRPC while maintaining 100% feature parity

### Technology Stack Comparison

| Component | Current (OpenForm) | Target (Weladee Form) |
|-----------|-------------------|----------------------|
| Frontend Framework | Next.js 16 (App Router) | Next.js 16 (unchanged) |
| Backend Language | Node.js/TypeScript | Go 1.21+ |
| Database | Supabase PostgreSQL | PostgreSQL with pgx5 |
| Query Layer | Supabase SDK | SQLC with named parameters |
| Authentication | Supabase Auth | Weladee Redis token validation |
| API Protocol | REST | gRPC + gRPC-Web |
| File Storage | Cloudflare R2 | AWS S3 (or S3-compatible) |
| Database Schema | Public schema | `form` schema in Weladee DB |

---

## 🎯 Phase 1: Repository Setup & Analysis (Days 1-2)

### Step 1.1: Clone and Analyze Source Repository

```bash
# Clone the original repository
git clone https://github.com/Frontware/openform
cd openform

# Analyze project structure
tree -L 3 -I 'node_modules|.next'

# Document key files to study
cat package.json
cat supabase/schema.sql
ls -la app/api/
```

**Action Items:**
1. Document all API endpoints in `app/api/` directory
2. List all database tables, views, and functions from `supabase/schema.sql`
3. Identify all Supabase client calls across the codebase
4. Map all environment variables used
5. Document the 15 question types from `lib/questions.ts`
6. Note all authentication patterns used

### Step 1.2: Create New Go Project Structure

```bash
# Create new repository
mkdir weladee-form
cd weladee-form

# Initialize Go module
go mod init github.com/weladee/weladee-form

# Create project structure
mkdir -p cmd/server
mkdir -p internal/{gapi,db,auth,storage,models,validation,utils}
mkdir -p sql/{queries,schema,migrations}
mkdir -p proto
mkdir -p scripts
mkdir -p config
mkdir -p test/{integration,unit}
mkdir -p docs

# Copy frontend from original (will modify later)
cp -r ../openform/app ./
cp -r ../openform/components ./
cp -r ../openform/lib ./
cp -r ../openform/public ./
```

**Project Structure Explanation:**
```
weladee-form/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
├── internal/
│   ├── gapi/                       # gRPC API handlers
│   │   ├── server.go              # Server implementation
│   │   ├── rpc_form.go            # Form-related RPCs
│   │   ├── rpc_response.go        # Response-related RPCs
│   │   └── rpc_file.go            # File upload/download RPCs
│   ├── db/                        # Database layer
│   │   ├── database.go            # DB connection management
│   │   ├── sqlc/                  # Generated SQLC code
│   │   └── tx.go                  # Transaction helpers
│   ├── auth/                      # Authentication
│   │   ├── interceptor.go         # gRPC auth interceptor
│   │   ├── redis.go               # Redis token validation
│   │   └── middleware.go          # Additional auth helpers
│   ├── storage/                   # File storage
│   │   ├── s3.go                  # S3 client implementation
│   │   └── interface.go           # Storage interface
│   ├── models/                    # Business logic models
│   │   ├── form.go
│   │   ├── question.go
│   │   └── response.go
│   ├── validation/                # Input validation
│   │   └── validator.go
│   └── utils/                     # Utility functions
│       ├── csv.go                 # CSV export
│       └── helpers.go
├── sql/
│   ├── queries/                   # SQLC query files
│   │   ├── form.sql
│   │   ├── question.sql
│   │   ├── response.sql
│   │   └── user.sql
│   ├── schema/                    # Schema definitions
│   │   └── form_schema.sql
│   └── migrations/                # Migration scripts
│       └── 001_initial_schema.up.sql
├── proto/                         # Protocol Buffer definitions
│   ├── form.proto
│   ├── response.proto
│   └── file.proto
├── scripts/                       # Utility scripts
│   ├── generate.sh                # Generate SQLC + protobuf
│   └── migrate.sh                 # Run migrations
├── config/                        # Configuration files
│   ├── config.yaml
│   └── sqlc.yaml
├── test/                          # Tests
│   ├── integration/
│   └── unit/
├── go.mod
├── go.sum
└── README.md
```

---

## 🗄️ Phase 2: Database Schema Migration (Days 3-5)

### Step 2.1: Extract and Analyze Current Schema

**Task:** Study `supabase/schema.sql` and document:

1. **All Tables:**
   - Table name
   - Columns with data types
   - Primary keys
   - Foreign keys
   - Indexes
   - Check constraints
   - Default values

2. **All Views**

3. **All Functions/Triggers**

4. **Row Level Security Policies** (these will be replaced by application-level auth)

### Step 2.2: Create Form Schema SQL

**File:** `sql/schema/form_schema.sql`

```sql
-- Create form schema in Weladee database
CREATE SCHEMA IF NOT EXISTS form;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (minimal, references Weladee users)
CREATE TABLE form.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weladee_user_id INTEGER NOT NULL UNIQUE, -- Reference to Weladee's user table
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forms table
CREATE TABLE form.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES form.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    theme VARCHAR(50) NOT NULL DEFAULT 'default',
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_accepting_responses BOOLEAN NOT NULL DEFAULT true,
    require_login BOOLEAN NOT NULL DEFAULT false,
    allow_multiple_submissions BOOLEAN NOT NULL DEFAULT false,
    show_progress_bar BOOLEAN NOT NULL DEFAULT true,
    custom_thank_you_message TEXT,
    redirect_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forms_user_id ON form.forms(user_id);
CREATE INDEX idx_forms_published ON form.forms(is_published);
CREATE INDEX idx_forms_created_at ON form.forms(created_at DESC);

-- Questions table
CREATE TABLE form.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- short_text, long_text, single_choice, multiple_choice, dropdown, email, phone, number, date, time, url, file_upload, rating
    label TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL,
    options JSONB, -- For choice-based questions
    validation_rules JSONB, -- Min/max length, patterns, etc.
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_form_id ON form.questions(form_id);
CREATE INDEX idx_questions_order ON form.questions(form_id, order_index);

-- Responses table
CREATE TABLE form.responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    respondent_user_id UUID REFERENCES form.users(id) ON DELETE SET NULL, -- NULL for anonymous
    respondent_email VARCHAR(255),
    respondent_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    completed BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_responses_form_id ON form.responses(form_id);
CREATE INDEX idx_responses_user_id ON form.responses(respondent_user_id);
CREATE INDEX idx_responses_submitted_at ON form.responses(submitted_at DESC);

-- Answers table
CREATE TABLE form.answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL REFERENCES form.responses(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_number NUMERIC,
    answer_date DATE,
    answer_time TIME,
    answer_choices JSONB, -- For multiple choice
    answer_file_url TEXT, -- S3 URL for file uploads
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(response_id, question_id)
);

CREATE INDEX idx_answers_response_id ON form.answers(response_id);
CREATE INDEX idx_answers_question_id ON form.answers(question_id);

-- Form analytics (aggregated data)
CREATE TABLE form.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    total_views INTEGER NOT NULL DEFAULT 0,
    total_starts INTEGER NOT NULL DEFAULT 0,
    total_completions INTEGER NOT NULL DEFAULT 0,
    avg_completion_time INTEGER, -- in seconds
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(form_id, date)
);

CREATE INDEX idx_analytics_form_date ON form.analytics(form_id, date);

-- File uploads tracking
CREATE TABLE form.file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    response_id UUID REFERENCES form.responses(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    s3_url TEXT NOT NULL,
    uploaded_by_user_id UUID REFERENCES form.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_form_id ON form.file_uploads(form_id);
CREATE INDEX idx_file_uploads_response_id ON form.file_uploads(response_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION form.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON form.users
    FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON form.forms
    FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON form.questions
    FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON form.responses
    FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON form.answers
    FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();
```

### Step 2.3: Configure SQLC

**File:** `config/sqlc.yaml`

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "./sql/queries"
    schema: "./sql/schema"
    gen:
      go:
        package: "db"
        out: "./internal/db/sqlc"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_db_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
        emit_empty_slices: true
        emit_exported_queries: false
        emit_result_struct_pointers: false
        emit_params_struct_pointers: false
        emit_methods_with_db_argument: false
        emit_pointers_for_null_types: true
        emit_enum_valid_method: true
        emit_all_enum_values: true
        json_tags_case_style: "snake"
        overrides:
          - db_type: "uuid"
            go_type: "github.com/google/uuid.UUID"
          - db_type: "timestamptz"
            go_type: "time.Time"
          - db_type: "inet"
            go_type: "net.IP"
          - db_type: "jsonb"
            go_type: "encoding/json.RawMessage"
```

### Step 2.4: Create SQLC Query Files

**File:** `sql/queries/form.sql`

```sql
-- name: CreateForm :one
INSERT INTO form.forms (
    user_id, title, description, theme, is_published,
    is_accepting_responses, require_login, allow_multiple_submissions,
    show_progress_bar, custom_thank_you_message, redirect_url, settings
) VALUES (
    :user_id, :title, :description, :theme, :is_published,
    :is_accepting_responses, :require_login, :allow_multiple_submissions,
    :show_progress_bar, :custom_thank_you_message, :redirect_url, :settings
)
RETURNING *;

-- name: GetForm :one
SELECT * FROM form.forms
WHERE id = :id;

-- name: GetFormWithQuestions :many
SELECT 
    f.*,
    q.id as question_id,
    q.type as question_type,
    q.label as question_label,
    q.description as question_description,
    q.placeholder as question_placeholder,
    q.required as question_required,
    q.order_index as question_order,
    q.options as question_options,
    q.validation_rules as question_validation_rules,
    q.settings as question_settings
FROM form.forms f
LEFT JOIN form.questions q ON f.id = q.form_id
WHERE f.id = :id
ORDER BY q.order_index;

-- name: ListUserForms :many
SELECT * FROM form.forms
WHERE user_id = :user_id
ORDER BY created_at DESC
LIMIT :limit_count
OFFSET :offset_count;

-- name: UpdateForm :one
UPDATE form.forms
SET
    title = COALESCE(:title, title),
    description = COALESCE(:description, description),
    theme = COALESCE(:theme, theme),
    is_published = COALESCE(:is_published, is_published),
    is_accepting_responses = COALESCE(:is_accepting_responses, is_accepting_responses),
    require_login = COALESCE(:require_login, require_login),
    allow_multiple_submissions = COALESCE(:allow_multiple_submissions, allow_multiple_submissions),
    show_progress_bar = COALESCE(:show_progress_bar, show_progress_bar),
    custom_thank_you_message = COALESCE(:custom_thank_you_message, custom_thank_you_message),
    redirect_url = COALESCE(:redirect_url, redirect_url),
    settings = COALESCE(:settings, settings)
WHERE id = :id AND user_id = :user_id
RETURNING *;

-- name: DeleteForm :exec
DELETE FROM form.forms
WHERE id = :id AND user_id = :user_id;

-- name: PublishForm :one
UPDATE form.forms
SET is_published = true
WHERE id = :id AND user_id = :user_id
RETURNING *;

-- name: UnpublishForm :one
UPDATE form.forms
SET is_published = false
WHERE id = :id AND user_id = :user_id
RETURNING *;

-- name: GetFormStats :one
SELECT
    COUNT(DISTINCT r.id) as total_responses,
    COUNT(DISTINCT CASE WHEN r.completed = true THEN r.id END) as completed_responses,
    COUNT(DISTINCT CASE WHEN r.completed = false THEN r.id END) as partial_responses
FROM form.forms f
LEFT JOIN form.responses r ON f.id = r.form_id
WHERE f.id = :form_id
GROUP BY f.id;
```

**File:** `sql/queries/question.sql`

```sql
-- name: CreateQuestion :one
INSERT INTO form.questions (
    form_id, type, label, description, placeholder,
    required, order_index, options, validation_rules, settings
) VALUES (
    :form_id, :type, :label, :description, :placeholder,
    :required, :order_index, :options, :validation_rules, :settings
)
RETURNING *;

-- name: GetQuestion :one
SELECT * FROM form.questions
WHERE id = :id;

-- name: ListFormQuestions :many
SELECT * FROM form.questions
WHERE form_id = :form_id
ORDER BY order_index;

-- name: UpdateQuestion :one
UPDATE form.questions
SET
    type = COALESCE(:type, type),
    label = COALESCE(:label, label),
    description = COALESCE(:description, description),
    placeholder = COALESCE(:placeholder, placeholder),
    required = COALESCE(:required, required),
    order_index = COALESCE(:order_index, order_index),
    options = COALESCE(:options, options),
    validation_rules = COALESCE(:validation_rules, validation_rules),
    settings = COALESCE(:settings, settings)
WHERE id = :id
RETURNING *;

-- name: DeleteQuestion :exec
DELETE FROM form.questions
WHERE id = :id;

-- name: ReorderQuestions :exec
UPDATE form.questions
SET order_index = :new_order
WHERE id = :id;

-- name: BulkCreateQuestions :copyfrom
INSERT INTO form.questions (
    form_id, type, label, description, placeholder,
    required, order_index, options, validation_rules, settings
) VALUES (
    :form_id, :type, :label, :description, :placeholder,
    :required, :order_index, :options, :validation_rules, :settings
);
```

**File:** `sql/queries/response.sql`

```sql
-- name: CreateResponse :one
INSERT INTO form.responses (
    form_id, respondent_user_id, respondent_email,
    respondent_name, ip_address, user_agent, completed
) VALUES (
    :form_id, :respondent_user_id, :respondent_email,
    :respondent_name, :ip_address, :user_agent, :completed
)
RETURNING *;

-- name: GetResponse :one
SELECT * FROM form.responses
WHERE id = :id;

-- name: GetResponseWithAnswers :many
SELECT
    r.*,
    a.id as answer_id,
    a.question_id as answer_question_id,
    a.answer_text,
    a.answer_number,
    a.answer_date,
    a.answer_time,
    a.answer_choices,
    a.answer_file_url
FROM form.responses r
LEFT JOIN form.answers a ON r.id = a.response_id
WHERE r.id = :id;

-- name: ListFormResponses :many
SELECT * FROM form.responses
WHERE form_id = :form_id
ORDER BY submitted_at DESC NULLS LAST, created_at DESC
LIMIT :limit_count
OFFSET :offset_count;

-- name: CompleteResponse :one
UPDATE form.responses
SET completed = true, submitted_at = NOW()
WHERE id = :id
RETURNING *;

-- name: CreateAnswer :one
INSERT INTO form.answers (
    response_id, question_id, answer_text, answer_number,
    answer_date, answer_time, answer_choices, answer_file_url
) VALUES (
    :response_id, :question_id, :answer_text, :answer_number,
    :answer_date, :answer_time, :answer_choices, :answer_file_url
)
ON CONFLICT (response_id, question_id)
DO UPDATE SET
    answer_text = EXCLUDED.answer_text,
    answer_number = EXCLUDED.answer_number,
    answer_date = EXCLUDED.answer_date,
    answer_time = EXCLUDED.answer_time,
    answer_choices = EXCLUDED.answer_choices,
    answer_file_url = EXCLUDED.answer_file_url,
    updated_at = NOW()
RETURNING *;

-- name: GetFormResponsesWithAnswers :many
SELECT
    r.id as response_id,
    r.respondent_email,
    r.respondent_name,
    r.submitted_at,
    r.completed,
    q.id as question_id,
    q.label as question_label,
    q.type as question_type,
    a.answer_text,
    a.answer_number,
    a.answer_date,
    a.answer_time,
    a.answer_choices,
    a.answer_file_url
FROM form.responses r
LEFT JOIN form.answers a ON r.id = a.response_id
LEFT JOIN form.questions q ON a.question_id = q.id
WHERE r.form_id = :form_id AND r.completed = true
ORDER BY r.submitted_at DESC, q.order_index;
```

**File:** `sql/queries/user.sql`

```sql
-- name: CreateFormUser :one
INSERT INTO form.users (
    weladee_user_id, email, display_name, avatar_url
) VALUES (
    :weladee_user_id, :email, :display_name, :avatar_url
)
ON CONFLICT (weladee_user_id) DO UPDATE
SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
RETURNING *;

-- name: GetFormUser :one
SELECT * FROM form.users
WHERE id = :id;

-- name: GetFormUserByWeladeeID :one
SELECT * FROM form.users
WHERE weladee_user_id = :weladee_user_id;

-- name: GetFormUserByEmail :one
SELECT * FROM form.users
WHERE email = :email;
```

---

## 🔌 Phase 3: Protocol Buffer Definitions (Days 6-7)

### Step 3.1: Define Proto Messages

**File:** `proto/common.proto`

```protobuf
syntax = "proto3";

package weladee.form.v1;

option go_package = "github.com/weladee/weladee-form/proto/pb";

import "google/protobuf/timestamp.proto";

// Common error details
message ErrorDetail {
  string field = 1;
  string message = 2;
}

// Pagination
message PaginationRequest {
  int32 page = 1;
  int32 page_size = 2;
}

message PaginationResponse {
  int32 total = 1;
  int32 page = 2;
  int32 page_size = 3;
  int32 total_pages = 4;
}
```

**File:** `proto/form.proto`

```protobuf
syntax = "proto3";

package weladee.form.v1;

option go_package = "github.com/weladee/weladee-form/proto/pb";

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";
import "proto/common.proto";

// Question types enum
enum QuestionType {
  QUESTION_TYPE_UNSPECIFIED = 0;
  QUESTION_TYPE_SHORT_TEXT = 1;
  QUESTION_TYPE_LONG_TEXT = 2;
  QUESTION_TYPE_SINGLE_CHOICE = 3;
  QUESTION_TYPE_MULTIPLE_CHOICE = 4;
  QUESTION_TYPE_DROPDOWN = 5;
  QUESTION_TYPE_EMAIL = 6;
  QUESTION_TYPE_PHONE = 7;
  QUESTION_TYPE_NUMBER = 8;
  QUESTION_TYPE_DATE = 9;
  QUESTION_TYPE_TIME = 10;
  QUESTION_TYPE_URL = 11;
  QUESTION_TYPE_FILE_UPLOAD = 12;
  QUESTION_TYPE_RATING = 13;
}

// Form theme enum
enum FormTheme {
  FORM_THEME_UNSPECIFIED = 0;
  FORM_THEME_DEFAULT = 1;
  FORM_THEME_MINIMAL = 2;
  FORM_THEME_MODERN = 3;
  FORM_THEME_CLASSIC = 4;
  FORM_THEME_DARK = 5;
  FORM_THEME_COLORFUL = 6;
}

// Question message
message Question {
  string id = 1;
  string form_id = 2;
  QuestionType type = 3;
  string label = 4;
  string description = 5;
  string placeholder = 6;
  bool required = 7;
  int32 order_index = 8;
  google.protobuf.Struct options = 9;
  google.protobuf.Struct validation_rules = 10;
  google.protobuf.Struct settings = 11;
  google.protobuf.Timestamp created_at = 12;
  google.protobuf.Timestamp updated_at = 13;
}

// Form message
message Form {
  string id = 1;
  string user_id = 2;
  string title = 3;
  string description = 4;
  FormTheme theme = 5;
  bool is_published = 6;
  bool is_accepting_responses = 7;
  bool require_login = 8;
  bool allow_multiple_submissions = 9;
  bool show_progress_bar = 10;
  string custom_thank_you_message = 11;
  string redirect_url = 12;
  google.protobuf.Struct settings = 13;
  repeated Question questions = 14;
  google.protobuf.Timestamp created_at = 15;
  google.protobuf.Timestamp updated_at = 16;
}

// Form statistics
message FormStats {
  int64 total_responses = 1;
  int64 completed_responses = 2;
  int64 partial_responses = 3;
  int64 total_views = 4;
  double completion_rate = 5;
  int32 avg_completion_time_seconds = 6;
}

// RPC messages
message CreateFormRequest {
  string title = 1;
  string description = 2;
  FormTheme theme = 3;
  repeated Question questions = 4;
  google.protobuf.Struct settings = 5;
}

message CreateFormResponse {
  Form form = 1;
}

message GetFormRequest {
  string id = 1;
  bool include_questions = 2;
}

message GetFormResponse {
  Form form = 1;
}

message UpdateFormRequest {
  string id = 1;
  optional string title = 2;
  optional string description = 3;
  optional FormTheme theme = 4;
  optional bool is_published = 5;
  optional bool is_accepting_responses = 6;
  optional bool require_login = 7;
  optional bool allow_multiple_submissions = 8;
  optional bool show_progress_bar = 9;
  optional string custom_thank_you_message = 10;
  optional string redirect_url = 11;
  optional google.protobuf.Struct settings = 12;
}

message UpdateFormResponse {
  Form form = 1;
}

message DeleteFormRequest {
  string id = 1;
}

message DeleteFormResponse {
  bool success = 1;
}

message ListFormsRequest {
  PaginationRequest pagination = 1;
  optional string search_query = 2;
  optional bool published_only = 3;
}

message ListFormsResponse {
  repeated Form forms = 1;
  PaginationResponse pagination = 2;
}

message PublishFormRequest {
  string id = 1;
}

message PublishFormResponse {
  Form form = 1;
}

message GetFormStatsRequest {
  string form_id = 1;
}

message GetFormStatsResponse {
  FormStats stats = 1;
}

// Question RPCs
message CreateQuestionRequest {
  string form_id = 1;
  QuestionType type = 2;
  string label = 3;
  string description = 4;
  string placeholder = 5;
  bool required = 6;
  int32 order_index = 7;
  google.protobuf.Struct options = 8;
  google.protobuf.Struct validation_rules = 9;
}

message CreateQuestionResponse {
  Question question = 1;
}

message UpdateQuestionRequest {
  string id = 1;
  optional QuestionType type = 2;
  optional string label = 3;
  optional string description = 4;
  optional string placeholder = 5;
  optional bool required = 6;
  optional int32 order_index = 7;
  optional google.protobuf.Struct options = 8;
  optional google.protobuf.Struct validation_rules = 9;
}

message UpdateQuestionResponse {
  Question question = 1;
}

message DeleteQuestionRequest {
  string id = 1;
}

message DeleteQuestionResponse {
  bool success = 1;
}

message ReorderQuestionsRequest {
  string form_id = 1;
  repeated string question_ids = 2; // In desired order
}

message ReorderQuestionsResponse {
  bool success = 1;
}

// Form Service definition
service FormService {
  rpc CreateForm(CreateFormRequest) returns (CreateFormResponse);
  rpc GetForm(GetFormRequest) returns (GetFormResponse);
  rpc UpdateForm(UpdateFormRequest) returns (UpdateFormResponse);
  rpc DeleteForm(DeleteFormRequest) returns (DeleteFormResponse);
  rpc ListForms(ListFormsRequest) returns (ListFormsResponse);
  rpc PublishForm(PublishFormRequest) returns (PublishFormResponse);
  rpc GetFormStats(GetFormStatsRequest) returns (GetFormStatsResponse);
  
  // Question management
  rpc CreateQuestion(CreateQuestionRequest) returns (CreateQuestionResponse);
  rpc UpdateQuestion(UpdateQuestionRequest) returns (UpdateQuestionResponse);
  rpc DeleteQuestion(DeleteQuestionRequest) returns (DeleteQuestionResponse);
  rpc ReorderQuestions(ReorderQuestionsRequest) returns (ReorderQuestionsResponse);
}
```

**File:** `proto/response.proto`

```protobuf
syntax = "proto3";

package weladee.form.v1;

option go_package = "github.com/weladee/weladee-form/proto/pb";

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";
import "proto/common.proto";

message Answer {
  string id = 1;
  string response_id = 2;
  string question_id = 3;
  optional string answer_text = 4;
  optional double answer_number = 5;
  optional string answer_date = 6; // ISO 8601
  optional string answer_time = 7; // HH:MM:SS
  optional google.protobuf.Struct answer_choices = 8;
  optional string answer_file_url = 9;
  google.protobuf.Timestamp created_at = 10;
}

message Response {
  string id = 1;
  string form_id = 2;
  optional string respondent_user_id = 3;
  optional string respondent_email = 4;
  optional string respondent_name = 5;
  bool completed = 6;
  google.protobuf.Timestamp submitted_at = 7;
  repeated Answer answers = 8;
  google.protobuf.Timestamp created_at = 9;
}

message SubmitResponseRequest {
  string form_id = 1;
  optional string respondent_email = 2;
  optional string respondent_name = 3;
  repeated AnswerInput answers = 4;
  bool complete = 5; // Whether this is final submission
}

message AnswerInput {
  string question_id = 1;
  optional string answer_text = 2;
  optional double answer_number = 3;
  optional string answer_date = 4;
  optional string answer_time = 5;
  optional google.protobuf.Struct answer_choices = 6;
  optional string answer_file_url = 7;
}

message SubmitResponseResponse {
  Response response = 1;
}

message GetResponseRequest {
  string id = 1;
}

message GetResponseResponse {
  Response response = 1;
}

message ListResponsesRequest {
  string form_id = 1;
  PaginationRequest pagination = 2;
  optional bool completed_only = 3;
}

message ListResponsesResponse {
  repeated Response responses = 1;
  PaginationResponse pagination = 2;
}

message ExportResponsesRequest {
  string form_id = 1;
  string format = 2; // "csv" or "json"
}

message ExportResponsesResponse {
  bytes data = 1;
  string filename = 2;
  string mime_type = 3;
}

service ResponseService {
  rpc SubmitResponse(SubmitResponseRequest) returns (SubmitResponseResponse);
  rpc GetResponse(GetResponseRequest) returns (GetResponseResponse);
  rpc ListResponses(ListResponsesRequest) returns (ListResponsesResponse);
  rpc ExportResponses(ExportResponsesRequest) returns (ExportResponsesResponse);
}
```

**File:** `proto/file.proto`

```protobuf
syntax = "proto3";

package weladee.form.v1;

option go_package = "github.com/weladee/weladee-form/proto/pb";

import "google/protobuf/timestamp.proto";

message UploadFileRequest {
  oneof data {
    FileMetadata metadata = 1;
    bytes chunk = 2;
  }
}

message FileMetadata {
  string form_id = 1;
  string question_id = 2;
  optional string response_id = 3;
  string filename = 4;
  string mime_type = 5;
  int64 file_size = 6;
}

message UploadFileResponse {
  string file_id = 1;
  string file_url = 2;
  string s3_key = 3;
}

message GetFileUrlRequest {
  string file_id = 1;
  optional int32 expires_in_seconds = 2;
}

message GetFileUrlResponse {
  string url = 1;
  google.protobuf.Timestamp expires_at = 2;
}

service FileService {
  rpc UploadFile(stream UploadFileRequest) returns (UploadFileResponse);
  rpc GetFileUrl(GetFileUrlRequest) returns (GetFileUrlResponse);
}
```

---

## 🔐 Phase 4: Authentication Implementation (Days 8-10)

### Step 4.1: Redis Token Validation

**File:** `internal/auth/redis.go`

```go
package auth

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type WeladeeUserClaims struct {
    UserID      int    `json:"user_id"`
    Email       string `json:"email"`
    DisplayName string `json:"display_name"`
    Role        string `json:"role"`
    ExpiresAt   int64  `json:"exp"`
}

type RedisTokenValidator struct {
    client *redis.Client
    prefix string
}

func NewRedisTokenValidator(redisURL, keyPrefix string) (*RedisTokenValidator, error) {
    opts, err := redis.ParseURL(redisURL)
    if err != nil {
        return nil, fmt.Errorf("failed to parse redis URL: %w", err)
    }

    client := redis.NewClient(opts)
    
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := client.Ping(ctx).Err(); err != nil {
        return nil, fmt.Errorf("failed to connect to redis: %w", err)
    }

    return &RedisTokenValidator{
        client: client,
        prefix: keyPrefix,
    }, nil
}

func (r *RedisTokenValidator) ValidateToken(ctx context.Context, token string) (*WeladeeUserClaims, error) {
    key := fmt.Sprintf("%s:%s", r.prefix, token)
    
    data, err := r.client.Get(ctx, key).Result()
    if err == redis.Nil {
        return nil, fmt.Errorf("token not found or expired")
    }
    if err != nil {
        return nil, fmt.Errorf("redis error: %w", err)
    }

    var claims WeladeeUserClaims
    if err := json.Unmarshal([]byte(data), &claims); err != nil {
        return nil, fmt.Errorf("invalid token data: %w", err)
    }

    // Check expiration
    if claims.ExpiresAt > 0 && time.Now().Unix() > claims.ExpiresAt {
        return nil, fmt.Errorf("token expired")
    }

    return &claims, nil
}

func (r *RedisTokenValidator) Close() error {
    return r.client.Close()
}
```

**File:** `internal/auth/interceptor.go`

```go
package auth

import (
    "context"
    "fmt"
    "strings"

    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/metadata"
    "google.golang.org/grpc/status"
)

type contextKey string

const (
    UserClaimsKey contextKey = "user_claims"
)

type AuthInterceptor struct {
    validator     *RedisTokenValidator
    publicMethods map[string]bool
}

func NewAuthInterceptor(validator *RedisTokenValidator) *AuthInterceptor {
    // Methods that don't require authentication
    publicMethods := map[string]bool{
        "/weladee.form.v1.FormService/GetForm":         true, // Public forms
        "/weladee.form.v1.ResponseService/SubmitResponse": true, // Allow anonymous responses
    }

    return &AuthInterceptor{
        validator:     validator,
        publicMethods: publicMethods,
    }
}

func (i *AuthInterceptor) Unary() grpc.UnaryServerInterceptor {
    return func(
        ctx context.Context,
        req any,
        info *grpc.UnaryServerInfo,
        handler grpc.UnaryHandler,
    ) (any, error) {
        // Check if method requires authentication
        if i.publicMethods[info.FullMethod] {
            return handler(ctx, req)
        }

        // Extract token from metadata
        token, err := i.extractToken(ctx)
        if err != nil {
            return nil, status.Errorf(codes.Unauthenticated, "missing or invalid token: %v", err)
        }

        // Validate token
        claims, err := i.validator.ValidateToken(ctx, token)
        if err != nil {
            return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
        }

        // Add claims to context
        ctx = context.WithValue(ctx, UserClaimsKey, claims)

        return handler(ctx, req)
    }
}

func (i *AuthInterceptor) Stream() grpc.StreamServerInterceptor {
    return func(
        srv any,
        stream grpc.ServerStream,
        info *grpc.StreamServerInfo,
        handler grpc.StreamHandler,
    ) error {
        // Check if method requires authentication
        if i.publicMethods[info.FullMethod] {
            return handler(srv, stream)
        }

        // Extract token from metadata
        token, err := i.extractToken(stream.Context())
        if err != nil {
            return status.Errorf(codes.Unauthenticated, "missing or invalid token: %v", err)
        }

        // Validate token
        claims, err := i.validator.ValidateToken(stream.Context(), token)
        if err != nil {
            return status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
        }

        // Create new context with claims
        ctx := context.WithValue(stream.Context(), UserClaimsKey, claims)
        wrappedStream := &wrappedServerStream{
            ServerStream: stream,
            ctx:          ctx,
        }

        return handler(srv, wrappedStream)
    }
}

func (i *AuthInterceptor) extractToken(ctx context.Context) (string, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return "", fmt.Errorf("no metadata found")
    }

    values := md.Get("authorization")
    if len(values) == 0 {
        return "", fmt.Errorf("no authorization header")
    }

    authHeader := values[0]
    if !strings.HasPrefix(authHeader, "Bearer ") {
        return "", fmt.Errorf("invalid authorization header format")
    }

    return strings.TrimPrefix(authHeader, "Bearer "), nil
}

// Helper to extract claims from context
func GetUserClaims(ctx context.Context) (*WeladeeUserClaims, error) {
    claims, ok := ctx.Value(UserClaimsKey).(*WeladeeUserClaims)
    if !ok {
        return nil, fmt.Errorf("no user claims in context")
    }
    return claims, nil
}

type wrappedServerStream struct {
    grpc.ServerStream
    ctx context.Context
}

func (w *wrappedServerStream) Context() context.Context {
    return w.ctx
}
```

---

## 📦 Phase 5: Go Backend Implementation (Days 11-20)

### Step 5.1: Main Server Setup

**File:** `cmd/server/main.go`

```go
package main

import (
    "context"
    "fmt"
    "log"
    "net"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
    "google.golang.org/grpc"
    "google.golang.org/grpc/reflection"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db"
    "github.com/weladee/weladee-form/internal/gapi"
    "github.com/weladee/weladee-form/internal/storage"
    pb "github.com/weladee/weladee-form/proto/pb"
)

type Config struct {
    GRPCPort     string
    DatabaseURL  string
    RedisURL     string
    RedisPrefix  string
    S3Region     string
    S3Bucket     string
    S3AccessKey  string
    S3SecretKey  string
    S3Endpoint   string // Optional, for S3-compatible services
}

func loadConfig() *Config {
    return &Config{
        GRPCPort:    getEnv("GRPC_PORT", "50051"),
        DatabaseURL: getEnv("DATABASE_URL", ""),
        RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
        RedisPrefix: getEnv("REDIS_KEY_PREFIX", "weladee:auth:token"),
        S3Region:    getEnv("S3_REGION", "us-east-1"),
        S3Bucket:    getEnv("S3_BUCKET", ""),
        S3AccessKey: getEnv("S3_ACCESS_KEY", ""),
        S3SecretKey: getEnv("S3_SECRET_KEY", ""),
        S3Endpoint:  getEnv("S3_ENDPOINT", ""),
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func main() {
    cfg := loadConfig()

    // Database connection
    dbPool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer dbPool.Close()

    database := db.NewDatabase(dbPool)
    log.Println("✓ Connected to PostgreSQL")

    // Redis token validator
    tokenValidator, err := auth.NewRedisTokenValidator(cfg.RedisURL, cfg.RedisPrefix)
    if err != nil {
        log.Fatalf("Failed to setup Redis: %v", err)
    }
    defer tokenValidator.Close()
    log.Println("✓ Connected to Redis")

    // S3 storage
    s3Storage, err := storage.NewS3Storage(storage.S3Config{
        Region:    cfg.S3Region,
        Bucket:    cfg.S3Bucket,
        AccessKey: cfg.S3AccessKey,
        SecretKey: cfg.S3SecretKey,
        Endpoint:  cfg.S3Endpoint,
    })
    if err != nil {
        log.Fatalf("Failed to setup S3: %v", err)
    }
    log.Println("✓ Connected to S3")

    // Create gRPC server with interceptors
    authInterceptor := auth.NewAuthInterceptor(tokenValidator)
    
    grpcServer := grpc.NewServer(
        grpc.UnaryInterceptor(authInterceptor.Unary()),
        grpc.StreamInterceptor(authInterceptor.Stream()),
        grpc.MaxRecvMsgSize(10 * 1024 * 1024), // 10MB for file uploads
    )

    // Register services
    formServer := gapi.NewFormServer(database, s3Storage)
    pb.RegisterFormServiceServer(grpcServer, formServer)
    
    responseServer := gapi.NewResponseServer(database)
    pb.RegisterResponseServiceServer(grpcServer, responseServer)
    
    fileServer := gapi.NewFileServer(database, s3Storage)
    pb.RegisterFileServiceServer(grpcServer, fileServer)

    // Enable reflection for dev tools like grpcurl
    reflection.Register(grpcServer)

    // Start server
    listener, err := net.Listen("tcp", fmt.Sprintf(":%s", cfg.GRPCPort))
    if err != nil {
        log.Fatalf("Failed to listen: %v", err)
    }

    log.Printf("🚀 Weladee Form gRPC server starting on port %s", cfg.GRPCPort)

    // Graceful shutdown
    go func() {
        if err := grpcServer.Serve(listener); err != nil {
            log.Fatalf("Failed to serve: %v", err)
        }
    }()

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Println("Shutting down server...")
    grpcServer.GracefulStop()
    log.Println("✓ Server stopped")
}
```

### Step 5.2: Database Layer

**File:** `internal/db/database.go`

```go
package db

import (
    "context"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/weladee/weladee-form/internal/db/sqlc"
)

type Database struct {
    Queries *sqlc.Queries
    Pool    *pgxpool.Pool
}

func NewDatabase(pool *pgxpool.Pool) *Database {
    return &Database{
        Queries: sqlc.New(pool),
        Pool:    pool,
    }
}

// Transaction helper
func (db *Database) ExecTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
    tx, err := db.Pool.Begin(ctx)
    if err != nil {
        return err
    }

    q := db.Queries.WithTx(tx)
    err = fn(q)
    if err != nil {
        if rbErr := tx.Rollback(ctx); rbErr != nil {
            return fmt.Errorf("tx err: %v, rb err: %v", err, rbErr)
        }
        return err
    }

    return tx.Commit(ctx)
}
```

### Step 5.3: S3 Storage Implementation

**File:** `internal/storage/s3.go`

```go
package storage

import (
    "context"
    "fmt"
    "io"
    "path/filepath"
    "time"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/google/uuid"
)

type S3Config struct {
    Region    string
    Bucket    string
    AccessKey string
    SecretKey string
    Endpoint  string
}

type S3Storage struct {
    client *s3.Client
    bucket string
}

func NewS3Storage(cfg S3Config) (*S3Storage, error) {
    var awsCfg aws.Config
    var err error

    if cfg.Endpoint != "" {
        // S3-compatible service
        awsCfg, err = config.LoadDefaultConfig(context.Background(),
            config.WithRegion(cfg.Region),
            config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
                func(service, region string, options ...any) (aws.Endpoint, error) {
                    return aws.Endpoint{URL: cfg.Endpoint}, nil
                },
            )),
            config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
                cfg.AccessKey, cfg.SecretKey, "",
            )),
        )
    } else {
        // Standard AWS S3
        awsCfg, err = config.LoadDefaultConfig(context.Background(),
            config.WithRegion(cfg.Region),
            config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
                cfg.AccessKey, cfg.SecretKey, "",
            )),
        )
    }

    if err != nil {
        return nil, fmt.Errorf("failed to load AWS config: %w", err)
    }

    client := s3.NewFromConfig(awsCfg)

    return &S3Storage{
        client: client,
        bucket: cfg.Bucket,
    }, nil
}

func (s *S3Storage) UploadFile(ctx context.Context, reader io.Reader, filename, mimeType string) (string, string, error) {
    // Generate unique key
    ext := filepath.Ext(filename)
    key := fmt.Sprintf("form-uploads/%s/%s%s", 
        time.Now().Format("2006/01/02"),
        uuid.New().String(),
        ext,
    )

    // Upload to S3
    _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
        Bucket:      aws.String(s.bucket),
        Key:         aws.String(key),
        Body:        reader,
        ContentType: aws.String(mimeType),
    })
    if err != nil {
        return "", "", fmt.Errorf("failed to upload to S3: %w", err)
    }

    // Generate URL
    url := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.bucket, key)

    return key, url, nil
}

func (s *S3Storage) GetPresignedURL(ctx context.Context, key string, expiresIn time.Duration) (string, error) {
    presignClient := s3.NewPresignClient(s.client)

    req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(key),
    }, func(opts *s3.PresignOptions) {
        opts.Expires = expiresIn
    })

    if err != nil {
        return "", fmt.Errorf("failed to generate presigned URL: %w", err)
    }

    return req.URL, nil
}
```

### Step 5.4: gRPC Service Implementation Example

**File:** `internal/gapi/rpc_form.go`

```go
package gapi

import (
    "context"
    "fmt"

    "github.com/google/uuid"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/weladee/weladee-form/internal/auth"
    "github.com/weladee/weladee-form/internal/db/sqlc"
    pb "github.com/weladee/weladee-form/proto/pb"
)

func (server *FormServer) CreateForm(ctx context.Context, req *pb.CreateFormRequest) (*pb.CreateFormResponse, error) {
    // Get user from context
    claims, err := auth.GetUserClaims(ctx)
    if err != nil {
        return nil, status.Errorf(codes.Unauthenticated, "not authenticated")
    }

    // Ensure form user exists
    formUser, err := server.db.Queries.CreateFormUser(ctx, sqlc.CreateFormUserParams{
        WeladeeUserID: int32(claims.UserID),
        Email:         claims.Email,
        DisplayName:   sqlc.NullString{String: claims.DisplayName, Valid: true},
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to create/get form user: %v", err)
    }

    // Create form
    form, err := server.db.Queries.CreateForm(ctx, sqlc.CreateFormParams{
        UserID:      formUser.ID,
        Title:       req.Title,
        Description: sqlc.NullString{String: req.Description, Valid: req.Description != ""},
        Theme:       req.Theme.String(),
        // ... other fields
    })
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to create form: %v", err)
    }

    // Create questions if provided
    if len(req.Questions) > 0 {
        for i, q := range req.Questions {
            _, err := server.db.Queries.CreateQuestion(ctx, sqlc.CreateQuestionParams{
                FormID:     form.ID,
                Type:       q.Type.String(),
                Label:      q.Label,
                OrderIndex: int32(i),
                Required:   q.Required,
                // ... other fields
            })
            if err != nil {
                return nil, status.Errorf(codes.Internal, "failed to create question: %v", err)
            }
        }
    }

    // Fetch complete form with questions
    formWithQuestions, err := server.getFormWithQuestions(ctx, form.ID)
    if err != nil {
        return nil, err
    }

    return &pb.CreateFormResponse{
        Form: formWithQuestions,
    }, nil
}

func (server *FormServer) GetForm(ctx context.Context, req *pb.GetFormRequest) (*pb.GetFormResponse, error) {
    formID, err := uuid.Parse(req.Id)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid form ID: %v", err)
    }

    form, err := server.db.Queries.GetForm(ctx, formID)
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "form not found: %v", err)
    }

    pbForm := &pb.Form{
        Id:          form.ID.String(),
        UserId:      form.UserID.String(),
        Title:       form.Title,
        Description: form.Description.String,
        // ... map all fields
        CreatedAt:   timestamppb.New(form.CreatedAt),
        UpdatedAt:   timestamppb.New(form.UpdatedAt),
    }

    if req.IncludeQuestions {
        questions, err := server.db.Queries.ListFormQuestions(ctx, form.ID)
        if err != nil {
            return nil, status.Errorf(codes.Internal, "failed to get questions: %v", err)
        }

        for _, q := range questions {
            pbForm.Questions = append(pbForm.Questions, &pb.Question{
                Id:          q.ID.String(),
                FormId:      q.FormID.String(),
                Type:        pb.QuestionType(pb.QuestionType_value[q.Type]),
                Label:       q.Label,
                OrderIndex:  q.OrderIndex,
                Required:    q.Required,
                // ... map all fields
            })
        }
    }

    return &pb.GetFormResponse{Form: pbForm}, nil
}

// Continue with other RPC implementations...
```

---

## 🌐 Phase 6: Frontend Migration (Days 21-25)

### Step 6.1: Install gRPC-Web Dependencies

```bash
cd weladee-form
npm install @bufbuild/protobuf @bufbuild/connect @bufbuild/connect-web
npm install @bufbuild/protoc-gen-es @bufbuild/protoc-gen-connect-es --save-dev
```

### Step 6.2: Generate TypeScript Client

**File:** `scripts/generate-proto-web.sh`

```bash
#!/bin/bash

# Generate TypeScript files from proto
protoc -I=proto \
  --es_out=lib/proto \
  --es_opt=target=ts \
  --connect-es_out=lib/proto \
  --connect-es_opt=target=ts \
  proto/*.proto

echo "✓ Generated TypeScript proto files"
```

### Step 6.3: Create gRPC Client

**File:** `lib/grpc-client.ts`

```typescript
import { createPromiseClient } from "@bufbuild/connect";
import { createGrpcWebTransport } from "@bufbuild/connect-web";
import { FormService } from "./proto/form_connect";
import { ResponseService } from "./proto/response_connect";
import { FileService } from "./proto/file_connect";

const transport = createGrpcWebTransport({
  baseUrl: process.env.NEXT_PUBLIC_GRPC_URL || "http://localhost:8080",
  interceptors: [
    (next) => async (req) => {
      // Add auth token to all requests
      const token = localStorage.getItem("weladee_token");
      if (token) {
        req.header.set("Authorization", `Bearer ${token}`);
      }
      return await next(req);
    },
  ],
});

export const formClient = createPromiseClient(FormService, transport);
export const responseClient = createPromiseClient(ResponseService, transport);
export const fileClient = createPromiseClient(FileService, transport);
```

### Step 6.4: Replace API Calls

**Example:** Update form creation

```typescript
// OLD (Supabase)
const { data, error } = await supabase
  .from('forms')
  .insert({ title, description })
  .select()
  .single();

// NEW (gRPC)
import { formClient } from '@/lib/grpc-client';

const response = await formClient.createForm({
  title,
  description,
  theme: FormTheme.DEFAULT,
  questions: []
});
const form = response.form;
```

---

## ✅ Phase 7: Testing & Validation (Days 26-28)

### Comprehensive Test Checklist

#### Unit Tests
- [ ] All SQLC query tests
- [ ] Auth interceptor tests
- [ ] S3 storage mock tests
- [ ] Validation logic tests

#### Integration Tests
- [ ] Form CRUD operations
- [ ] Question management
- [ ] Response submission flow
- [ ] File upload/download
- [ ] Authentication flow

#### End-to-End Tests
- [ ] Create form → publish → submit response
- [ ] All 15 question types work correctly
- [ ] CSV export generates correctly
- [ ] All 6 themes render properly
- [ ] Keyboard navigation preserved

#### Performance Tests
- [ ] gRPC vs REST latency comparison
- [ ] Large file upload (up to 10MB)
- [ ] 1000+ responses export
- [ ] Concurrent form submissions

---

## 🚀 Phase 8: Deployment & Integration (Days 29-35)

### Deployment Checklist

```yaml
# deployment-checklist.md

## Pre-Deployment
- [ ] All environment variables documented
- [ ] Database migrations tested on staging
- [ ] gRPC server builds successfully
- [ ] Frontend builds without errors
- [ ] All tests passing

## Database
- [ ] Create `form` schema in Weladee DB
- [ ] Run initial migration
- [ ] Set up DB connection pooling
- [ ] Configure backup strategy

## Backend
- [ ] Deploy Go gRPC server
- [ ] Configure Redis connection
- [ ] Set up S3 bucket and IAM policies
- [ ] Configure logging and monitoring
- [ ] Set up health checks

## Frontend
- [ ] Update Next.js environment variables
- [ ] Deploy with gRPC-Web proxy if needed

---

## 🔐 Phase 9: Asymmetric JWT Signing (Security Enhancement)

To enhance security, the system has been upgraded from symmetric (HS256) to asymmetric (RS256) JWT signing. This ensures that the private key used for signing never needs to be stored on the validation server.

### 1. Generate RSA Key Pair

Use the built-in CLI command to generate a 2048-bit RSA key pair:

```bash
go run ./cmd/server generate-keys --output-dir . --private-key-file jwt-private.pem --public-key-file jwt-public.pem
```

### 2. Configuration

Update your environment variables or `config.yaml`:

- `JWT_PRIVATE_KEY_PATH`: Path to the private key (e.g., `./jwt-private.pem`). Required for CLI signing.
- `JWT_PUBLIC_KEY_PATH`: Path to the public key (e.g., `./jwt-public.pem`). Required for server-side validation.
- `JWT_SECRET`: Retained as a fallback for HS256 (optional during transition).

### 3. Generate Tokens with RS256

The `create-jwt` command will automatically use RS256 if `JWT_PRIVATE_KEY_PATH` is configured:

```bash
JWT_PRIVATE_KEY_PATH=./jwt-private.pem go run ./cmd/server create-jwt --name "John Doe" --email "john@example.com"
```

### 4. Validation

The backend `JWTValidator` (`internal/auth/jwt.go`) will automatically prefer RS256 validation if `JWTPublicKeyPath` is provided in the configuration. It maintains backward compatibility with HS256 as a fallback if the public key is not configured or if an HS256 token is received.