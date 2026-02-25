-- Migration: Add figma_id column to variable_collections
-- The Figma plugin sends collection.id (e.g., VariableCollectionId:123:456) and collection.key (a different hash).
-- Variables reference their collection via variableCollectionId which matches collection.id, NOT collection.key.
-- We need figma_id to correctly join variables to their collections.

-- Add figma_id column
ALTER TABLE variable_collections ADD COLUMN IF NOT EXISTS figma_id VARCHAR(255);

-- Create index for the join
CREATE INDEX IF NOT EXISTS idx_variable_collections_figma_id ON variable_collections(figma_id);

-- Unique constraint per workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variable_collections_workspace_figma_id_key'
  ) THEN
    ALTER TABLE variable_collections ADD CONSTRAINT variable_collections_workspace_figma_id_key UNIQUE (workspace_id, figma_id);
  END IF;
END $$;
