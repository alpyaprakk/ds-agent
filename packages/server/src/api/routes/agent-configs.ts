import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AgentConfigRepository } from '../../db/repositories/agent-config.repository';
import { UserRepository } from '../../db/repositories';

const router = Router();
router.use(authMiddleware);

// GET /api/agent-configs/:workspaceId
router.get('/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const configs = await AgentConfigRepository.findByWorkspace(workspaceId);
    return res.json({ configs });
  } catch (error) {
    console.error('agent-configs GET error:', error);
    return res.status(500).json({ error: 'Failed to fetch agent configs' });
  }
});

// GET /api/agent-configs/:workspaceId/:agentType
router.get('/:workspaceId/:agentType', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, agentType } = req.params;
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const config = await AgentConfigRepository.findOne(workspaceId, agentType);
    if (!config) return res.status(404).json({ error: 'Agent config not found' });
    return res.json({ config });
  } catch (error) {
    console.error('agent-configs GET one error:', error);
    return res.status(500).json({ error: 'Failed to fetch agent config' });
  }
});

// PUT /api/agent-configs/:workspaceId/:agentType
router.put('/:workspaceId/:agentType', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, agentType } = req.params;
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const validTypes = ['design-system', 'uiux'];
    if (!validTypes.includes(agentType)) {
      return res.status(400).json({ error: `agentType must be one of: ${validTypes.join(', ')}` });
    }

    const config = await AgentConfigRepository.upsert(workspaceId, agentType, req.body);
    return res.json({ config });
  } catch (error) {
    console.error('agent-configs PUT error:', error);
    return res.status(500).json({ error: 'Failed to save agent config' });
  }
});

// DELETE /api/agent-configs/:workspaceId/:agentType
router.delete('/:workspaceId/:agentType', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, agentType } = req.params;
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    await AgentConfigRepository.delete(workspaceId, agentType);
    return res.json({ success: true });
  } catch (error) {
    console.error('agent-configs DELETE error:', error);
    return res.status(500).json({ error: 'Failed to delete agent config' });
  }
});

export default router;
