-- Create form schema in Weladee database
CREATE SCHEMA IF NOT EXISTS form;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (references Weladee users)
-- Maps Weladee platform users to form system users
CREATE TABLE form.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weladee_user_id INTEGER NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE form.users IS 'Form system users - linked to Weladee platform users';
COMMENT ON COLUMN form.users.id IS 'Internal user identifier (UUID)';
COMMENT ON COLUMN form.users.weladee_user_id IS 'Reference to Weladee platform user ID';
COMMENT ON COLUMN form.users.email IS 'User email address (unique)';
COMMENT ON COLUMN form.users.full_name IS 'User display name';
COMMENT ON COLUMN form.users.avatar_url IS 'Profile picture URL';

-- Forms table
-- Stores form definitions including structure, appearance, and behavior
CREATE TABLE form.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES form.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL DEFAULT 'Untitled Form',
    description TEXT,
    slug VARCHAR(255) UNIQUE,  -- URL-friendly identifier for public forms (e.g., 'customer-feedback')
    theme VARCHAR(50) NOT NULL DEFAULT 'minimal' CHECK (theme IN ('minimal', 'midnight', 'ocean', 'sunset', 'forest', 'lavender', 'weladee', 'aurora', 'cyberpunk', 'desert')),
    is_published BOOLEAN NOT NULL DEFAULT false,  -- Whether form is publicly accessible
    is_accepting_responses BOOLEAN NOT NULL DEFAULT true,  -- Whether form currently accepts submissions
    require_login BOOLEAN NOT NULL DEFAULT false,  -- Whether users must be logged in to submit
    allow_multiple_submissions BOOLEAN NOT NULL DEFAULT false,  -- Allow same user to submit multiple times
    show_progress_bar BOOLEAN NOT NULL DEFAULT true,  -- Display progress indicator
    custom_thank_you_message TEXT,  -- Custom message shown after submission
    redirect_url TEXT,  -- Optional URL to redirect to after submission
    force_captcha BOOLEAN NOT NULL DEFAULT false,  -- Whether to require reCAPTCHA verification on form submission to prevent bots
    settings JSONB DEFAULT '{}'::jsonb,  -- Additional form settings as JSON
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE form.forms IS 'Form definitions - stores form structure, settings, and metadata';
COMMENT ON COLUMN form.forms.id IS 'Unique form identifier (UUID)';
COMMENT ON COLUMN form.forms.user_id IS 'Owner of the form (foreign key to users table)';
COMMENT ON COLUMN form.forms.title IS 'Form title displayed to respondents';
COMMENT ON COLUMN form.forms.description IS 'Optional form description or instructions';
COMMENT ON COLUMN form.forms.slug IS 'URL-friendly identifier for public form access (e.g., /f/customer-feedback)';
COMMENT ON COLUMN form.forms.theme IS 'Visual theme/appearance preset';
COMMENT ON COLUMN form.forms.is_published IS 'Whether form is live and accessible via public URL';
COMMENT ON COLUMN form.forms.is_accepting_responses IS 'Whether form currently accepts new responses';
COMMENT ON COLUMN form.forms.require_login IS 'Whether respondents must be authenticated';
COMMENT ON COLUMN form.forms.allow_multiple_submissions IS 'Allow same user to submit more than once';
COMMENT ON COLUMN form.forms.show_progress_bar IS 'Display progress indicator to respondents';
COMMENT ON COLUMN form.forms.custom_thank_you_message IS 'Custom confirmation message after submission';
COMMENT ON COLUMN form.forms.redirect_url IS 'Optional URL to redirect after submission';
COMMENT ON COLUMN form.forms.settings IS 'Additional configuration as JSON (flexible schema)';

CREATE INDEX idx_forms_user_id ON form.forms(user_id);
CREATE INDEX idx_forms_is_published ON form.forms(is_published);

-- Questions table
-- Individual questions within a form (e.g., text input, multiple choice)
CREATE TABLE form.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'short_text', 'long_text', 'dropdown', 'checkboxes',
        'email', 'phone', 'number', 'date', 'rating',
        'opinion_scale', 'yes_no', 'file_upload', 'url'
    )),
    label TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL,
    options JSONB,
    validation_rules JSONB,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE form.questions IS 'Form questions - individual fields in a form';
COMMENT ON COLUMN form.questions.id IS 'Question identifier (UUID)';
COMMENT ON COLUMN form.questions.form_id IS 'Parent form (foreign key)';
COMMENT ON COLUMN form.questions.type IS 'Question type (short_text, long_text, dropdown, checkboxes, etc.)';
COMMENT ON COLUMN form.questions.label IS 'Question text/title';
COMMENT ON COLUMN form.questions.description IS 'Additional explanation or instructions';
COMMENT ON COLUMN form.questions.placeholder IS 'Example text shown in empty input field';
COMMENT ON COLUMN form.questions.required IS 'Whether question must be answered';
COMMENT ON COLUMN form.questions.order_index IS 'Display order within form (0, 1, 2, ...)';
COMMENT ON COLUMN form.questions.options IS 'Options for choice-based questions (JSON array)';
COMMENT ON COLUMN form.questions.validation_rules IS 'Validation rules (min, max, pattern, etc.)';
COMMENT ON COLUMN form.questions.settings IS 'Additional question configuration (JSON)';

CREATE INDEX idx_questions_form_id ON form.questions(form_id);
CREATE INDEX idx_questions_order ON form.questions(form_id, order_index);

