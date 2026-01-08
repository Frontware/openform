# gRPC Services Documentation

**Protocol:** gRPC with Connect RPC (gRPC-Web compatible)
**Definitions:** `proto/*.proto`
**Generated Code:** `proto/pb/*.pb.go`, `lib/proto/proto/*.ts`

## Overview

Weladee Form exposes gRPC services for type-safe communication between frontend and backend. All services use Protocol Buffers for serialization.

## Services

| Service | Purpose | Proto File |
|---------|---------|------------|
| FormService | Form and question management | `proto/form.proto` |
| ResponseService | Response collection and export | `proto/response.proto` |
| FileService | File upload/download | `proto/file.proto` |
| AnalyticsService | Analytics and tracking | `proto/analytics.proto` |
| AuthService | JWT validation | `proto/auth.proto` |

## FormService

**Package:** `weladee.form.v1`
**File:** `proto/form.proto`

### RPC Methods

#### CreateForm

Creates a new form with optional initial questions.

**Request:**
```protobuf
message CreateFormRequest {
  string title = 1;
  string description = 2;
  FormTheme theme = 3;
  ProgressBarStyle progress_bar_style = 4;
  repeated Question questions = 5;
  google.protobuf.Struct settings = 6;
}
```

**Response:**
```protobuf
message CreateFormResponse {
  Form form = 1;
}
```

**Customer Type Enforcement:**
- SME: Max 5 forms
- Standard: Max 15 forms
- Enterprise: Unlimited forms

**Example:**
```typescript
const response = await formClient.createForm({
  title: "Customer Feedback",
  description: "Help us improve",
  theme: FormTheme.FORM_THEME_MINIMAL,
  progressBarStyle: ProgressBarStyle.PROGRESS_BAR_STYLE_LINEAR,
  questions: [{
    type: QuestionType.QUESTION_TYPE_SHORT_TEXT,
    label: "What is your name?",
    required: true,
    orderIndex: 0
  }]
})
```

#### GetForm

Retrieves a form by ID with optional questions.

**Request:**
```protobuf
message GetFormRequest {
  string id = 1;
  bool include_questions = 2;
}
```

**Response:**
```protobuf
message GetFormResponse {
  Form form = 1;
}
```

**Auth:** Required

#### GetFormBySlug

Retrieves a form by its public slug (no auth required).

**Request:**
```protobuf
message GetFormBySlugRequest {
  string slug = 1;
}
```

**Response:**
```protobuf
message GetFormBySlugResponse {
  Form form = 1;
}
```

**Auth:** Public (no JWT required)

#### UpdateForm

Updates form properties. All fields are optional.

**Request:**
```protobuf
message UpdateFormRequest {
  string id = 1;
  optional string title = 2;
  optional string description = 3;
  optional FormTheme theme = 4;
  optional bool is_published = 5;
  optional bool is_accepting_responses = 6;
  optional bool require_login = 7;
  optional bool allow_multiple_submissions = 8;
  optional ProgressBarStyle progress_bar_style = 9;
  optional string custom_thank_you_message = 10;
  optional string redirect_url = 11;
  optional bool force_captcha = 12;
  optional string email_notification_mode = 13;
  optional google.protobuf.Struct settings = 14;
}
```

**Response:**
```protobuf
message UpdateFormResponse {
  Form form = 1;
}
```

**Auth:** Required

#### DeleteForm

Deletes a form and cascades to all dependent data.

**Request:**
```protobuf
message DeleteFormRequest {
  string id = 1;
}
```

**Response:**
```protobuf
message DeleteFormResponse {
  bool success = 1;
}
```

**Auth:** Required

#### ListForms

Lists user's forms with pagination, search, sort, and filter.

**Request:**
```protobuf
message ListFormsRequest {
  PaginationRequest pagination = 1;
  optional string search_query = 2;
  optional bool published_only = 3;
  optional FormSortBy sort_by = 4;
  optional FormSortOrder sort_order = 5;
  optional FormStatusFilter status_filter = 6;
}

message PaginationRequest {
  int32 page = 1;
  int32 page_size = 2;
}
```

**Response:**
```protobuf
message ListFormsResponse {
  repeated Form forms = 1;
  PaginationResponse pagination = 2;
}

message PaginationResponse {
  int32 total_pages = 1;
  int32 total_items = 2;
  int32 page = 3;
  int32 page_size = 4;
}
```

**Auth:** Required

#### PublishForm

Marks form as published and generates unique slug.

**Request:**
```protobuf
message PublishFormRequest {
  string id = 1;
}
```

**Response:**
```protobuf
message PublishFormResponse {
  Form form = 1;
}
```

