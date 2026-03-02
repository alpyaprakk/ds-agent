interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

export const SERVER_URL = process.env.TOKENHAUS_SERVER_URL ?? 'https://ds-agent.alpy.io';
const EMAIL    = process.env.TOKENHAUS_EMAIL    ?? '';
const PASSWORD = process.env.TOKENHAUS_PASSWORD ?? '';

// Debug: log env vars on startup
process.stderr.write(`[tokenhaus-auth] EMAIL=${EMAIL ? '***set***' : 'MISSING'}, PASSWORD=${PASSWORD ? '***set***' : 'MISSING'}\n`);

// ─── Browser-based polling authentication ────────────────────────────────────

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function pollForCompletion(sessionId: string, timeoutMs = 5 * 60 * 1000): Promise<string> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const statusRes = await fetch(`${SERVER_URL}/api/auth/plugin-session/${sessionId}/status`);

      if (statusRes.status === 410) {
        throw new Error('Login session expired. Please try again.');
      }

      if (statusRes.ok) {
        const data = await statusRes.json() as { status: string; token?: string };
        if (data.status === 'completed' && data.token) {
          return data.token;
        }
      }
    } catch (err) {
      // Network hiccup or session expired, keep polling unless expired
      if (err instanceof Error && err.message.includes('expired')) {
        throw err;
      }
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Login timed out. Please try again.');
}

async function openUrlInBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  try {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin': // macOS
        command = `open "${url}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${url}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${url}"`;
        break;
    }

    await execAsync(command);
  } catch (err) {
    // Silently fail - user can still manually open the URL
    process.stderr.write(`[tokenhaus-auth] ⚠️  Could not auto-open browser. Please open manually.\n`);
  }
}

async function loginWithBrowser(): Promise<string> {
  const sessionId = generateSessionId();

  // 1. Start session
  const startRes = await fetch(`${SERVER_URL}/api/auth/plugin-session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!startRes.ok) {
    throw new Error('Could not start login session');
  }

  const { loginUrl } = await startRes.json() as { loginUrl: string };

  // 2. Automatically open browser
  process.stderr.write(`\n┌─────────────────────────────────────────────────────────────────┐\n`);
  process.stderr.write(`│  🌐 Opening browser for authentication...                      │\n`);
  process.stderr.write(`│                                                                 │\n`);
  process.stderr.write(`│  If browser doesn't open automatically, visit:                 │\n`);
  process.stderr.write(`│  ${loginUrl.padEnd(61)}│\n`);
  process.stderr.write(`│                                                                 │\n`);
  process.stderr.write(`│  ⏳ Waiting for you to complete login...                        │\n`);
  process.stderr.write(`└─────────────────────────────────────────────────────────────────┘\n\n`);

  // Auto-open browser (non-blocking)
  await openUrlInBrowser(loginUrl);

  // 3. Poll for completion
  const token = await pollForCompletion(sessionId);

  process.stderr.write(`[tokenhaus-auth] ✅ Login successful via browser\n`);

  return token;
}

// ─── Main authentication function ─────────────────────────────────────────────

export async function getToken(): Promise<string> {
  // Refresh 10 minutes before expiry
  if (cache && Date.now() < cache.expiresAt - 10 * 60 * 1000) {
    return cache.token;
  }

  // Try browser-based auth first if no credentials provided
  if (!EMAIL || !PASSWORD) {
    try {
      const token = await loginWithBrowser();
      // JWT expires in 7 days
      cache = { token, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      return cache.token;
    } catch (err) {
      throw new Error(`Browser login failed: ${err instanceof Error ? err.message : 'unknown'}. You can also set TOKENHAUS_EMAIL and TOKENHAUS_PASSWORD environment variables.`);
    }
  }

  // Fallback to email/password auth
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Tokenhaus login failed (${res.status}): ${body.error ?? 'unknown'}`);
  }

  const data = await res.json() as { token: string };
  // JWT expires in 7 days
  cache = { token: data.token, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return cache.token;
}

export function clearTokenCache() {
  cache = null;
}
