import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { UserRepository } from '../../db/repositories/user-repository';
import { authMiddleware, generateToken, AuthRequest } from '../../middleware/auth';
import { NotificationService } from '../../services/notification.service';
import { PlanRepository } from '../../db/repositories/plan.repository';
import pool from '../../db/connection';

// ==========================================
// Rate Limiting Configuration
// ==========================================

// Strict rate limiting for auth endpoints (prevent brute force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

// Plugin session endpoints rate limiting (more lenient for polling)
const pluginSessionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute (allows polling every 2 seconds)
  message: 'Too many session requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Store avatar in memory, convert to base64 data URL and save to DB
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  },
});

const router = Router();

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user exists
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserRepository.create(email, passwordHash, name);

    // Create default settings
    await UserRepository.upsertSettings(user.id, { ai_provider: 'anthropic' });

    // Assign free plan
    await PlanRepository.assignFreePlan(user.id);

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserRepository.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// GET /api/auth/settings
router.get('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await UserRepository.getSettings(req.user!.id);

    // Mask sensitive keys
    const masked = settings ? {
      ai_provider: settings.ai_provider,
      has_anthropic_key: !!settings.anthropic_api_key,
      has_openai_key: !!settings.openai_api_key,
      has_figma_token: !!settings.figma_access_token,
      anthropic_api_key_preview: settings.anthropic_api_key
        ? settings.anthropic_api_key.slice(0, 10) + '...'
        : null,
      openai_api_key_preview: settings.openai_api_key
        ? settings.openai_api_key.slice(0, 10) + '...'
        : null,
      figma_access_token_preview: settings.figma_access_token
        ? settings.figma_access_token.slice(0, 10) + '...'
        : null,
      preferences: settings.preferences,
    } : null;

    res.json({ settings: masked });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /api/auth/settings
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { ai_provider, anthropic_api_key, openai_api_key, figma_access_token, preferences } = req.body;

    const settings = await UserRepository.upsertSettings(req.user!.id, {
      ai_provider,
      anthropic_api_key,
      openai_api_key,
      figma_access_token,
      preferences,
    });

    res.json({
      settings: {
        ai_provider: settings.ai_provider,
        has_anthropic_key: !!settings.anthropic_api_key,
        has_openai_key: !!settings.openai_api_key,
        has_figma_token: !!settings.figma_access_token,
        preferences: settings.preferences,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar } = req.body;
    const user = await UserRepository.update(req.user!.id, { name, avatar });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/avatar - Upload avatar image
router.post('/avatar', authMiddleware, (req: AuthRequest, res: Response) => {
  avatarUpload.single('avatar')(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File size must be under 5MB' });
          return;
        }
      }
      res.status(400).json({ error: err.message || 'Upload failed' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    try {
      const base64 = req.file.buffer.toString('base64');
      const avatarDataUrl = `data:${req.file.mimetype};base64,${base64}`;
      const user = await UserRepository.update(req.user!.id, { avatar: avatarDataUrl });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ error: 'Failed to update avatar' });
    }
  });
});

// ==========================================
// Invitations (user-level)
// ==========================================

