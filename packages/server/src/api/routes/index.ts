import { Router } from 'express';
import authRouter from './auth';
import workspacesRouter from './workspaces';
import conflictsRouter from './conflicts';
import syncRouter from './sync';
import notificationsRouter from './notifications';
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

// Auth routes (public: register, login; protected: me, settings, profile)
router.use('/auth', authRouter);

router.use('/workspaces', workspacesRouter);
router.use('/workspaces', conflictsRouter);
router.use('/conflicts', conflictsRouter);
router.use('/sync', syncRouter);
router.use('/notifications', notificationsRouter);

export default router;
