import { Router } from 'express';
import { FigmaFileRepository } from '../../db/repositories';
import { SyncOrchestrator } from '../../sync/orchestrator';

const router = Router();
const figmaFileRepo = new FigmaFileRepository();
const syncOrchestrator = new SyncOrchestrator();

// POST /api/sync/figma - Receive changes from Figma plugin
router.post('/figma', async (req, res) => {
  try {
    const { workspace_id, file_id, changes, timestamp } = req.body;

    if (!workspace_id || !file_id || !changes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process changes through sync orchestrator
    const result = await syncOrchestrator.processFigmaChanges({
      workspace_id,
      file_id,
      changes,
      timestamp: timestamp || new Date().toISOString()
    });

    return res.json(result);
  } catch (error) {
    console.error('Error processing Figma sync:', error);
    return res.status(500).json({ error: 'Failed to process sync' });
  }
});

// POST /api/sync/files/:fileId - Manual sync trigger
router.post('/files/:fileId', async (req, res) => {
  try {
    const file = await figmaFileRepo.findById(req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update sync status
    await figmaFileRepo.updateSyncStatus(file.id, 'syncing');

    // TODO: Trigger sync with Figma API
    // For now, just update status back to success
    await figmaFileRepo.updateSyncStatus(file.id, 'success');

    return res.json({ success: true, message: 'Sync triggered' });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

export default router;
