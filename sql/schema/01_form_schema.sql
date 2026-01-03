-- ============================================================
-- Weladee Form - PostgreSQL Schema
-- Optimized, merged, idempotent
-- ============================================================

-- Schema & Extensions
CREATE SCHEMA IF NOT EXISTS form;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Utility Functions
-- ============================================================

CREATE OR REPLACE FUNCTION form.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Users
-- ============================================================

CREATE TABLE IF NOT EXISTS form.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weladee_user_id INTEGER NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE form.users IS 'Form system users linked to Weladee platform';

DROP TRIGGER IF EXISTS update_users_updated_at ON form.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON form.users
FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

-- ============================================================
-- Forms
-- ============================================================

CREATE TABLE IF NOT EXISTS form.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES form.users(id) ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL DEFAULT 'Untitled Form',
    description TEXT,
    slug VARCHAR(255) UNIQUE,

    theme VARCHAR(50) NOT NULL DEFAULT 'minimal'
        CHECK (theme IN (
            'minimal','midnight','ocean','sunset','forest',
            'lavender','weladee','aurora','cyberpunk','desert'
        )),

    is_published BOOLEAN NOT NULL DEFAULT false,
    is_accepting_responses BOOLEAN NOT NULL DEFAULT true,
    require_login BOOLEAN NOT NULL DEFAULT false,
    allow_multiple_submissions BOOLEAN NOT NULL DEFAULT false,
    show_progress_bar BOOLEAN NOT NULL DEFAULT true,
    force_captcha BOOLEAN NOT NULL DEFAULT false,

    custom_thank_you_message TEXT,
    redirect_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,

    -- analytics counters
    view_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_user_id ON form.forms(user_id);
CREATE INDEX IF NOT EXISTS idx_forms_is_published ON form.forms(is_published);

DROP TRIGGER IF EXISTS update_forms_updated_at ON form.forms;
CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON form.forms
FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

-- ============================================================
-- Questions
-- ============================================================

CREATE TABLE IF NOT EXISTS form.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL CHECK (type IN (
        'short_text','long_text','dropdown','checkboxes',
        'email','phone','number','date','rating',
        'opinion_scale','yes_no','file_upload','url'
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

CREATE INDEX IF NOT EXISTS idx_questions_form_order
ON form.questions(form_id, order_index);

DROP TRIGGER IF EXISTS update_questions_updated_at ON form.questions;
CREATE TRIGGER update_questions_updated_at
BEFORE UPDATE ON form.questions
FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

-- ============================================================
-- Responses
-- ============================================================

CREATE TABLE IF NOT EXISTS form.responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    respondent_user_id UUID REFERENCES form.users(id) ON DELETE SET NULL,

    respondent_email VARCHAR(255),
    respondent_name VARCHAR(255),

    completed BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ,

    -- analytics / tracking
    completion_time_seconds INTEGER,
    session_id VARCHAR(255),
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    country VARCHAR(2),
    city VARCHAR(255),
    referrer TEXT,
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_form_id ON form.responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON form.responses(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_device_type ON form.responses(device_type);
CREATE INDEX IF NOT EXISTS idx_responses_completion_time ON form.responses(completion_time_seconds);

DROP TRIGGER IF EXISTS update_responses_updated_at ON form.responses;
CREATE TRIGGER update_responses_updated_at
BEFORE UPDATE ON form.responses
FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

-- ============================================================
-- Answers
-- ============================================================

CREATE TABLE IF NOT EXISTS form.answers (
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

CREATE INDEX IF NOT EXISTS idx_answers_response_id ON form.answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON form.answers(question_id);

DROP TRIGGER IF EXISTS update_answers_updated_at ON form.answers;
CREATE TRIGGER update_answers_updated_at
BEFORE UPDATE ON form.answers
FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

-- ============================================================
-- File Uploads
-- ============================================================

CREATE TABLE IF NOT EXISTS form.file_uploads (
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

CREATE INDEX IF NOT EXISTS idx_file_uploads_form_id ON form.file_uploads(form_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_response_id ON form.file_uploads(response_id);

-- ============================================================
-- View & Interaction Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS form.form_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    user_id UUID REFERENCES form.users(id) ON DELETE SET NULL,

    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    country VARCHAR(2),
    city VARCHAR(255),

    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_views_form_id ON form.form_views(form_id);
CREATE INDEX IF NOT EXISTS idx_form_views_session_id ON form.form_views(session_id);
CREATE INDEX IF NOT EXISTS idx_form_views_viewed_at ON form.form_views(viewed_at DESC);

CREATE TABLE IF NOT EXISTS form.response_starts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form.question_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    response_id UUID REFERENCES form.responses(id) ON DELETE CASCADE,

    session_id VARCHAR(255),
    interaction_type VARCHAR(50),
    time_spent_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Aggregated Analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS form.daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form.forms(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,

    total_views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    total_starts INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,

    desktop_views INTEGER DEFAULT 0,
    mobile_views INTEGER DEFAULT 0,
    tablet_views INTEGER DEFAULT 0,
    avg_completion_time_seconds INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(form_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_form_date
ON form.daily_stats(form_id, stat_date DESC);

DROP TRIGGER IF EXISTS update_daily_stats_updated_at ON form.daily_stats;
CREATE TRIGGER update_daily_stats_updated_at
BEFORE UPDATE ON form.daily_stats
FOR EACH ROW EXECUTE FUNCTION form.update_updated_at_column();

CREATE TABLE IF NOT EXISTS form.question_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES form.questions(id) ON DELETE CASCADE,
    answer_value TEXT,
    response_count INTEGER DEFAULT 0,
    percentage DECIMAL(5,2),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, answer_value)
);

CREATE INDEX IF NOT EXISTS idx_question_stats_question_id
ON form.question_stats(question_id);
