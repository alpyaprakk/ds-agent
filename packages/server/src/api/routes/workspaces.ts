import { Router } from 'express';
import { WorkspaceRepository, FigmaFileRepository } from '../../db/repositories';

const router = Router();
const workspaceRepo = new WorkspaceRepository();
const figmaFileRepo = new FigmaFileRepository();

// GET /api/workspaces - List all workspaces
router.get('/', async (_req, res) => {
  try {
    const workspaces = await workspaceRepo.findAll();
    return res.json({ workspaces });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/workspaces/:id - Get workspace by ID
router.get('/:id', async (req, res) => {
  try {
    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ workspace });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// POST /api/workspaces - Create new workspace
router.post('/', async (req, res) => {
  try {
    const workspace = await workspaceRepo.create(req.body);
    return res.status(201).json({ workspace });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// PATCH /api/workspaces/:id - Update workspace
router.patch('/:id', async (req, res) => {
  try {
    const workspace = await workspaceRepo.update(req.params.id, req.body);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ workspace });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// DELETE /api/workspaces/:id - Delete workspace
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await workspaceRepo.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// GET /api/workspaces/:id/health - Get workspace health
router.get('/:id/health', async (req, res) => {
  try {
    const health = await workspaceRepo.getHealth(req.params.id);
    if (!health) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ health });
  } catch (error) {
    console.error('Error fetching workspace health:', error);
    return res.status(500).json({ error: 'Failed to fetch workspace health' });
  }
});

// GET /api/workspaces/:id/files - List workspace Figma files
router.get('/:id/files', async (req, res) => {
  try {
    const files = await figmaFileRepo.findAll(req.params.id);
    return res.json({ files });
  } catch (error) {
    console.error('Error fetching Figma files:', error);
    return res.status(500).json({ error: 'Failed to fetch Figma files' });
  }
});

// POST /api/workspaces/:id/files - Add Figma file to workspace
router.post('/:id/files', async (req, res) => {
  try {
    const file = await figmaFileRepo.create({
      ...req.body,
      workspace_id: req.params.id
    });
    return res.status(201).json({ file });
  } catch (error) {
    console.error('Error adding Figma file:', error);
    return res.status(500).json({ error: 'Failed to add Figma file' });
  }
});

// GET /api/workspaces/:id/settings - Get workspace settings
router.get('/:id/settings', async (req, res) => {
  try {
    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json(workspace.settings || {});
  } catch (error) {
    console.error('Error fetching workspace settings:', error);
    return res.status(500).json({ error: 'Failed to fetch workspace settings' });
  }
});

// PUT /api/workspaces/:id/settings - Update workspace settings
router.put('/:id/settings', async (req, res) => {
  try {
    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Merge new settings with existing settings
    const updatedSettings = {
      ...(workspace.settings || {}),
      ...req.body
    };

    const updated = await workspaceRepo.update(req.params.id, {
      settings: updatedSettings
    });

    return res.json(updated?.settings || {});
  } catch (error) {
    console.error('Error updating workspace settings:', error);
    return res.status(500).json({ error: 'Failed to update workspace settings' });
  }
});

export default router;
