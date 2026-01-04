-- name: TrackFormView :one
INSERT INTO form.form_views (
    form_id, session_id, user_id, ip_address, user_agent,
    referrer, device_type, browser, os, country, city
) VALUES (
    @form_id::uuid, @session_id::varchar, @user_id::uuid, @ip_address::inet, @user_agent::text,
    @referrer::text, @device_type::varchar, @browser::varchar, @os::varchar, @country::varchar, @city::varchar
)
RETURNING *;

-- name: TrackResponseStart :one
INSERT INTO form.response_starts (
    form_id, session_id
) VALUES (
    @form_id::uuid, @session_id::varchar
)
RETURNING *;

-- name: TrackQuestionInteraction :one
INSERT INTO form.question_interactions (
    form_id, question_id, response_id, session_id,
    interaction_type, time_spent_seconds
) VALUES (
    @form_id::uuid, @question_id::uuid, @response_id::uuid, @session_id::varchar,
    @interaction_type::varchar, @time_spent_seconds::integer
)
RETURNING *;

-- name: GetFormOverviewStats :one
SELECT
    f.id,
    f.view_count,
    f.response_count,
    f.completion_count,
    COALESCE(
        ROUND(
            (f.completion_count::numeric / NULLIF(f.view_count, 0)::numeric) * 100, 
            2
        ), 
        0
    )::float8 as completion_rate,
    COALESCE(AVG(r.completion_time_seconds), 0)::int4 as avg_completion_time
FROM form.forms f
LEFT JOIN form.responses r ON f.id = r.form_id AND r.completed = true
WHERE f.id = @form_id::uuid
GROUP BY f.id;

-- name: GetResponseTrend :many
SELECT
    DATE(viewed_at) as date,
    COUNT(DISTINCT session_id)::int8 as unique_views,
    COUNT(*)::int8 as total_views
FROM form.form_views
WHERE form_id = @form_id::uuid
    AND viewed_at >= @start_date::timestamptz
    AND viewed_at <= @end_date::timestamptz
GROUP BY DATE(viewed_at)
ORDER BY date DESC;

-- name: GetResponseCompletionTrend :many
SELECT
    DATE(submitted_at) as date,
    COUNT(*)::int8 as completions
FROM form.responses
WHERE form_id = @form_id::uuid
    AND completed = true
    AND submitted_at >= @start_date::timestamptz
    AND submitted_at <= @end_date::timestamptz
GROUP BY DATE(submitted_at)
ORDER BY date DESC;

-- name: GetDeviceBreakdown :many
SELECT
    device_type,
    COUNT(*)::int8 as count,
    ROUND((COUNT(*)::numeric / SUM(COUNT(*)) OVER ()) * 100, 2)::float8 as percentage
FROM form.responses
WHERE form_id = @form_id::uuid
    AND device_type IS NOT NULL
GROUP BY device_type
ORDER BY count DESC;

-- name: GetCompletionFunnel :one
SELECT
    (SELECT COUNT(*) FROM form.form_views WHERE form_id = @form_id::uuid)::int8 as total_views,
    (SELECT COUNT(DISTINCT session_id) FROM form.form_views WHERE form_id = @form_id::uuid)::int8 as unique_views,
    (SELECT COUNT(*) FROM form.response_starts WHERE form_id = @form_id::uuid)::int8 as total_starts,
    (SELECT COUNT(*) FROM form.responses WHERE form_id = @form_id::uuid)::int8 as total_responses,
    (SELECT COUNT(*) FROM form.responses WHERE form_id = @form_id::uuid AND completed = true)::int8 as total_completions;

-- name: GetQuestionDropOff :many
SELECT
    q.id,
    q.label,
    q.order_index,
    COUNT(DISTINCT qi.session_id) FILTER (WHERE qi.interaction_type = 'viewed')::int8 as viewed_count,
    COUNT(DISTINCT qi.session_id) FILTER (WHERE qi.interaction_type = 'answered')::int8 as answered_count,
    COUNT(DISTINCT qi.session_id) FILTER (WHERE qi.interaction_type = 'abandoned')::int8 as abandoned_count,
    COALESCE(AVG(qi.time_spent_seconds) FILTER (WHERE qi.interaction_type = 'answered'), 0)::float8 as avg_time_spent
FROM form.questions q
LEFT JOIN form.question_interactions qi ON q.id = qi.question_id
WHERE q.form_id = @form_id::uuid
GROUP BY q.id, q.label, q.order_index
ORDER BY q.order_index;

-- name: GetQuestionAnalytics :many
SELECT
    q.id,
    q.type,
    q.label,
    q.required,
    COUNT(a.id)::int8 as response_count,
    CASE 
        WHEN q.type IN ('single_choice', 'multiple_choice', 'dropdown') THEN
            jsonb_agg(
                jsonb_build_object(
                    'value', a.answer_text,
                    'count', 1
                )
            )
        WHEN q.type = 'rating' THEN
            jsonb_agg(
                jsonb_build_object(
                    'rating', a.answer_number,
                    'count', 1
                )
            )
        ELSE NULL
    END as aggregated_data
FROM form.questions q
LEFT JOIN form.answers a ON q.id = a.question_id
WHERE q.form_id = @form_id::uuid
GROUP BY q.id, q.type, q.label, q.required
ORDER BY q.order_index;

-- name: GetChoiceQuestionStats :many
SELECT
    a.answer_text as choice,
    COUNT(*)::int8 as count,
    ROUND((COUNT(*)::numeric / (
        SELECT COUNT(*) 
        FROM form.answers 
        WHERE question_id = @question_id::uuid
    )::numeric) * 100, 2)::float8 as percentage