-- Responses table
-- Individual form submissions (one row per form submission)
CREATE TABLE form.responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    respondent_user_id UUID REFERENCES form.users(id) ON DELETE SET NULL,
    respondent_email VARCHAR(255),
    respondent_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    completed BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE form.responses IS 'Form submissions - one record per form submission';
COMMENT ON COLUMN form.responses.id IS 'Response identifier (UUID)';
COMMENT ON COLUMN form.responses.form_id IS 'Form that was submitted (foreign key)';
COMMENT ON COLUMN form.responses.respondent_user_id IS 'Authenticated user who submitted (if logged in)';
COMMENT ON COLUMN form.responses.respondent_email IS 'Email provided by respondent (if not logged in)';
COMMENT ON COLUMN form.responses.respondent_name IS 'Name provided by respondent (if not logged in)';
COMMENT ON COLUMN form.responses.ip_address IS 'IP address of respondent';
COMMENT ON COLUMN form.responses.user_agent IS 'Browser/device user agent string';
COMMENT ON COLUMN form.responses.completed IS 'Whether response was fully completed';
COMMENT ON COLUMN form.responses.submitted_at IS 'Timestamp of final submission';

CREATE INDEX idx_responses_form_id ON form.responses(form_id);
CREATE INDEX idx_responses_submitted_at ON form.responses(submitted_at DESC);

-- Answers table
-- Individual answers to questions within a response
CREATE TABLE form.answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL REFERENCES form.responses(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_number NUMERIC,
    answer_date DATE,
    answer_time TIME,
    answer_choices JSONB,
    answer_file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(response_id, question_id)
);

COMMENT ON TABLE form.answers IS 'Individual question answers - links responses to questions with answers';
COMMENT ON COLUMN form.answers.id IS 'Answer identifier (UUID)';
COMMENT ON COLUMN form.answers.response_id IS 'Parent response (foreign key)';
COMMENT ON COLUMN form.answers.question_id IS 'Question being answered (foreign key)';
COMMENT ON COLUMN form.answers.answer_text IS 'Text answer (for short_text, long_text, url, etc.)';
COMMENT ON COLUMN form.answers.answer_number IS 'Numeric answer (for number, rating, opinion_scale)';
COMMENT ON COLUMN form.answers.answer_date IS 'Date answer (for date questions)';
COMMENT ON COLUMN form.answers.answer_time IS 'Time answer (for time questions)';
COMMENT ON COLUMN form.answers.answer_choices IS 'Selected choices (for dropdown, checkboxes - JSON array)';
COMMENT ON COLUMN form.answers.answer_file_url IS 'Uploaded file URL (for file_upload questions)';

CREATE INDEX idx_answers_response_id ON form.answers(response_id);
CREATE INDEX idx_answers_question_id ON form.answers(question_id);

-- File uploads tracking
-- Tracks files uploaded via file_upload questions
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

COMMENT ON TABLE form.file_uploads IS 'Uploaded file metadata - tracks files submitted via file_upload questions';
COMMENT ON COLUMN form.file_uploads.id IS 'File upload record identifier (UUID)';
COMMENT ON COLUMN form.file_uploads.form_id IS 'Form containing the file upload question';
COMMENT ON COLUMN form.file_uploads.question_id IS 'File upload question that accepted this file';
COMMENT ON COLUMN form.file_uploads.response_id IS 'Response submission (null if uploaded before submission)';
COMMENT ON COLUMN form.file_uploads.filename IS 'Storage filename (UUID-based)';
COMMENT ON COLUMN form.file_uploads.original_filename IS 'Original user filename';
COMMENT ON COLUMN form.file_uploads.mime_type IS 'File MIME type (e.g., image/jpeg, application/pdf)';
COMMENT ON COLUMN form.file_uploads.file_size IS 'File size in bytes';
COMMENT ON COLUMN form.file_uploads.s3_key IS 'S3 object key for retrieval';
COMMENT ON COLUMN form.file_uploads.s3_url IS 'Full S3 URL (can be presigned)';
COMMENT ON COLUMN form.file_uploads.uploaded_by_user_id IS 'User who uploaded (for audit)';

CREATE INDEX idx_file_uploads_form_id ON form.file_uploads(form_id);
CREATE INDEX idx_file_uploads_response_id ON form.file_uploads(response_id);

-- Analytics (aggregated data)
-- Daily aggregated analytics for forms
CREATE TABLE form.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_views INTEGER NOT NULL DEFAULT 0,
    total_starts INTEGER NOT NULL DEFAULT 0,
    total_completions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(form_id, date)
);

COMMENT ON TABLE form.analytics IS 'Daily aggregated analytics - views, starts, completions per form per day';
COMMENT ON COLUMN form.analytics.id IS 'Analytics record identifier (UUID)';
COMMENT ON COLUMN form.analytics.form_id IS 'Form being analyzed (foreign key)';
COMMENT ON COLUMN form.analytics.date IS 'Date of aggregation (one record per form per day)';
COMMENT ON COLUMN form.analytics.total_views IS 'Number of times form was viewed';
COMMENT ON COLUMN form.analytics.total_starts IS 'Number of times form was started (first question viewed)';
COMMENT ON COLUMN form.analytics.total_completions IS 'Number of completed submissions';

CREATE INDEX idx_analytics_form_date ON form.analytics(form_id, date);

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
