import { query } from '../connection';

export interface AgentConfig {
  id: string;
  workspace_id: string | null; // null = global default
  agent_type: 'design-system' | 'uiux';
  name: string;
  identity: string;
  tone: string;
  system_prompt: string;
  capabilities: string[];
  context_rules: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AgentConfigRepository {
  static async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
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
    // Allow workspace_id to be nullable for global defaults
    await query(`
      ALTER TABLE agent_configs ALTER COLUMN workspace_id DROP NOT NULL
    `).catch(() => {});
    // Fix NULL uniqueness: PostgreSQL treats NULLs as distinct in UNIQUE constraints.
    // Add a partial unique index so only one global (workspace_id IS NULL) record per agent_type exists.
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS agent_configs_global_unique
      ON agent_configs (agent_type)
      WHERE workspace_id IS NULL
    `).catch(() => {});
  }

  static async findByWorkspace(workspaceId: string): Promise<AgentConfig[]> {
    const result = await query(
      `SELECT * FROM agent_configs WHERE workspace_id = $1 ORDER BY agent_type`,
      [workspaceId]
    );
    return result.rows;
  }

  // Returns workspace-specific config, falls back to global default. Skips inactive configs.
  static async findOne(workspaceId: string, agentType: string): Promise<AgentConfig | null> {
    const result = await query(
      `SELECT * FROM agent_configs
       WHERE agent_type = $2
         AND (workspace_id = $1 OR workspace_id IS NULL)
         AND is_active = true
       ORDER BY workspace_id NULLS LAST
       LIMIT 1`,
      [workspaceId, agentType]
    );
    return result.rows[0] || null;
  }

  static async findGlobal(agentType: string): Promise<AgentConfig | null> {
    const result = await query(
      `SELECT * FROM agent_configs WHERE workspace_id IS NULL AND agent_type = $1`,
      [agentType]
    );
    return result.rows[0] || null;
  }

  static async upsertGlobal(agentType: string, data: Partial<AgentConfig>): Promise<AgentConfig> {
    // Use UPDATE first, then INSERT if no rows updated.
    // ON CONFLICT (workspace_id, agent_type) does not work reliably for NULL workspace_id
    // because PostgreSQL treats NULLs as distinct in standard unique constraints.
    // The partial index (agent_configs_global_unique) handles uniqueness at DB level,
    // but ON CONFLICT ON CONSTRAINT requires the index to be created before this runs.
    // Safest approach: try UPDATE, if nothing updated do INSERT.
    const updateResult = await query(
      `UPDATE agent_configs SET
         name = $2, identity = $3, tone = $4, system_prompt = $5,
         capabilities = $6, context_rules = $7, is_active = $8, updated_at = NOW()
       WHERE workspace_id IS NULL AND agent_type = $1
       RETURNING *`,
      [
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

    if (updateResult.rows.length > 0) {
      return updateResult.rows[0];
    }

    // No existing row — insert
    const insertResult = await query(
      `INSERT INTO agent_configs (workspace_id, agent_type, name, identity, tone, system_prompt, capabilities, context_rules, is_active)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
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
    return insertResult.rows[0];
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
