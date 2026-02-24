-- DS Agent Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- WORKSPACES
-- ============================================================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(10) DEFAULT '📦',
  color VARCHAR(7) DEFAULT '#3B82F6',

  -- Team info
  team_name VARCHAR(255),

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Stats
  total_components INTEGER DEFAULT 0,
  total_variables INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 0,
  last_audit TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workspaces_name ON workspaces(name);

-- ============================================================================
-- FIGMA FILES
-- ============================================================================

CREATE TABLE figma_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Figma info
  figma_key VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  url TEXT,

  -- Role and type
  role VARCHAR(50) NOT NULL DEFAULT 'primary', -- primary, secondary, reference
  type VARCHAR(50) DEFAULT 'design_system', -- design_system, pattern_library, icon_library

  -- Configuration
  config JSONB DEFAULT '{}',

  -- Sync info
  last_synced TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'pending', -- pending, syncing, success, error
  sync_error TEXT,

  -- Stats
  stats JSONB DEFAULT '{}',

  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_figma_files_workspace ON figma_files(workspace_id);
CREATE INDEX idx_figma_files_key ON figma_files(figma_key);
CREATE INDEX idx_figma_files_role ON figma_files(role);

-- ============================================================================
-- VARIABLES
-- ============================================================================

CREATE TABLE variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  figma_file_id UUID REFERENCES figma_files(id) ON DELETE CASCADE,

  -- Variable info
  figma_variable_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  collection VARCHAR(255),
  type VARCHAR(50), -- COLOR, FLOAT, STRING, BOOLEAN

  -- Value
  value JSONB NOT NULL,
  resolved_value JSONB, -- For aliases

  -- Alias
  is_alias BOOLEAN DEFAULT FALSE,
  alias_to UUID REFERENCES variables(id),

  -- Scopes
  scopes TEXT[], -- FILL, STROKE, TEXT, etc.

  -- Metadata
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variables_workspace ON variables(workspace_id);
CREATE INDEX idx_variables_file ON variables(figma_file_id);
CREATE INDEX idx_variables_name ON variables(name);
CREATE INDEX idx_variables_collection ON variables(collection);
CREATE INDEX idx_variables_is_alias ON variables(is_alias);

-- ============================================================================
-- COMPONENTS
-- ============================================================================

CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  figma_file_id UUID REFERENCES figma_files(id) ON DELETE CASCADE,

  -- Component info
  figma_node_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- COMPONENT, COMPONENT_SET

  -- Properties
  variant_count INTEGER DEFAULT 0,
  property_count INTEGER DEFAULT 0,

  -- Coverage
  variable_coverage DECIMAL(5,2) DEFAULT 0.00, -- Percentage
  has_auto_layout BOOLEAN DEFAULT FALSE,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_components_workspace ON components(workspace_id);
CREATE INDEX idx_components_file ON components(figma_file_id);
CREATE INDEX idx_components_name ON components(name);
CREATE INDEX idx_components_coverage ON components(variable_coverage);

-- ============================================================================
-- CONFLICTS
-- ============================================================================

CREATE TABLE conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Conflict classification
  conflict_type VARCHAR(50) NOT NULL, -- variable_mismatch, component_deleted, etc.
  severity VARCHAR(20) NOT NULL, -- low, medium, high
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, resolved, dismissed

  -- Entity info
  entity_type VARCHAR(50) NOT NULL, -- variable, component, style
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(255),

  -- Source 1 (usually Agent/Dashboard)
  source1_type VARCHAR(50), -- agent, dashboard, api
  source1_action VARCHAR(50), -- create, update, delete
  source1_value JSONB,
  source1_timestamp TIMESTAMP,

  -- Source 2 (usually Designer/Figma)
  source2_type VARCHAR(50), -- figma, designer
  source2_action VARCHAR(50),
  source2_value JSONB,
  source2_timestamp TIMESTAMP,

  -- Resolution
  resolution_method VARCHAR(50), -- auto, manual, timeout
  resolution_chosen VARCHAR(50), -- source1, source2, custom
  resolution_value JSONB,
  resolved_by VARCHAR(255), -- user_id or 'system'
  resolved_at TIMESTAMP,

  -- Metadata
  description TEXT,
  impact_score INTEGER DEFAULT 0, -- How many entities affected

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflicts_workspace ON conflicts(workspace_id);
CREATE INDEX idx_conflicts_status ON conflicts(status);
CREATE INDEX idx_conflicts_severity ON conflicts(severity);
CREATE INDEX idx_conflicts_entity ON conflicts(entity_type, entity_id);

