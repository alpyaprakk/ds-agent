-- Add sort_order columns to preserve Figma ordering
-- Collections get sort_order based on their position in the Figma API response
-- Variables get sort_order based on their position in the collection's variableIds array

ALTER TABLE variable_collections ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE variables ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
