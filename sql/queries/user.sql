-- name: CreateFormUser :one
INSERT INTO form.users (weladee_user_id, email, full_name, avatar_url, timezone)
VALUES (@weladee_user_id::int, @email::text, @full_name::text, @avatar_url::text, @timezone::text)
ON CONFLICT (weladee_user_id) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    timezone = COALESCE(EXCLUDED.timezone, form.users.timezone),
    updated_at = NOW()
RETURNING *;

-- name: GetFormUserByWeladeeID :one
SELECT * FROM form.users
WHERE weladee_user_id = @weladee_user_id::int;

-- name: GetFormUser :one
SELECT * FROM form.users
WHERE id = @id::uuid;
