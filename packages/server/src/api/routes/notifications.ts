import { Router } from 'express';
import { NotificationRepository } from '../../db/repositories/notification.repository';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/notifications - Get user's notifications
router.get('/', async (req: AuthRequest, res) => {
  try {
    const rawLimit = parseInt(req.query.limit as string) || 50;
    const rawOffset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const offset = Math.max(rawOffset, 0);
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

// GET /api/notifications/preferences - Get notification preferences
router.get('/preferences', async (req: AuthRequest, res) => {
  try {
    const prefs = await NotificationRepository.getPreferences(req.user!.id);
    return res.json({ preferences: prefs });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/notifications/preferences - Update notification preferences
router.put('/preferences', async (req: AuthRequest, res) => {
  try {
    const prefs = req.body.preferences;
    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences format' });
    }
    const updated = await NotificationRepository.updatePreferences(req.user!.id, prefs);
    return res.json({ preferences: updated });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
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
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
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

// DELETE /api/notifications/read - Delete all read notifications (must be before /:id)
router.delete('/read', async (req: AuthRequest, res) => {
  try {
    const count = await NotificationRepository.deleteAllRead(req.user!.id);
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    return res.status(500).json({ error: 'Failed to delete read notifications' });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
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

export default router;
