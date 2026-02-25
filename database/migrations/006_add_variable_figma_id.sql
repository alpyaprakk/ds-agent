-- Migration: Add figma_id column to variables table
-- Alias references in valuesByMode use the variable's Figma ID (e.g., VariableID:38:1009),
-- but we only store the variable's key. We need figma_id to resolve alias references.

ALTER TABLE variables ADD COLUMN IF NOT EXISTS figma_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_variables_figma_id ON variables(figma_id);
