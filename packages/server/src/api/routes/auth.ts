import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../../db/repositories/user-repository';
import { authMiddleware, generateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res: Response) => {
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
router.post('/login', async (req, res: Response) => {
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

export default router;
