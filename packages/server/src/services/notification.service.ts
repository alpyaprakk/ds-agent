import { NotificationRepository, NotificationType } from '../db/repositories/notification.repository';
import { getIO } from '../websocket/handlers';

export class NotificationService {
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

    // Broadcast via Socket.IO to the specific user
    const io = getIO();
    if (io) {
      io.emit('notification', {
        userId: data.userId,
        notification,
      });
    }

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

    // Broadcast via Socket.IO to each user
    const io = getIO();
    if (io) {
      for (const notification of notifications) {
        io.emit('notification', {
          userId: notification.user_id,
          notification,
        });
      }
    }

    return notifications;
  }
}
