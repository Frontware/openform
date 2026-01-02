-- name: CreateQuestion :one
INSERT INTO form.questions (
    form_id, type, label, description, placeholder,
    required, order_index, options, validation_rules, settings
)
VALUES (@form_id::uuid, @type::text, @label::text, @description::text, @placeholder::text, @required::boolean, @order_index::int, @options::jsonb, @validation_rules::jsonb, @settings::jsonb)
RETURNING *;

-- name: UpdateQuestion :one
UPDATE form.questions
SET
    type = COALESCE(@type::text, type),
    label = COALESCE(@label::text, label),
    description = COALESCE(@description::text, description),
    placeholder = COALESCE(@placeholder::text, placeholder),
    required = COALESCE(@required::boolean, required),
    order_index = COALESCE(@order_index::int, order_index),
    options = COALESCE(@options::jsonb, options),
    validation_rules = COALESCE(@validation_rules::jsonb, validation_rules),
    settings = COALESCE(@settings::jsonb, settings)
WHERE id = @id::uuid
RETURNING *;

-- name: DeleteQuestion :exec
DELETE FROM form.questions
WHERE id = @id::uuid;

-- name: ReorderQuestions :exec
UPDATE form.questions
SET order_index = @order_index::int
WHERE id = @id::uuid;
