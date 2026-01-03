-- Migration: Add new themes to forms table check constraint
-- Date: 2026-01-03

-- Drop existing constraint if it exists (name might vary, so we try standard name)
-- Note: In PostgreSQL, if the constraint name wasn't explicitly set, it might be auto-generated.
-- The schema definition used: theme VARCHAR(50) NOT NULL DEFAULT 'minimal' CHECK (theme IN (...))
-- This usually creates a constraint named forms_theme_check

ALTER TABLE form.forms DROP CONSTRAINT IF EXISTS forms_theme_check;

ALTER TABLE form.forms 
    ADD CONSTRAINT forms_theme_check 
    CHECK (theme IN (
        'minimal', 
        'midnight', 
        'ocean', 
        'sunset', 
        'forest', 
        'lavender', 
        'weladee', 
        'aurora', 
        'cyberpunk', 
        'desert'
    ));
