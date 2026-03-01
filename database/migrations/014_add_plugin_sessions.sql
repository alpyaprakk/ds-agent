-- Plugin auth sessions for browser-based login flow
CREATE TABLE IF NOT EXISTS plugin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(36) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  jwt_token TEXT,
  workspace_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_plugin_sessions_session_id ON plugin_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sessions_expires_at ON plugin_sessions(expires_at);
