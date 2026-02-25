import { Router } from 'express';
import { NotificationRepository } from '../../db/repositories/notification.repository';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/notifications - Get user's notifications
router.get('/', async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === 'true';

    const data = await NotificationRepository.getByUser(req.user!.id, {
      limit,
      offset,
      unreadOnly,
    });

    return res.json(data);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const count = await NotificationRepository.getUnreadCount(req.user!.id);
    return res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// POST /api/notifications/:id/read - Mark as read
router.post('/:id/read', async (req: AuthRequest, res) => {
  try {
    const marked = await NotificationRepository.markAsRead(req.params.id, req.user!.id);
    if (!marked) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', async (req: AuthRequest, res) => {
  try {
    const count = await NotificationRepository.markAllAsRead(req.user!.id);
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Error marking all as read:', error);
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const deleted = await NotificationRepository.delete(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// DELETE /api/notifications/read - Delete all read notifications
router.delete('/read', async (req: AuthRequest, res) => {
  try {
    const count = await NotificationRepository.deleteAllRead(req.user!.id);
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    return res.status(500).json({ error: 'Failed to delete read notifications' });
  }
});

export default router;