**Auth:** Required

#### GetFormStats

Gets response statistics for a form.

**Request:**
```protobuf
message GetFormStatsRequest {
  string form_id = 1;
}
```

**Response:**
```protobuf
message GetFormStatsResponse {
  FormStats stats = 1;
}

message FormStats {
  int64 total_responses = 1;
  int64 completed_responses = 2;
  int64 partial_responses = 3;
}
```

**Auth:** Required

### Question Management

#### CreateQuestion

Adds a question to a form.

**Request:**
```protobuf
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
```

**Response:**
```protobuf
message CreateQuestionResponse {
  Question question = 1;
}
```

**Customer Type Enforcement:**
- `QUESTION_TYPE_FILE_UPLOAD`: Enterprise only
- `QUESTION_TYPE_MATRIX`: Standard and Enterprise
- `QUESTION_TYPE_RANKING`: Enterprise only

#### UpdateQuestion

Updates a question.

**Auth:** Required

#### DeleteQuestion

Deletes a question.

**Auth:** Required

#### ReorderQuestions

Bulk reorders questions in a form.

**Request:**
```protobuf
message ReorderQuestionsRequest {
  string form_id = 1;
  repeated string question_ids = 2;  // New order
}
```

**Auth:** Required

## ResponseService

**Package:** `weladee.form.v1`
**File:** `proto/response.proto`

### RPC Methods

#### SubmitResponse

Submits or partially saves a form response.

**Request:**
```protobuf
message SubmitResponseRequest {
  string form_id = 1;
  optional string respondent_email = 2;
  optional string respondent_name = 3;
  repeated AnswerInput answers = 4;
  bool complete = 5;
  optional string recaptcha_token = 6;
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
```

**Response:**
```protobuf
message SubmitResponseResponse {
  Response response = 1;
}
```

**Auth:** Public (no JWT required)

**Behavior:**
- `complete = true`: Finalizes response, sets `submitted_at`
- `complete = false`: Saves as draft, can be completed later

#### GetResponse

Retrieves a single response by ID.

**Auth:** Required

#### ListResponses

Lists responses for a form with pagination.

**Request:**
```protobuf
message ListResponsesRequest {
  string form_id = 1;
  PaginationRequest pagination = 2;
  optional bool completed_only = 3;
}
```

**Response:**
```protobuf
message ListResponsesResponse {
  repeated Response responses = 1;
  PaginationResponse pagination = 2;
}
```

**Auth:** Required

#### DeleteResponse

Deletes a response.

**Auth:** Required

#### ExportResponses

Exports responses to CSV, JSON, or Excel.

**Request:**
```protobuf
message ExportResponsesRequest {
  string form_id = 1;
  string format = 2;  // "csv", "json", "excel"
}
```

**Response:**
```protobuf
message ExportResponsesResponse {
  bytes data = 1;
  string filename = 2;
  string mime_type = 3;
}
```

**Customer Type Enforcement:**
- `format = "excel"`: Enterprise only

**Auth:** Required

## FileService

**Package:** `weladee.form.v1`
**File:** `proto/file.proto`

### RPC Methods

#### UploadFile

Streaming file upload for file upload questions.

**Request Stream:**
```protobuf
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
```

**Response:**
```protobuf
message UploadFileResponse {
  string file_url = 1;
  string filename = 2;
}
```

**Auth:** Required

**Customer Type Enforcement:**
- Only available for Enterprise customers

#### GetFileUrl

Generates a presigned URL for file download.

**Auth:** Required

## AnalyticsService

**Package:** `weladee.form.v1`
**File:** `proto/analytics.proto`

### RPC Methods

#### TrackView

Tracks a form view (analytics).

**Auth:** Public (no JWT required)

#### TrackResponseStart

Tracks when a respondent starts a form.

**Auth:** Public (no JWT required)

#### GetAnalyticsOverview

Gets summary statistics for a form.

**Auth:** Required

#### GetQuestionStats

Gets answer distribution for questions.

**Auth:** Required

#### GetTrendsData

Gets time-series analytics data.

**Auth:** Required

#### ExportAnalytics

Exports analytics to CSV, XLSX, or PDF.

**Auth:** Required

## Enums

### FormTheme

```protobuf
enum FormTheme {
  FORM_THEME_UNSPECIFIED = 0;
  FORM_THEME_MINIMAL = 1;
  FORM_THEME_MIDNIGHT = 2;
  FORM_THEME_OCEAN = 3;
  FORM_THEME_SUNSET = 4;
  FORM_THEME_FOREST = 5;
  FORM_THEME_LAVENDER = 6;
  FORM_THEME_WELADEE = 7;
  FORM_THEME_AURORA = 8;
  FORM_THEME_CYBERPUNK = 9;
  FORM_THEME_DESERT = 10;
}
```

