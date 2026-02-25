import { Router } from 'express';
import { adminMiddleware } from '../../middleware/admin-auth';
import { AdminRepository } from '../../db/repositories/admin.repository';
import { PlanRepository } from '../../db/repositories/plan.repository';
import adminAuthRouter from './admin-auth';

const router = Router();

// Public admin auth routes (no middleware)
router.use('/auth', adminAuthRouter);

// All routes below require superadmin
router.use(adminMiddleware as any);

// GET /api/admin/stats
router.get('/stats', async (_req, res) => {
  try {
    const stats = await AdminRepository.getStats();
    return res.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const result = await AdminRepository.getAllUsers(page, limit, search);
    return res.json(result);
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const user = await AdminRepository.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/admin/users/:id/suspend
router.post('/users/:id/suspend', async (req, res) => {
  try {
    await AdminRepository.suspendUser(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin suspend error:', error);
    return res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// POST /api/admin/users/:id/unsuspend
router.post('/users/:id/unsuspend', async (req, res) => {
  try {
    await AdminRepository.unsuspendUser(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin unsuspend error:', error);
    return res.status(500).json({ error: 'Failed to unsuspend user' });
  }
});

// POST /api/admin/users/:id/plan
router.post('/users/:id/plan', async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan required' });
    await PlanRepository.setUserPlan(req.params.id, plan);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Admin set plan error:', error);
    return res.status(400).json({ error: error.message || 'Failed to set plan' });
  }
});

// GET /api/admin/workspaces
router.get('/workspaces', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const result = await AdminRepository.getAllWorkspaces(page, limit, search);
    return res.json(result);
  } catch (error) {
    console.error('Admin workspaces error:', error);
    return res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// DELETE /api/admin/workspaces/:id
router.delete('/workspaces/:id', async (req, res) => {
  try {
    await AdminRepository.deleteWorkspace(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete workspace error:', error);
    return res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// POST /api/admin/workspaces/:id/transfer
router.post('/workspaces/:id/transfer', async (req, res) => {
  try {
    const { newOwnerId } = req.body;
    if (!newOwnerId) return res.status(400).json({ error: 'newOwnerId required' });
    await AdminRepository.transferOwnership(req.params.id, newOwnerId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin transfer error:', error);
    return res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

// GET /api/admin/plans
router.get('/plans', async (_req, res) => {
  try {
    const plans = await PlanRepository.getAllPlans();
    return res.json({ plans });
  } catch (error) {
    console.error('Admin plans error:', error);
    return res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// PUT /api/admin/plans/:id
router.put('/plans/:id', async (req, res) => {
  try {
    const plan = await PlanRepository.updatePlan(req.params.id, req.body);
    return res.json({ plan });
  } catch (error: any) {
    console.error('Admin update plan error:', error);
    return res.status(400).json({ error: error.message || 'Failed to update plan' });
  }
});

// GET /api/admin/agent-configs
router.get('/agent-configs', async (_req, res) => {
  try {
    const configs = await AdminRepository.getAllAgentConfigs();
    return res.json({ configs });
  } catch (error) {
    console.error('Admin agent-configs error:', error);
    return res.status(500).json({ error: 'Failed to fetch agent configs' });
  }
});

export default router;
