import { Router } from 'express';
import workspacesRouter from './workspaces';
import conflictsRouter from './conflicts';
import syncRouter from './sync';
import { getConnectedPluginsStatus } from '../../websocket/handlers';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ds-agent-api'
  });
});

// Plugin status endpoint
router.get('/plugins/status', (_req, res) => {
  const status = getConnectedPluginsStatus();
  res.json({
    connected: status.count > 0,
    ...status
  });
});

router.use('/workspaces', workspacesRouter);
router.use('/workspaces', conflictsRouter);
router.use('/conflicts', conflictsRouter);
router.use('/sync', syncRouter);

export default router;
