import { NotificationRepository, NotificationType, Notification } from '../db/repositories/notification.repository';
import { getIO } from '../websocket/handlers';

// Notification types eligible for grouping (repeated events within a time window)
const GROUPABLE_TYPES: NotificationType[] = [
  'figma_synced',
  'conflict_detected',
  'figma_file_added',
  'figma_file_removed',
];

export class NotificationService {
  private static emitToUser(userId: string, notification: Notification) {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        userId,
        notification,
      });
    }
  }

  static async notify(data: {
    userId: string;
    workspaceId?: string;
    type: NotificationType;
    title: string;
    message?: string;
    actorId?: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    // Check user preferences - skip if this type is disabled
    const prefs = await NotificationRepository.getPreferences(data.userId);
    if (prefs[data.type] === false) return null;

    // Try to group with a recent notification of the same type
    if (data.workspaceId && GROUPABLE_TYPES.includes(data.type)) {
      const recent = await NotificationRepository.findRecentForGrouping(
        data.userId,
        data.workspaceId,
        data.type,
      );
      if (recent) {
        const updated = await NotificationRepository.updateContent(
          recent.id,
          data.title,
          data.message || null,
        );
        this.emitToUser(data.userId, updated);
        return updated;
      }
    }

    const notification = await NotificationRepository.create({
      user_id: data.userId,
      workspace_id: data.workspaceId,
      type: data.type,
      title: data.title,
      message: data.message,
      actor_id: data.actorId,
      reference_type: data.referenceType,
      reference_id: data.referenceId,
    });

    this.emitToUser(data.userId, notification);
    return notification;
  }

  static async notifyWorkspaceMembers(data: {
    workspaceId: string;
    type: NotificationType;
    title: string;
    message?: string;
    actorId?: string;
    referenceType?: string;
    referenceId?: string;
    excludeUserId?: string;
  }) {
    const notifications = await NotificationRepository.createForWorkspaceMembers(
      data.workspaceId,
      {
        type: data.type,
        title: data.title,
        message: data.message,
        actor_id: data.actorId,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
      },
      data.excludeUserId
    );

    for (const notification of notifications) {
      this.emitToUser(notification.user_id, notification);
    }

    return notifications;
  }
}
