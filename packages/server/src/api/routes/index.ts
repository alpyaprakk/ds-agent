import { Router } from 'express';
import express from 'express';
import path from 'path';
import authRouter from './auth';
import workspacesRouter from './workspaces';
import conflictsRouter from './conflicts';
import syncRouter from './sync';
import notificationsRouter from './notifications';
import chatRouter from './chat';
import agentConfigsRouter from './agent-configs';
import { getConnectedPluginsStatus } from '../../websocket/handlers';

const router = Router();

// Serve uploaded files (avatars etc.) at /api/uploads so Dokploy proxy handles it
router.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
router.use('/chat', chatRouter);
router.use('/agent-configs', agentConfigsRouter);

export default router;
