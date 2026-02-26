import 'dotenv/config';

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

export const SERVER_URL = process.env.TOKENHAUS_SERVER_URL ?? 'https://ds-agent.alpy.io';
const EMAIL    = process.env.TOKENHAUS_EMAIL    ?? '';
const PASSWORD = process.env.TOKENHAUS_PASSWORD ?? '';

export async function getToken(): Promise<string> {
  // Refresh 10 minutes before expiry
  if (cache && Date.now() < cache.expiresAt - 10 * 60 * 1000) {
    return cache.token;
  }

  if (!EMAIL || !PASSWORD) {
    throw new Error('TOKENHAUS_EMAIL and TOKENHAUS_PASSWORD must be set in environment');
  }

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
