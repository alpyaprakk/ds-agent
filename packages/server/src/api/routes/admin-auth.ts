import { Router, Request, Response } from 'express';
import { query } from '../../db/connection';
import { generateToken, verifyToken, AuthRequest } from '../../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// POST /api/admin/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await query(
      `SELECT id, email, name, password_hash, is_superadmin, suspended_at FROM users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_superadmin) return res.status(403).json({ error: 'Superadmin access required' });
    if (user.suspended_at) return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({ id: user.id, email: user.email, name: user.name });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/admin/auth/me
router.get('/me', async (req: AuthRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required' });
  try {
    const user = verifyToken(authHeader.split(' ')[1]);
    const result = await query(
      `SELECT id, email, name, is_superadmin FROM users WHERE id = $1`,
      [user.id]
    );
    if (!result.rows[0]?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    return res.json({ user: result.rows[0] });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/admin/auth/bootstrap
// One-time endpoint: sets first superadmin using BOOTSTRAP_SECRET env var.
// Disabled once any superadmin exists.
router.post('/bootstrap', async (req: Request, res: Response) => {
  try {
    const { email, secret } = req.body;
    if (!email || !secret) {
      return res.status(400).json({ error: 'email and secret required' });
    }

    const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
    if (!bootstrapSecret) {
      return res.status(503).json({ error: 'BOOTSTRAP_SECRET not configured' });
    }
    if (secret !== bootstrapSecret) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    // Disallow if a superadmin already exists
    const existing = await query('SELECT id FROM users WHERE is_superadmin = true LIMIT 1');
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A superadmin already exists. Bootstrap is disabled.' });
    }

    const result = await query(
      `UPDATE users SET is_superadmin = true WHERE email = $1 RETURNING id, email, name`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found with that email' });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return res.status(500).json({ error: 'Bootstrap failed' });
  }
});

export default router;
