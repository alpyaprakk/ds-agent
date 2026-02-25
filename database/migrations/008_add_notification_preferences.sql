-- Add notification_preferences column to users table
-- Stores a JSON object of notification type -> enabled/disabled
-- Example: {"workspace_invitation": true, "figma_synced": false}
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