// GET /api/auth/invitations - Get my pending invitations
router.get('/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserRepository.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const invitations = await UserRepository.getUserPendingInvitations(user.email);
    res.json({ invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// POST /api/auth/invitations/:token/accept
router.post('/invitations/:token/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const invitation = await UserRepository.acceptInvitation(req.params.token, req.user!.id);
    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found, expired, or already responded' });
      return;
    }

    // Notify the inviter that their invitation was accepted
    if (invitation.invited_by) {
      NotificationService.notify({
        userId: invitation.invited_by,
        workspaceId: invitation.workspace_id,
        type: 'invitation_accepted',
        title: `${req.user!.name} joined ${invitation.workspace_name || 'the workspace'}`,
        message: `Your invitation was accepted`,
        actorId: req.user!.id,
        referenceType: 'invitation',
        referenceId: invitation.id,
      }).catch(err => console.error('Failed to create accept notification:', err));
    }

    res.json({
      success: true,
      workspace_id: invitation.workspace_id,
      workspace_name: invitation.workspace_name,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// POST /api/auth/invitations/:token/reject
router.post('/invitations/:token/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get invitation details before rejecting
    const invitation = await UserRepository.getInvitationByToken(req.params.token);

    const rejected = await UserRepository.rejectInvitation(req.params.token);
    if (!rejected) {
      res.status(404).json({ error: 'Invitation not found or already responded' });
      return;
    }

    // Notify the inviter that their invitation was rejected
    if (invitation?.invited_by) {
      NotificationService.notify({
        userId: invitation.invited_by,
        workspaceId: invitation.workspace_id,
        type: 'invitation_rejected',
        title: `${req.user!.name} declined the invitation`,
        message: `Your invitation to ${invitation.workspace_name || 'the workspace'} was declined`,
        actorId: req.user!.id,
        referenceType: 'invitation',
        referenceId: invitation.id,
      }).catch(err => console.error('Failed to create reject notification:', err));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

// ==========================================
// Plugin Browser Auth (polling flow)
// ==========================================

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://ds-agent.alpy.io';

// POST /api/auth/plugin-session/start (public)
// Plugin calls this to start a browser-based auth session
router.post('/plugin-session/start', pluginSessionLimiter, async (req, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }

    await pool.query(
      `INSERT INTO plugin_sessions (session_id, status, expires_at)
       VALUES ($1, 'pending', NOW() + INTERVAL '5 minutes')
       ON CONFLICT (session_id) DO UPDATE SET status = 'pending', expires_at = NOW() + INTERVAL '5 minutes'`,
      [sessionId]
    );

    const loginUrl = `${DASHBOARD_URL}/plugin-auth?session=${sessionId}`;
    res.json({ sessionId, loginUrl });
  } catch (error) {
    console.error('Plugin session start error:', error);
    res.status(500).json({ error: 'Failed to start plugin session' });
  }
});

// POST /api/auth/plugin-session/complete (auth required)
// Dashboard calls this after user logs in to mark session as completed
router.post('/plugin-session/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, workspaceId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }

    // Check session exists and is not expired
    const sessionResult = await pool.query(
      `SELECT * FROM plugin_sessions WHERE session_id = $1 AND expires_at > NOW()`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      res.status(410).json({ error: 'Session expired or not found' });
      return;
    }

    // Generate a fresh token for the plugin
    const token = generateToken({ id: req.user!.id, email: req.user!.email, name: req.user!.name });

    await pool.query(
      `UPDATE plugin_sessions SET status = 'completed', user_id = $1, jwt_token = $2, workspace_id = $3
       WHERE session_id = $4`,
      [req.user!.id, token, workspaceId || null, sessionId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Plugin session complete error:', error);
    res.status(500).json({ error: 'Failed to complete plugin session' });
  }
});

// GET /api/auth/plugin-session/:sessionId/status (public)
// Plugin polls this until status === 'completed'
router.get('/plugin-session/:sessionId/status', pluginSessionLimiter, async (req, res: Response) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      `SELECT ps.status, ps.jwt_token, ps.workspace_id, ps.expires_at,
              u.id as user_id, u.email, u.name, u.avatar
       FROM plugin_sessions ps
       LEFT JOIN users u ON u.id = ps.user_id
       WHERE ps.session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const session = result.rows[0];

    // Check expiry
    if (new Date(session.expires_at) < new Date() && session.status === 'pending') {
      res.status(410).json({ error: 'Session expired' });
      return;
    }

    if (session.status === 'completed') {
      res.json({
        status: 'completed',
        token: session.jwt_token,
        workspaceId: session.workspace_id,
        user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          avatar: session.avatar,
        },
      });
    } else {
      res.json({ status: 'pending' });
    }
  } catch (error) {
    console.error('Plugin session status error:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

export default router;
