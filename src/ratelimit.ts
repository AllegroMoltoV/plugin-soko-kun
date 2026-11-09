// IP 単位の固定窓のレート制限。IP は SHA-256 で畳み、生の値を保存しない。
import type { Env } from './env';

export const LIMITS = {
  public: { perMinute: 120 },
  oauth: { perMinute: 20 },
} as const;

async function hashKey(scope: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isRateLimited(env: Env, request: Request, scope: keyof typeof LIMITS): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const windowStart = Math.floor(Date.now() / 60_000);
  const key = await hashKey(scope, ip);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limit (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) > LIMITS[scope].perMinute;
}

export function tooManyRequests(): Response {
  return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '60' } });
}
