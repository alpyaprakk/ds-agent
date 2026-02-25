-- Migration: Add variable_collections table and update variables/components columns
-- This migration aligns the database with the sync handler expectations

-- ============================================================================
-- 1. Create variable_collections table
-- ============================================================================
CREATE TABLE IF NOT EXISTS variable_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  figma_file_id UUID REFERENCES figma_files(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  figma_key VARCHAR(255) UNIQUE,
  modes JSONB DEFAULT '[]',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variable_collections_workspace ON variable_collections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_variable_collections_file ON variable_collections(figma_file_id);
CREATE INDEX IF NOT EXISTS idx_variable_collections_key ON variable_collections(figma_key);

-- ============================================================================
-- 2. Update variables table - add missing columns
-- ============================================================================
ALTER TABLE variables ADD COLUMN IF NOT EXISTS figma_key VARCHAR(255);
ALTER TABLE variables ADD COLUMN IF NOT EXISTS collection_id VARCHAR(255);

-- Add unique constraint on figma_key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variables_figma_key_key'
  ) THEN
    ALTER TABLE variables ADD CONSTRAINT variables_figma_key_key UNIQUE (figma_key);
  END IF;
END $$;

-- Convert scopes from TEXT[] to JSONB if needed
DO $$
BEGIN
  -- Check if scopes column is TEXT[] type and convert to JSONB
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variables' AND column_name = 'scopes' AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE variables DROP COLUMN scopes;
    ALTER TABLE variables ADD COLUMN scopes JSONB DEFAULT '[]';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variables' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE variables ADD COLUMN scopes JSONB DEFAULT '[]';
  END IF;
END $$;

-- ============================================================================
-- 3. Update components table - add missing columns
-- ============================================================================
ALTER TABLE components ADD COLUMN IF NOT EXISTS figma_key VARCHAR(255);
ALTER TABLE components ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}';

-- Add unique constraint on figma_key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'components_figma_key_key'
  ) THEN
    ALTER TABLE components ADD CONSTRAINT components_figma_key_key UNIQUE (figma_key);
  END IF;
END $$;

-- ============================================================================
-- 4. Add trigger for variable_collections (skip if exists)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_variable_collections_updated_at'
  ) THEN
    CREATE TRIGGER update_variable_collections_updated_at BEFORE UPDATE ON variable_collections
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