FROM form.answers a
WHERE a.question_id = @question_id::uuid
    AND a.answer_text IS NOT NULL
GROUP BY a.answer_text
ORDER BY count DESC;

-- name: GetRatingQuestionStats :many
SELECT
    a.answer_number as rating,
    COUNT(*)::int8 as count,
    ROUND((COUNT(*)::numeric / (
        SELECT COUNT(*) 
        FROM form.answers 
        WHERE question_id = @question_id::uuid
    )::numeric) * 100, 2)::float8 as percentage
FROM form.answers a
WHERE a.question_id = @question_id::uuid
    AND a.answer_number IS NOT NULL
GROUP BY a.answer_number
ORDER BY rating DESC;

-- name: GetNPSScore :one
SELECT
    COUNT(*) FILTER (WHERE a.answer_number >= 0 AND a.answer_number <= 6)::int8 as detractors,
    COUNT(*) FILTER (WHERE a.answer_number >= 7 AND a.answer_number <= 8)::int8 as passives,
    COUNT(*) FILTER (WHERE a.answer_number >= 9 AND a.answer_number <= 10)::int8 as promoters,
    COUNT(*)::int8 as total_responses,
    CASE 
        WHEN COUNT(*) > 0 THEN
            ROUND(
                ((COUNT(*) FILTER (WHERE a.answer_number >= 9 AND a.answer_number <= 10)::numeric / COUNT(*)::numeric) * 100) -
                ((COUNT(*) FILTER (WHERE a.answer_number >= 0 AND a.answer_number <= 6)::numeric / COUNT(*)::numeric) * 100),
                1
            )
        ELSE 0
    END::float8 as nps_score
FROM form.answers a
WHERE a.question_id = @question_id::uuid
    AND a.answer_number IS NOT NULL;

-- name: GetGeographicDistribution :many
SELECT
    country,
    city,
    COUNT(*)::int8 as count
FROM form.responses
WHERE form_id = @form_id::uuid
    AND country IS NOT NULL
GROUP BY country, city
ORDER BY count DESC
LIMIT 50;

-- name: GetHourlyDistribution :many
SELECT
    EXTRACT(HOUR FROM submitted_at)::int4 as hour,
    COUNT(*)::int8 as count
FROM form.responses
WHERE form_id = @form_id::uuid
    AND completed = true
    AND submitted_at >= @start_date::timestamptz
GROUP BY hour
ORDER BY hour;

-- name: GetDayOfWeekDistribution :many
SELECT
    EXTRACT(DOW FROM submitted_at)::int4 as day_of_week,
    COUNT(*)::int8 as count
FROM form.responses
WHERE form_id = @form_id::uuid
    AND completed = true
    AND submitted_at >= @start_date::timestamptz
GROUP BY day_of_week
ORDER BY day_of_week;

-- name: UpdateDailyStats :one
INSERT INTO form.daily_stats (
    form_id, stat_date, total_views, unique_views,
    total_starts, total_completions, desktop_views,
    mobile_views, tablet_views, avg_completion_time_seconds
) VALUES (
    @form_id::uuid, @stat_date::date, @total_views::integer, @unique_views::integer,
    @total_starts::integer, @total_completions::integer, @desktop_views::integer,
    @mobile_views::integer, @tablet_views::integer, @avg_completion_time_seconds::integer
)
ON CONFLICT (form_id, stat_date)
DO UPDATE SET
    total_views = EXCLUDED.total_views,
    unique_views = EXCLUDED.unique_views,
    total_starts = EXCLUDED.total_starts,
    total_completions = EXCLUDED.total_completions,
    desktop_views = EXCLUDED.desktop_views,
    mobile_views = EXCLUDED.mobile_views,
    tablet_views = EXCLUDED.tablet_views,
    avg_completion_time_seconds = EXCLUDED.avg_completion_time_seconds,
    updated_at = NOW()
RETURNING *;

-- name: GetDailyStatsRange :many
SELECT *
FROM form.daily_stats
WHERE form_id = @form_id::uuid
    AND stat_date >= @start_date::date
    AND stat_date <= @end_date::date
ORDER BY stat_date DESC;

-- name: IncrementFormViewCount :exec
UPDATE form.forms
SET view_count = view_count + 1
WHERE id = @form_id::uuid;

-- name: IncrementFormResponseCount :exec
UPDATE form.forms
SET response_count = response_count + 1
WHERE id = @form_id::uuid;

-- name: IncrementFormCompletionCount :exec
UPDATE form.forms
SET completion_count = completion_count + 1
WHERE id = @form_id::uuid;

-- name: GetViewStatsForDate :many
SELECT
    session_id,
    device_type,
    COUNT(*)::int8 as count
FROM form.form_views
WHERE form_id = @form_id::uuid
    AND viewed_at >= @start_date::timestamptz
    AND viewed_at < @end_date::timestamptz
GROUP BY session_id, device_type;

-- name: GetResponseStartsForDate :many
SELECT id, form_id, session_id
FROM form.response_starts
WHERE form_id = @form_id::uuid
    AND created_at >= @start_date::timestamptz
    AND created_at < @end_date::timestamptz;

-- name: GetCompletionStatsForDate :many
SELECT
    id,
    CASE
        WHEN submitted_at IS NOT NULL AND created_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (submitted_at - created_at))::integer
        ELSE NULL
    END as completion_time_seconds
FROM form.responses
WHERE form_id = @form_id::uuid
    AND completed = true
    AND submitted_at >= @start_date::timestamptz
    AND submitted_at < @end_date::timestamptz;