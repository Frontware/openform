/**
 * Increment the total views for a form on a given date
 * @param {uuid} form_id - The ID of the form
 */
-- name: IncrementFormViews :exec
INSERT INTO form.analytics (form_id, date, total_views)
VALUES (@form_id::uuid, CURRENT_DATE, 1)
ON CONFLICT (form_id, date)
DO UPDATE SET total_views = form.analytics.total_views + 1;

/**
 * Increment the total starts for a form on a given date
 * @param {uuid} form_id - The ID of the form
 */
-- name: IncrementFormStarts :exec
INSERT INTO form.analytics (form_id, date, total_starts)
VALUES (@form_id::uuid, CURRENT_DATE, 1)
ON CONFLICT (form_id, date)
DO UPDATE SET total_starts = form.analytics.total_starts + 1;

/**
 * Increment the total completions for a form on a given date
 * @param {uuid} form_id - The ID of the form
 */
-- name: IncrementFormCompletions :exec
INSERT INTO form.analytics (form_id, date, total_completions)
VALUES (@form_id::uuid, CURRENT_DATE, 1)
ON CONFLICT (form_id, date)
DO UPDATE SET total_completions = form.analytics.total_completions + 1;
