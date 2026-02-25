-- Migration: Change globally unique constraints to workspace-scoped
-- This allows different workspaces to track the same Figma files/variables/components independently

-- ============================================================================
-- 1. figma_files: figma_key → (workspace_id, figma_key)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'figma_files_figma_key_key'
  ) THEN
    ALTER TABLE figma_files DROP CONSTRAINT figma_files_figma_key_key;
  END IF;
END $$;

-- Add composite unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'figma_files_workspace_figma_key_key'
  ) THEN
    ALTER TABLE figma_files ADD CONSTRAINT figma_files_workspace_figma_key_key UNIQUE (workspace_id, figma_key);
  END IF;
END $$;

-- ============================================================================
-- 2. variable_collections: figma_key → (workspace_id, figma_key)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variable_collections_figma_key_key'
  ) THEN
    ALTER TABLE variable_collections DROP CONSTRAINT variable_collections_figma_key_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variable_collections_workspace_figma_key_key'
  ) THEN
    ALTER TABLE variable_collections ADD CONSTRAINT variable_collections_workspace_figma_key_key UNIQUE (workspace_id, figma_key);
  END IF;
END $$;

-- ============================================================================
-- 3. variables: figma_key → (workspace_id, figma_key)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variables_figma_key_key'
  ) THEN
    ALTER TABLE variables DROP CONSTRAINT variables_figma_key_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variables_workspace_figma_key_key'
  ) THEN
    ALTER TABLE variables ADD CONSTRAINT variables_workspace_figma_key_key UNIQUE (workspace_id, figma_key);
  END IF;
END $$;

-- ============================================================================
-- 4. components: figma_key → (workspace_id, figma_key)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'components_figma_key_key'
  ) THEN
    ALTER TABLE components DROP CONSTRAINT components_figma_key_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'components_workspace_figma_key_key'
  ) THEN
    ALTER TABLE components ADD CONSTRAINT components_workspace_figma_key_key UNIQUE (workspace_id, figma_key);
  END IF;
END $$;
