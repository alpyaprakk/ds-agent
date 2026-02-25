import { Router } from 'express';
import { ConflictRepository } from '../../db/repositories';
import { NotificationService } from '../../services/notification.service';

const router = Router();
const conflictRepo = new ConflictRepository();

// GET /api/workspaces/:workspaceId/conflicts - List conflicts
router.get('/:workspaceId/conflicts', async (req, res) => {
  try {
    const { status } = req.query;
    const conflicts = await conflictRepo.findAll(
      req.params.workspaceId,
      status as string | undefined
    );
    return res.json({ conflicts });
  } catch (error) {
    console.error('Error fetching conflicts:', error);
    return res.status(500).json({ error: 'Failed to fetch conflicts' });
  }
});

// GET /api/workspaces/:workspaceId/conflicts/summary - Get conflicts by severity
router.get('/:workspaceId/conflicts/summary', async (req, res) => {
  try {
    const summary = await conflictRepo.getActiveBySeverity(req.params.workspaceId);
    return res.json({ summary });
  } catch (error) {
    console.error('Error fetching conflict summary:', error);
    return res.status(500).json({ error: 'Failed to fetch conflict summary' });
  }
});

// POST /api/conflicts/:id/resolve - Resolve conflict
router.post('/:id/resolve', async (req, res) => {
  try {
    const { method, chosen, value, resolvedBy } = req.body;

    if (!method || !chosen || !resolvedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const conflict = await conflictRepo.resolve(
      req.params.id,
      method,
      chosen,
      value,
      resolvedBy
    );

    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }

    // Notify workspace members about resolution
    if (conflict.workspace_id) {
      NotificationService.notifyWorkspaceMembers({
        workspaceId: conflict.workspace_id,
        type: 'conflict_resolved',
        title: `Conflict resolved: ${conflict.entity_name || conflict.conflict_type}`,
        message: `Resolved by ${resolvedBy} using ${method}`,
      }).catch(err => console.error('Failed to create resolve notification:', err));
    }

    return res.json({ conflict });
  } catch (error) {
    console.error('Error resolving conflict:', error);
    return res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

// POST /api/conflicts/:id/dismiss - Dismiss conflict
router.post('/:id/dismiss', async (req, res) => {
  try {
    const { actor } = req.body;

    if (!actor) {
      return res.status(400).json({ error: 'Missing actor field' });
    }

    const conflict = await conflictRepo.dismiss(req.params.id, actor);

    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }

    return res.json({ conflict });
  } catch (error) {
    console.error('Error dismissing conflict:', error);
    return res.status(500).json({ error: 'Failed to dismiss conflict' });
  }
});

export default router;