-- ============================================================================
-- CONFLICT HISTORY
-- ============================================================================

CREATE TABLE conflict_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,

  action VARCHAR(50) NOT NULL, -- created, resolved, undone, dismissed
  actor VARCHAR(255), -- user_id or 'system'
  details JSONB,

  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflict_history_conflict ON conflict_history(conflict_id);

-- ============================================================================
-- CHANGE LOGS
-- ============================================================================

CREATE TABLE change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  figma_file_id UUID REFERENCES figma_files(id) ON DELETE CASCADE,

  -- Change info
  change_type VARCHAR(50) NOT NULL, -- created, updated, deleted
  entity_type VARCHAR(50) NOT NULL, -- variable, component, style
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(255),

  -- Before/After
  before_value JSONB,
  after_value JSONB,

  -- Source
  source VARCHAR(50) NOT NULL, -- figma, agent, dashboard, api
  source_user VARCHAR(255),

  -- Conflict tracking
  conflict_id UUID REFERENCES conflicts(id),
  was_reverted BOOLEAN DEFAULT FALSE,

  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_change_logs_workspace ON change_logs(workspace_id);
CREATE INDEX idx_change_logs_file ON change_logs(figma_file_id);
CREATE INDEX idx_change_logs_entity ON change_logs(entity_type, entity_id);
CREATE INDEX idx_change_logs_timestamp ON change_logs(timestamp DESC);

-- ============================================================================
-- SYNC HISTORY
-- ============================================================================

CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  figma_file_id UUID REFERENCES figma_files(id) ON DELETE CASCADE,

  sync_type VARCHAR(50) NOT NULL, -- full, incremental, manual
  status VARCHAR(50) NOT NULL, -- success, failed, partial

  -- Changes
  changes JSONB,
  errors JSONB,

  -- Timing
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration INTEGER, -- milliseconds

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_history_workspace ON sync_history(workspace_id);
CREATE INDEX idx_sync_history_file ON sync_history(figma_file_id);
CREATE INDEX idx_sync_history_started ON sync_history(started_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_figma_files_updated_at BEFORE UPDATE ON figma_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variables_updated_at BEFORE UPDATE ON variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conflicts_updated_at BEFORE UPDATE ON conflicts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Workspace Health View
CREATE OR REPLACE VIEW workspace_health AS
SELECT
  w.id,
  w.name,
  w.health_score,
  COUNT(DISTINCT f.id) as file_count,
  COUNT(DISTINCT v.id) as variable_count,
  COUNT(DISTINCT c.id) as component_count,
  COUNT(DISTINCT CASE WHEN con.status = 'active' THEN con.id END) as active_conflicts,
  AVG(c.variable_coverage) as avg_variable_coverage
FROM workspaces w
LEFT JOIN figma_files f ON f.workspace_id = w.id
LEFT JOIN variables v ON v.workspace_id = w.id
LEFT JOIN components c ON c.workspace_id = w.id
LEFT JOIN conflicts con ON con.workspace_id = w.id
GROUP BY w.id, w.name, w.health_score;

-- Recent Changes View
CREATE OR REPLACE VIEW recent_changes AS
SELECT
  cl.id,
  w.name as workspace_name,
  f.name as file_name,
  cl.change_type,
  cl.entity_type,
  cl.entity_name,
  cl.source,
  cl.timestamp
FROM change_logs cl
JOIN workspaces w ON w.id = cl.workspace_id
LEFT JOIN figma_files f ON f.id = cl.figma_file_id
ORDER BY cl.timestamp DESC
LIMIT 100;

-- Active Conflicts Summary
CREATE OR REPLACE VIEW active_conflicts_summary AS
SELECT
  w.id as workspace_id,
  w.name as workspace_name,
  c.severity,
  COUNT(*) as conflict_count
FROM conflicts c
JOIN workspaces w ON w.id = c.workspace_id
WHERE c.status = 'active'
GROUP BY w.id, w.name, c.severity;
