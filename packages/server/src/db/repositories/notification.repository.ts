import { query } from '../connection';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id?: string;
  type: string;
  title: string;
  message?: string;
  actor_id?: string;
  reference_type?: string;
  reference_id?: string;
  read: boolean;
  created_at: string;
  // Joined fields
  actor_name?: string;
  actor_avatar?: string;
  workspace_name?: string;
  workspace_icon?: string;
}

export type NotificationType =
  | 'workspace_invitation'
  | 'invitation_accepted'
  | 'invitation_rejected'
  | 'member_removed'
  | 'role_changed'
  | 'figma_file_added'
  | 'figma_synced'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'figma_file_removed';

export class NotificationRepository {
  static async create(data: {
    user_id: string;
    workspace_id?: string;
    type: NotificationType;
    title: string;
    message?: string;
    actor_id?: string;
    reference_type?: string;
    reference_id?: string;
  }): Promise<Notification> {
    const result = await query(
      `INSERT INTO notifications (user_id, workspace_id, type, title, message, actor_id, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.user_id,
        data.workspace_id || null,
        data.type,
        data.title,
        data.message || null,
        data.actor_id || null,
        data.reference_type || null,
        data.reference_id || null,
      ]
    );
    return result.rows[0];
  }

  static async createForWorkspaceMembers(
    workspaceId: string,
    data: {
      type: NotificationType;
      title: string;
      message?: string;
      actor_id?: string;
      reference_type?: string;
      reference_id?: string;
    },
    excludeUserId?: string
  ): Promise<Notification[]> {
    const membersResult = await query(
      'SELECT user_id FROM workspace_members WHERE workspace_id = $1',
      [workspaceId]
    );

    const notifications: Notification[] = [];
    for (const member of membersResult.rows) {
      if (excludeUserId && member.user_id === excludeUserId) continue;
      const notification = await this.create({
        user_id: member.user_id,
        workspace_id: workspaceId,
        ...data,
      });
      notifications.push(notification);
    }
    return notifications;
  }

  static async getByUser(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: Notification[]; total: number; unread_count: number }> {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    const whereClause = unreadOnly
      ? 'WHERE n.user_id = $1 AND n.read = FALSE'
      : 'WHERE n.user_id = $1';

    const result = await query(
      `SELECT n.*,
              u.name as actor_name, u.avatar as actor_avatar,
              w.name as workspace_name, w.icon as workspace_icon
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       LEFT JOIN workspaces w ON w.id = n.workspace_id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE read = FALSE) as unread_count
       FROM notifications WHERE user_id = $1`,
      [userId]
    );

    return {
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      unread_count: parseInt(countResult.rows[0].unread_count),
    };
  }

  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async markAllAsRead(userId: string): Promise<number> {
    const result = await query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    return result.rowCount || 0;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  static async delete(notificationId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async deleteAllRead(userId: string): Promise<number> {
    const result = await query(
      'DELETE FROM notifications WHERE user_id = $1 AND read = TRUE',
      [userId]
    );
    return result.rowCount || 0;
  }
}
