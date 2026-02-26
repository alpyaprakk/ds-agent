import { query } from '../connection';

export class AdminRepository {
  static async getStats() {
    const period = new Date().toISOString().slice(0, 7);
    const [users, workspaces, proUsers, aiMessages] = await Promise.all([
      query(`SELECT COUNT(*) FROM users`),
      query(`SELECT COUNT(*) FROM workspaces`),
      query(`SELECT COUNT(*) FROM user_plans up JOIN plans p ON p.id = up.plan_id WHERE p.name != 'free' AND up.status = 'active'`),
      query(`SELECT COALESCE(SUM(ai_messages_used), 0) as total FROM usage_snapshots WHERE period = $1`, [period])
    ]);
    return {
      totalUsers: parseInt(users.rows[0].count),
      totalWorkspaces: parseInt(workspaces.rows[0].count),
      activeProUsers: parseInt(proUsers.rows[0].count),
      aiMessagesThisMonth: parseInt(aiMessages.rows[0].total)
    };
  }

  static async getAllUsers(page = 1, limit = 20, search = '') {
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;
    const result = await query(
      `SELECT u.id, u.email, u.name, u.avatar, u.is_superadmin, u.suspended_at, u.created_at,
              COALESCE(p.name, 'free') as plan_name,
              COALESCE(p.display_name, 'Free') as plan_display,
              COUNT(DISTINCT wm.workspace_id) FILTER (WHERE wm.role = 'owner') as owned_workspaces
       FROM users u
       LEFT JOIN user_plans up ON up.user_id = u.id AND up.status = 'active'
       LEFT JOIN plans p ON p.id = up.plan_id
       LEFT JOIN workspace_members wm ON wm.user_id = u.id
       WHERE ($1 = '' OR u.email ILIKE $2 OR u.name ILIKE $2)
       GROUP BY u.id, p.name, p.display_name
       ORDER BY u.created_at DESC
       LIMIT $3 OFFSET $4`,
      [search, searchParam, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM users WHERE ($1 = '' OR email ILIKE $2 OR name ILIKE $2)`,
      [search, searchParam]
    );

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  static async getUserById(id: string) {
    const result = await query(
      `SELECT u.*, COALESCE(p.name, 'free') as plan_name, COALESCE(p.display_name, 'Free') as plan_display,
              up.status as plan_status, up.valid_until,
              COUNT(DISTINCT wm.workspace_id) FILTER (WHERE wm.role = 'owner') as owned_workspaces,
              COALESCE(us.ai_messages_used, 0) as ai_messages_this_month
       FROM users u
       LEFT JOIN user_plans up ON up.user_id = u.id AND up.status = 'active'
       LEFT JOIN plans p ON p.id = up.plan_id
       LEFT JOIN workspace_members wm ON wm.user_id = u.id
       LEFT JOIN usage_snapshots us ON us.user_id = u.id AND us.period = $2
       WHERE u.id = $1
       GROUP BY u.id, p.name, p.display_name, up.status, up.valid_until, us.ai_messages_used`,
      [id, new Date().toISOString().slice(0, 7)]
    );
    return result.rows[0] || null;
  }

  static async suspendUser(userId: string) {
    await query(`UPDATE users SET suspended_at = NOW() WHERE id = $1`, [userId]);
  }

  static async unsuspendUser(userId: string) {
    await query(`UPDATE users SET suspended_at = NULL WHERE id = $1`, [userId]);
  }

  static async getAllWorkspaces(page = 1, limit = 20, search = '') {
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;
    const result = await query(
      `SELECT w.id, w.name, w.icon, w.color, w.health_score, w.created_at, w.updated_at,
              u.email as owner_email, u.name as owner_name,
              COUNT(DISTINCT wm.user_id) as member_count,
              COUNT(DISTINCT c.id) as component_count,
              COUNT(DISTINCT v.id) as variable_count,
              MAX(ff.last_synced) as last_synced
       FROM workspaces w
       LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
       LEFT JOIN users u ON u.id = wm.user_id AND wm.role = 'owner'
       LEFT JOIN components c ON c.workspace_id = w.id
       LEFT JOIN variables v ON v.workspace_id = w.id
       LEFT JOIN figma_files ff ON ff.workspace_id = w.id
       WHERE ($1 = '' OR w.name ILIKE $2 OR u.email ILIKE $2)
       GROUP BY w.id, u.email, u.name
       ORDER BY w.created_at DESC
       LIMIT $3 OFFSET $4`,
      [search, searchParam, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT w.id) FROM workspaces w
       LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.role = 'owner'
       LEFT JOIN users u ON u.id = wm.user_id
       WHERE ($1 = '' OR w.name ILIKE $2 OR u.email ILIKE $2)`,
      [search, searchParam]
    );

    return {
      workspaces: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  static async deleteWorkspace(workspaceId: string) {
    await query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
  }

  static async transferOwnership(workspaceId: string, newOwnerId: string) {
    // Demote current owner to admin, promote new owner
    await query(
      `UPDATE workspace_members SET role = 'admin' WHERE workspace_id = $1 AND role = 'owner'`,
      [workspaceId]
    );
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`,
      [workspaceId, newOwnerId]
    );
  }

  static async getUserWorkspaces(userId: string) {
    const result = await query(
      `SELECT w.id, w.name, w.icon, w.color, w.health_score, wm.role,
              COUNT(DISTINCT wm2.user_id) as member_count,
              COUNT(DISTINCT c.id) as component_count,
              COUNT(DISTINCT v.id) as variable_count
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
       LEFT JOIN workspace_members wm2 ON wm2.workspace_id = w.id
       LEFT JOIN components c ON c.workspace_id = w.id
       LEFT JOIN variables v ON v.workspace_id = w.id
       GROUP BY w.id, wm.role
       ORDER BY wm.role = 'owner' DESC, w.name`,
      [userId]
    );
    return result.rows;
  }

  static async getAllAgentConfigs() {
    const result = await query(
      `SELECT ac.*, COALESCE(w.name, 'Global Default') as workspace_name
       FROM agent_configs ac
       LEFT JOIN workspaces w ON w.id = ac.workspace_id
       ORDER BY ac.workspace_id NULLS FIRST, w.name, ac.agent_type`
    );
    return result.rows;
  }
}
