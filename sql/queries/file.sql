-- name: CreateFileUpload :one
INSERT INTO form.file_uploads (
    form_id, question_id, response_id, filename, original_filename,
    mime_type, file_size, s3_key, s3_url
) VALUES (
    @form_id::uuid, @question_id::uuid, @response_id::uuid, @filename::text, @original_filename::text,
    @mime_type::text, @file_size::bigint, @s3_key::text, @s3_url::text
)
RETURNING id;

-- name: GetFileUpload :one
SELECT * FROM form.file_uploads
WHERE id = @id::uuid;
