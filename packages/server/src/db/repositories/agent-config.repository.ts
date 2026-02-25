import { query } from '../connection';

export interface AgentConfig {
  id: string;
  workspace_id: string;
  agent_type: 'design-system' | 'uiux';
  name: string;
  identity: string;       // short description, e.g. "Design System Agent"
  tone: string;           // e.g. "concise", "friendly", "technical"
  system_prompt: string;  // full system prompt override (if set, replaces default)
  capabilities: string[]; // e.g. ["create_component", "rename_variable"]
  context_rules: string;  // extra instructions injected into every prompt
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AgentConfigRepository {
  static async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        agent_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT '',
        identity TEXT NOT NULL DEFAULT '',
        tone VARCHAR(100) NOT NULL DEFAULT 'concise',
        system_prompt TEXT NOT NULL DEFAULT '',
        capabilities JSONB NOT NULL DEFAULT '[]',
        context_rules TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(workspace_id, agent_type)
      )
    `);
  }

  static async findByWorkspace(workspaceId: string): Promise<AgentConfig[]> {
    const result = await query(
      `SELECT * FROM agent_configs WHERE workspace_id = $1 ORDER BY agent_type`,
      [workspaceId]
    );
    return result.rows;
  }

  static async findOne(workspaceId: string, agentType: string): Promise<AgentConfig | null> {
    const result = await query(
      `SELECT * FROM agent_configs WHERE workspace_id = $1 AND agent_type = $2`,
      [workspaceId, agentType]
    );
    return result.rows[0] || null;
  }

  static async upsert(workspaceId: string, agentType: string, data: Partial<AgentConfig>): Promise<AgentConfig> {
    const result = await query(
      `INSERT INTO agent_configs (workspace_id, agent_type, name, identity, tone, system_prompt, capabilities, context_rules, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (workspace_id, agent_type) DO UPDATE SET
         name = EXCLUDED.name,
         identity = EXCLUDED.identity,
         tone = EXCLUDED.tone,
         system_prompt = EXCLUDED.system_prompt,
         capabilities = EXCLUDED.capabilities,
         context_rules = EXCLUDED.context_rules,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [
        workspaceId,
        agentType,
        data.name || '',
        data.identity || '',
        data.tone || 'concise',
        data.system_prompt || '',
        JSON.stringify(data.capabilities || []),
        data.context_rules || '',
        data.is_active !== false
      ]
    );
    return result.rows[0];
  }

  static async delete(workspaceId: string, agentType: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM agent_configs WHERE workspace_id = $1 AND agent_type = $2`,
      [workspaceId, agentType]
    );
    return (result.rowCount || 0) > 0;
  }
}
