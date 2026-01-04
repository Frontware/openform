-- name: CreateForm :one
INSERT INTO form.forms (
    user_id, title, description, theme, is_published,
    is_accepting_responses, require_login, allow_multiple_submissions,
    progress_bar_style, custom_thank_you_message, redirect_url, settings
)
VALUES (
    @user_id::uuid, @title::text, @description::text, @theme::text, @is_published::boolean,
    @is_accepting_responses::boolean, @require_login::boolean, @allow_multiple_submissions::boolean,
    @progress_bar_style::form.progress_bar_style, @custom_thank_you_message::text, @redirect_url::text, @settings::jsonb
)
RETURNING *;

-- name: GetForm :one
SELECT * FROM form.forms
WHERE id = @id::uuid;

-- name: GetFormBySlug :one
-- Try to look up by ID (if slug is a UUID) or by slug column
SELECT * FROM form.forms
WHERE @slug::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = @slug::uuid
   OR slug = @slug::text;

-- name: UpdateForm :one
UPDATE form.forms
SET
    title = COALESCE(@title::text, title),
    description = COALESCE(@description::text, description),
    theme = COALESCE(@theme::text, theme),
    is_published = COALESCE(@is_published::boolean, is_published),
    is_accepting_responses = COALESCE(@is_accepting_responses::boolean, is_accepting_responses),
    require_login = COALESCE(@require_login::boolean, require_login),
    allow_multiple_submissions = COALESCE(@allow_multiple_submissions::boolean, allow_multiple_submissions),
    progress_bar_style = COALESCE(@progress_bar_style::form.progress_bar_style, progress_bar_style),
    custom_thank_you_message = COALESCE(@custom_thank_you_message::text, custom_thank_you_message),
    redirect_url = COALESCE(@redirect_url::text, redirect_url),
    force_captcha = COALESCE(@force_captcha::boolean, force_captcha),
    settings = COALESCE(@settings::jsonb, settings)
WHERE id = @id::uuid AND user_id = @user_id::uuid
RETURNING *;

-- name: DeleteForm :exec
DELETE FROM form.forms
WHERE id = @id::uuid AND user_id = @user_id::uuid;

/**
 * Publish a form.
 *
 * Updates the form with the given id and user_id to be published.
 *
 * @param id The id of the form to publish.
 * @param user_id The id of the user who owns the form.
 * @return The updated form.
 */
-- name: PublishForm :one
UPDATE form.forms
SET is_published = true
WHERE id = @id::uuid AND user_id = @user_id::uuid
RETURNING *;

/**
 * List the forms owned by a user.
 *
 * @param user_id The id of the user who owns the forms.
 * @param status_filter The status of the forms to filter by.
 *   - 0: all forms
 *   - 1: all unpublished forms
 *   - 2: all published forms
 *   - 3: all unpublished forms
 * @param search_query The search query to filter the forms by.
 * @param limit_count The number of forms to return.
 * @param offset_count The offset of the forms to return.
 * @return The list of forms that match the filter criteria.
 */
-- name: ListUserForms :many
SELECT 
    f.*,
    COUNT(r.id)::bigint as response_count
FROM form.forms f
LEFT JOIN form.responses r ON f.id = r.form_id
WHERE f.user_id = @user_id::uuid
  AND (@status_filter::int = 0 OR
       (@status_filter::int = 1 AND f.is_published = false) OR
       (@status_filter::int = 2 AND f.is_published = true AND f.is_accepting_responses = true) OR
       (@status_filter::int = 3 AND f.is_published = true AND f.is_accepting_responses = false))
  AND (@search_query::text = '' OR f.title ILIKE '%' || @search_query::text || '%')
GROUP BY f.id
ORDER BY
  CASE WHEN @sort_by::text = 'title' AND @sort_order::text = 'asc' THEN f.title END ASC,
  CASE WHEN @sort_by::text = 'title' AND @sort_order::text = 'desc' THEN f.title END DESC,
  CASE WHEN @sort_by::text = 'created_at' AND @sort_order::text = 'asc' THEN f.created_at END ASC,
  CASE WHEN @sort_by::text = 'created_at' AND @sort_order::text = 'desc' THEN f.created_at END DESC,
  CASE WHEN @sort_by::text = 'updated_at' AND @sort_order::text = 'asc' THEN f.updated_at END ASC,
  CASE WHEN @sort_by::text = 'updated_at' AND @sort_order::text = 'desc' THEN f.updated_at END DESC,
  CASE WHEN @sort_by::text = 'response_count' AND @sort_order::text = 'asc' THEN COUNT(r.id) END ASC,
  CASE WHEN @sort_by::text = 'response_count' AND @sort_order::text = 'desc' THEN COUNT(r.id) END DESC,
  f.updated_at DESC
LIMIT @limit_count::int OFFSET @offset_count::int;

-- name: GetFormWithQuestions :one
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
    q.settings as question_settings,
    q.created_at as question_created_at,
    q.updated_at as question_updated_at
FROM form.forms f
LEFT JOIN form.questions q ON f.id = q.form_id
WHERE f.id = @id::uuid
ORDER BY q.order_index;

-- name: ListFormQuestions :many
SELECT * FROM form.questions
WHERE form_id = @form_id::uuid
ORDER BY order_index;

/**
 * Get the statistics for a form.
 *
 * Retrieves the total number of responses, number of completed responses,
 * and number of partial responses for a form.
 *
 * @param form_id The id of the form.
 * @return The statistics for the form.
 */
-- name: GetFormStats :one
SELECT
    COUNT(DISTINCT r.id) AS total_responses,
    COUNT(DISTINCT CASE WHEN r.completed = true THEN r.id END) AS completed_responses,
    COUNT(DISTINCT CASE WHEN r.completed = false THEN r.id END) AS partial_responses
FROM form.forms f
LEFT JOIN form.responses r ON f.id = r.form_id
WHERE f.id = @form_id::uuid
GROUP BY f.id;

-- name: GetQuestion :one
SELECT * FROM form.questions
WHERE id = @id::uuid;

-- name: CountUserForms :one
SELECT COUNT(*) as count
FROM form.forms
WHERE user_id = @user_id::uuid;
