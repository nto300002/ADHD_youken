import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';
import { Octokit } from 'octokit';
import { generateJWT } from '@/lib/jwt';
import { encrypt, decrypt } from '@/lib/crypto';
import { getDB, users } from '@/db';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '@/middleware/auth';
import type { Env } from '@/index';

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /auth/github - OAuth開始
 */
authRoutes.get('/github', async (c) => {
  const sessionId = nanoid();
  const csrfToken = nanoid();

  // セッションをKVに保存
  await c.env.KV.put(
    sessionId,
    JSON.stringify({
      csrfToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10分
    }),
    { expirationTtl: 600 } // 10分
  );

  // セッションIDをクッキーにセット
  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600, // 10分
  });

  // GitHub OAuth URL
  const redirectUri = `${c.req.url.split('/auth')[0]}/auth/callback`;
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', csrfToken);

  return c.redirect(githubAuthUrl.toString());
});

/**
 * GET /auth/callback - OAuthコールバック
 */
authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const sessionId = getCookie(c, 'session_id');

  if (!code || !state || !sessionId) {
    return c.json({ error: 'Invalid callback parameters' }, 400);
  }

  // セッションを取得
  const sessionData = await c.env.KV.get(sessionId);
  if (!sessionData) {
    return c.json({ error: 'Session not found' }, 400);
  }

  const session = JSON.parse(sessionData);

  // CSRF検証
  if (session.csrfToken !== state) {
    return c.json({ error: 'CSRF token mismatch' }, 400);
  }

  try {
    // アクセストークンを取得
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: c.env.GITHUB_CLIENT_ID,
          client_secret: c.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return c.json({ error: 'Failed to get access token' }, 500);
    }

    // GitHub APIでユーザー情報を取得
    const octokit = new Octokit({ auth: accessToken });
    const { data: githubUser } = await octokit.rest.users.getAuthenticated();

    // アクセストークンを暗号化
    const encryptedToken = await encrypt(accessToken, c.env.ENCRYPTION_KEY);

    // ユーザー情報をDBに保存または更新
    const db = getDB(c.env.DB);
    const userId = nanoid();

    await db
      .insert(users)
      .values({
        id: userId,
        githubId: githubUser.id,
        login: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        accessToken: encryptedToken,
      })
      .onConflictDoUpdate({
        target: users.githubId,
        set: {
          login: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          accessToken: encryptedToken,
          updatedAt: new Date().toISOString(),
        },
      });

    // 保存されたユーザーを取得
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubUser.id))
      .limit(1);

    // JWTトークンを生成
    const token = await generateJWT(
      {
        userId: user.id,
        login: user.login,
      },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // トークンをクッキーにセット
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60, // 7日
    });

    // セッションをクリア
    await c.env.KV.delete(sessionId);

    // フロントエンドにリダイレクト
    return c.redirect(`${c.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

/**
 * POST /auth/logout - ログアウト
 */
authRoutes.post('/logout', async (c) => {
  setCookie(c, 'token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0,
  });

  return c.json({ success: true });
});

/**
 * GET /auth/me - 現在のユーザー情報
 */
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user'); // authMiddlewareで設定済み

  const db = getDB(c.env.DB);
  const [userData] = await db
    .select({
      id: users.id,
      login: users.login,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(userData);
});
