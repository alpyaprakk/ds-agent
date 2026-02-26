import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { UserRepository } from '../../db/repositories';
import { emitToPlugin, getConnectedPluginsStatus } from '../../websocket/handlers';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/commands/execute
 *
 * Directly execute a plugin command without going through AI.
 * Used by the MCP server to push commands from Claude Desktop.
 *
 * Body: { workspaceId: string, command: { type: string, spec: unknown } }
 */
router.post('/execute', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, command } = req.body as {
      workspaceId: string;
      command: { type: string; spec: unknown };
    };

    if (!workspaceId || !command?.type) {
      return res.status(400).json({ error: 'workspaceId and command.type are required' });
    }

    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pluginStatus = getConnectedPluginsStatus();
    const commandId = randomUUID();

    if (pluginStatus.count > 0) {
      emitToPlugin('execute-command', { command, commandId });
      return res.json({ commandStatus: 'sent', commandId });
    }

    return res.json({ commandStatus: 'no_plugin', commandId });
  } catch (error: unknown) {
    console.error('Commands route error:', error);
    return res.status(500).json({ error: 'Failed to execute command' });
  }
});

export default router;
