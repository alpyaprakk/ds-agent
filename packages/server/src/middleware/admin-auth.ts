import { Response, NextFunction } from 'express';
import { verifyToken, AuthRequest } from './auth';
import { query } from '../db/connection';

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = verifyToken(token);
    req.user = user;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Check superadmin flag
  const result = await query('SELECT is_superadmin FROM users WHERE id = $1', [req.user!.id]);
  if (!result.rows[0]?.is_superadmin) {
    res.status(403).json({ error: 'Superadmin access required' });
    return;
  }

  next();
}
