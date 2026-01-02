-- Create form schema in Weladee database
CREATE SCHEMA IF NOT EXISTS form;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (references Weladee users)
CREATE TABLE form.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weladee_user_id INTEGER NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forms table
CREATE TABLE form.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES form.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL DEFAULT 'Untitled Form',
    description TEXT,
    theme VARCHAR(50) NOT NULL DEFAULT 'minimal' CHECK (theme IN ('minimal', 'midnight', 'ocean', 'sunset', 'forest', 'lavender')),
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_accepting_responses BOOLEAN NOT NULL DEFAULT true,
    require_login BOOLEAN NOT NULL DEFAULT false,
    allow_multiple_submissions BOOLEAN NOT NULL DEFAULT false,
    show_progress_bar BOOLEAN NOT NULL DEFAULT true,
    custom_thank_you_message TEXT,
    redirect_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forms_user_id ON form.forms(user_id);
CREATE INDEX idx_forms_is_published ON form.forms(is_published);

-- Questions table
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

CREATE INDEX idx_questions_form_id ON form.questions(form_id);
CREATE INDEX idx_questions_order ON form.questions(form_id, order_index);

-- Responses table
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

CREATE INDEX idx_responses_form_id ON form.responses(form_id);
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
    answer_choices JSONB,
    answer_file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(response_id, question_id)
);

CREATE INDEX idx_answers_response_id ON form.answers(response_id);
CREATE INDEX idx_answers_question_id ON form.answers(question_id);

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

-- Analytics (aggregated data)
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
