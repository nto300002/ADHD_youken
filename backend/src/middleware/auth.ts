import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT, JWTPayload } from '@/lib/jwt';
import type { Env } from '@/index';

// 認証済みユーザー情報を Context に追加
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

/**
 * JWT認証ミドルウェア
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const token = getCookie(c, 'token');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

/**
 * オプショナル認証ミドルウェア（認証されていなくてもOK）
 */
export async function optionalAuthMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const token = getCookie(c, 'token');

  if (token) {
    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      c.set('user', payload);
    } catch {
      // トークンが無効でも継続
    }
  }

  await next();
}
