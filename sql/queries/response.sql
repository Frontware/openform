-- name: GetResponseAnswers :many
SELECT
    a.id,
    a.response_id,
    a.question_id,
    a.answer_text,
    a.answer_number,
    a.answer_date,
    a.answer_time,
    a.answer_choices,
    a.answer_file_url,
    a.created_at,
    a.updated_at
FROM form.answers a
WHERE a.response_id = @response_id::uuid;

-- name: CompleteResponse :one
UPDATE form.responses
SET
    completed = true,
    submitted_at = NOW()
WHERE id = @id::uuid
RETURNING *;

-- name: CreateResponse :one
INSERT INTO form.responses (
    form_id, respondent_user_id, respondent_email, respondent_name,
    ip_address, user_agent, completed, submitted_at
)
VALUES (
    @form_id::uuid,
    CASE WHEN @respondent_user_id::uuid = '00000000-0000-0000-0000-000000000000'::uuid THEN NULL ELSE @respondent_user_id::uuid END,
    @respondent_email::text,
    @respondent_name::text,
    @ip_address::inet,
    @user_agent::text,
    @completed::boolean,
    COALESCE(@submitted_at::timestamptz, NOW())
)
RETURNING *;

-- name: GetResponse :one
SELECT * FROM form.responses
WHERE id = @id::uuid;

-- name: ListFormResponses :many
SELECT * FROM form.responses
WHERE form_id = @form_id::uuid
ORDER BY submitted_at DESC NULLS LAST, created_at DESC
LIMIT @limit_count::int OFFSET @offset_count::int;

-- name: DeleteResponse :exec
DELETE FROM form.responses
WHERE id = @id::uuid;

-- name: CreateAnswer :one
INSERT INTO form.answers (
    response_id, question_id, answer_text, answer_number,
    answer_date, answer_time, answer_choices, answer_file_url
)
VALUES (
    @response_id::uuid,
    @question_id::uuid,
    @answer_text::text,
    @answer_number::float8,
    CASE WHEN NULLIF(@answer_date::text, '') IS NULL THEN NULL ELSE @answer_date::date END,
    CASE WHEN NULLIF(@answer_time::text, '') IS NULL THEN NULL ELSE @answer_time::time END,
    @answer_choices::jsonb,
    @answer_file_url::text
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
    r.form_id,
    r.respondent_user_id,
    r.respondent_email,
    r.respondent_name,
    r.completed,
    r.submitted_at,
    r.created_at,
    a.id as answer_id,
    a.question_id,
    a.answer_text,
    a.answer_number,
    a.answer_date,
    a.answer_time,
    a.answer_choices,
    a.answer_file_url
FROM form.responses r
LEFT JOIN form.answers a ON r.id = a.response_id
WHERE r.form_id = @form_id::uuid AND r.completed = true
ORDER BY r.submitted_at DESC, a.question_id;

-- name: CountFormResponses :one
SELECT COUNT(*) as count
FROM form.responses
WHERE form_id = @form_id::uuid;
