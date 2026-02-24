export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  team_name?: string;
  settings?: Record<string, any>;
  total_components?: number;
  total_variables?: number;
  health_score?: number;
  last_audit?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface FigmaFile {
  id: string;
  workspace_id: string;
  figma_key: string;
  name: string;
  url?: string;
  role: 'primary' | 'secondary' | 'reference';
  type?: string;
  config?: Record<string, any>;
  last_synced?: Date;
  sync_status: 'pending' | 'syncing' | 'success' | 'error';
  sync_error?: string;
  stats?: Record<string, any>;
  added_at: Date;
  updated_at: Date;
}

export interface Variable {
  id: string;
  workspace_id: string;
  figma_file_id?: string;
  figma_variable_id?: string;
  name: string;
  collection?: string;
  type?: string;
  value: any;
  resolved_value?: any;
  is_alias: boolean;
  alias_to?: string;
  scopes?: string[];
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Component {
  id: string;
  workspace_id: string;
  figma_file_id?: string;
  figma_node_id?: string;
  name: string;
  type?: string;
  variant_count?: number;
  property_count?: number;
  variable_coverage?: number;
  has_auto_layout?: boolean;
  description?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Conflict {
  id: string;
  workspace_id: string;
  conflict_type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved' | 'dismissed';
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  source1_type?: string;
  source1_action?: string;
  source1_value?: any;
  source1_timestamp?: Date;
  source2_type?: string;
  source2_action?: string;
  source2_value?: any;
  source2_timestamp?: Date;
  resolution_method?: string;
  resolution_chosen?: string;
  resolution_value?: any;
  resolved_by?: string;
  resolved_at?: Date;
  description?: string;
  impact_score?: number;
  created_at: Date;
  updated_at: Date;
}

export interface ChangeLog {
  id: string;
  workspace_id: string;
  figma_file_id?: string;
  change_type: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  before_value?: any;
  after_value?: any;
  source: string;
  source_user?: string;
  conflict_id?: string;
  was_reverted?: boolean;
  timestamp: Date;
}
