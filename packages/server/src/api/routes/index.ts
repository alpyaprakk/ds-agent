import { Router } from 'express';
import workspacesRouter from './workspaces';
import conflictsRouter from './conflicts';
import syncRouter from './sync';

const router = Router();

router.use('/workspaces', workspacesRouter);
router.use('/workspaces', conflictsRouter);
router.use('/conflicts', conflictsRouter);
router.use('/sync', syncRouter);

export default router;
