-- Monthly AI usage tracking per user
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL,  -- 'YYYY-MM'
  ai_messages_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period)
);
