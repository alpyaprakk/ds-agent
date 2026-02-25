import { query } from '../connection';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  ai_provider: string;
  anthropic_api_key?: string;
  openai_api_key?: string;
  figma_access_token?: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(email: string, passwordHash: string, name: string): Promise<User> {
    const result = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [email, passwordHash, name]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<Pick<User, 'name' | 'avatar'>>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.avatar !== undefined) {
      fields.push(`avatar = $${paramIndex++}`);
      values.push(data.avatar);
    }

    values.push(id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // User Settings
  static async getSettings(userId: string): Promise<UserSettings | null> {
    const result = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  static async upsertSettings(userId: string, data: Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<UserSettings> {
    const result = await query(
      `INSERT INTO user_settings (user_id, ai_provider, anthropic_api_key, openai_api_key, figma_access_token, preferences)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         ai_provider = COALESCE($2, user_settings.ai_provider),
         anthropic_api_key = COALESCE($3, user_settings.anthropic_api_key),
         openai_api_key = COALESCE($4, user_settings.openai_api_key),
         figma_access_token = COALESCE($5, user_settings.figma_access_token),
         preferences = COALESCE($6, user_settings.preferences)
       RETURNING *`,
      [
        userId,
        data.ai_provider || 'anthropic',
        data.anthropic_api_key || null,
        data.openai_api_key || null,
        data.figma_access_token || null,
        JSON.stringify(data.preferences || {}),
      ]
    );
    return result.rows[0];
  }

  // Workspace membership
  static async getWorkspacesByUser(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT w.*, wm.role as member_role
       FROM workspaces w
       INNER JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async addToWorkspace(userId: string, workspaceId: string, role: string = 'member'): Promise<void> {
    await query(
      'INSERT INTO workspace_members (user_id, workspace_id, role) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, user_id) DO NOTHING',
      [userId, workspaceId, role]
    );
  }

  static async isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );
    return result.rows.length > 0;
  }
}