### QuestionType

```protobuf
enum QuestionType {
  QUESTION_TYPE_UNSPECIFIED = 0;
  QUESTION_TYPE_SHORT_TEXT = 1;
  QUESTION_TYPE_LONG_TEXT = 2;
  QUESTION_TYPE_DROPDOWN = 3;
  QUESTION_TYPE_CHECKBOXES = 4;
  QUESTION_TYPE_EMAIL = 5;
  QUESTION_TYPE_PHONE = 6;
  QUESTION_TYPE_NUMBER = 7;
  QUESTION_TYPE_DATE = 8;
  QUESTION_TYPE_RATING = 9;
  QUESTION_TYPE_OPINION_SCALE = 10;
  QUESTION_TYPE_YES_NO = 11;
  QUESTION_TYPE_FILE_UPLOAD = 12;      // Enterprise only
  QUESTION_TYPE_URL = 13;
  QUESTION_TYPE_MATRIX = 14;           // Standard+
  QUESTION_TYPE_RANKING = 15;          // Enterprise only
}
```

### ProgressBarStyle

```protobuf
enum ProgressBarStyle {
  PROGRESS_BAR_STYLE_UNSPECIFIED = 0;
  PROGRESS_BAR_STYLE_NONE = 1;
  PROGRESS_BAR_STYLE_LINEAR = 2;
  PROGRESS_BAR_STYLE_STEPS = 3;
  PROGRESS_BAR_STYLE_CIRCULAR = 4;
}
```

## Common Types

### Form

```protobuf
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
  ProgressBarStyle progress_bar_style = 10;
  string custom_thank_you_message = 11;
  string redirect_url = 12;
  bool force_captcha = 13;
  string email_notification_mode = 14;
  google.protobuf.Struct settings = 15;
  repeated Question questions = 16;
  google.protobuf.Timestamp created_at = 17;
  google.protobuf.Timestamp updated_at = 18;
}
```

### Question

```protobuf
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
```

### Response

```protobuf
message Response {
  string id = 1;
  string form_id = 2;
  optional string respondent_user_id = 3;
  optional string respondent_email = 4;
  optional string respondent_name = 5;
  bool completed = 7;
  google.protobuf.Timestamp submitted_at = 8;
  repeated Answer answers = 9;
  google.protobuf.Timestamp created_at = 10;
}
```

### Answer

```protobuf
message Answer {
  string id = 1;
  string response_id = 2;
  string question_id = 3;
  optional string answer_text = 4;
  optional double answer_number = 5;
  optional string answer_date = 6;
  optional string answer_time = 7;
  optional google.protobuf.Struct answer_choices = 8;
  optional string answer_file_url = 9;
  google.protobuf.Timestamp created_at = 10;
}
```

## Error Handling

### gRPC Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| `OK` | Success | Request succeeded |
| `InvalidArgument` | Bad request | Invalid input parameters |
| `NotFound` | Not found | Form/question/response not found |
| `PermissionDenied` | Access denied | Customer type restrictions |
| `Unauthenticated` | Not authenticated | Missing or invalid JWT |
| `ResourceExhausted` | Limit exceeded | Form creation limit |
| `Internal` | Server error | Unexpected server error |
| `Unavailable` | Service unavailable | Database/connection issues |

### Error Response Example

```typescript
try {
  await formClient.createForm(req)
} catch (err) {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.Unauthenticated:
        // Redirect to login
        break
      case Code.PermissionDenied:
        // Show customer type upgrade message
        console.log(err.message) // "file upload requires enterprise plan"
        break
      case Code.ResourceExhausted:
        console.log(err.message) // "form limit reached for your plan"
        break
    }
  }
}
```

## Client Usage

### TypeScript/JavaScript

**Installation:**
```bash
npm install @bufbuild/connect-web @bufbuild/protobuf
```

**Import:**
```typescript
import { createPromiseClient } from "@bufbuild/connect"
import { createGrpcWebTransport } from "@bufbuild/connect-web"
import { FormService } from "@/proto/proto/form_connect"
```

**Create Client:**
```typescript
const transport = createGrpcWebTransport({
  baseUrl: process.env.NEXT_PUBLIC_GRPC_URL || ""
})

const formClient = createPromiseClient(FormService, transport)
```

**Make Request:**
```typescript
const response = await formClient.createForm({
  title: "My Form",
  theme: FormTheme.FORM_THEME_MINIMAL
})

console.log(response.form.id)
```

---

**Next:** [Authentication Flow](./auth-flow.md)
