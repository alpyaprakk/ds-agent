import { Router } from 'express';
import workspacesRouter from './workspaces';
import conflictsRouter from './conflicts';
import syncRouter from './sync';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ds-agent-api'
  });
});

router.use('/workspaces', workspacesRouter);
router.use('/workspaces', conflictsRouter);
router.use('/conflicts', conflictsRouter);
router.use('/sync', syncRouter);

export default router;
