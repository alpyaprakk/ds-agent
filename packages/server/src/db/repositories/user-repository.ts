import { query } from '../connection';
import { randomUUID } from 'crypto';

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

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  created_at: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  invited_by: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
  responded_at?: string;
  workspace_name?: string;
  workspace_icon?: string;
  inviter_name?: string;
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

  // ==========================================
  // Workspace membership
  // ==========================================

  static async getWorkspacesByUser(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT w.*, wm.role as member_role,
         (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id) as member_count
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

  static async getMemberRole(userId: string, workspaceId: string): Promise<string | null> {
    const result = await query(
      'SELECT role FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );
    return result.rows[0]?.role || null;
  }

  static async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const result = await query(
      `SELECT wm.id, wm.user_id, wm.workspace_id, wm.role, wm.created_at,
              u.email, u.name, u.avatar
       FROM workspace_members wm
       INNER JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY
         CASE wm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
         wm.created_at ASC`,
      [workspaceId]
    );
    return result.rows;
  }

  static async updateMemberRole(userId: string, workspaceId: string, role: string): Promise<void> {
    await query(
      'UPDATE workspace_members SET role = $1 WHERE user_id = $2 AND workspace_id = $3',
      [role, userId, workspaceId]
    );
  }

  static async removeFromWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ==========================================
  // Invitations
  // ==========================================

  static async createInvitation(
    workspaceId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<WorkspaceInvitation> {
    const token = randomUUID();
    const result = await query(
      `INSERT INTO workspace_invitations (workspace_id, invited_by, email, role, token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, email) DO UPDATE SET
         role = EXCLUDED.role,
         status = 'pending',
         token = EXCLUDED.token,
         invited_by = EXCLUDED.invited_by,
         created_at = NOW(),
         expires_at = NOW() + INTERVAL '7 days',
         responded_at = NULL
       RETURNING *`,
      [workspaceId, invitedBy, email.toLowerCase(), role, token]
    );
    return result.rows[0];
  }

  static async getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const result = await query(
      `SELECT wi.*, u.name as inviter_name
       FROM workspace_invitations wi
       LEFT JOIN users u ON u.id = wi.invited_by
       WHERE wi.workspace_id = $1 AND wi.status = 'pending' AND wi.expires_at > NOW()
       ORDER BY wi.created_at DESC`,
      [workspaceId]
    );
    return result.rows;
  }

  static async getUserPendingInvitations(email: string): Promise<WorkspaceInvitation[]> {
    const result = await query(
      `SELECT wi.*, w.name as workspace_name, w.icon as workspace_icon, u.name as inviter_name
       FROM workspace_invitations wi
       INNER JOIN workspaces w ON w.id = wi.workspace_id
       LEFT JOIN users u ON u.id = wi.invited_by
       WHERE wi.email = $1 AND wi.status = 'pending' AND wi.expires_at > NOW()
       ORDER BY wi.created_at DESC`,
      [email.toLowerCase()]
    );
    return result.rows;
  }

  static async getInvitationByToken(token: string): Promise<WorkspaceInvitation | null> {
    const result = await query(
      `SELECT wi.*, w.name as workspace_name, w.icon as workspace_icon, u.name as inviter_name
       FROM workspace_invitations wi
       INNER JOIN workspaces w ON w.id = wi.workspace_id
       LEFT JOIN users u ON u.id = wi.invited_by
       WHERE wi.token = $1`,
      [token]
    );
    return result.rows[0] || null;
  }

  static async acceptInvitation(token: string, userId: string): Promise<WorkspaceInvitation | null> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation) return null;
    if (invitation.status !== 'pending') return null;
    if (new Date(invitation.expires_at) < new Date()) return null;

    await query(
      `UPDATE workspace_invitations SET status = 'accepted', responded_at = NOW() WHERE token = $1`,
      [token]
    );

    await this.addToWorkspace(userId, invitation.workspace_id, invitation.role);

    return invitation;
  }

  static async rejectInvitation(token: string): Promise<boolean> {
    const result = await query(
      `UPDATE workspace_invitations SET status = 'rejected', responded_at = NOW()
       WHERE token = $1 AND status = 'pending'`,
      [token]
    );
    return (result.rowCount || 0) > 0;
  }

  static async cancelInvitation(invitationId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM workspace_invitations WHERE id = $1 AND status = 'pending'`,
      [invitationId]
    );
    return (result.rowCount || 0) > 0;
  }
}
