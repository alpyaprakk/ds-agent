import { getToken, clearTokenCache, SERVER_URL } from './auth.js';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // On 401 clear cache and retry once
  if (res.status === 401) {
    clearTokenCache();
    const token2 = await getToken();
    const res2 = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token2}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res2.ok) {
      const b = await res2.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`${method} ${path} failed (${res2.status}): ${JSON.stringify(b)}`);
    }
    return res2.json() as Promise<T>;
  }

  if (!res.ok) {
    const b = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(b)}`);
  }

  return res.json() as Promise<T>;
}

export const apiGet  = <T>(path: string)                => request<T>('GET',  path);
export const apiPost = <T>(path: string, body: unknown)  => request<T>('POST', path, body);
