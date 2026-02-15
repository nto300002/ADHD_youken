import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Env } from '@/index';
import { env } from 'cloudflare:test';

// Octokitをモック化（インポート前に定義）
vi.mock('octokit', () => {
  const mockGitHubUser = {
    id: 12345678,
    login: 'testuser',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345678',
    name: 'Test User',
    email: 'test@example.com',
  };

  return {
    Octokit: class {
      constructor(options?: any) {}
      rest = {
        users: {
          getAuthenticated: vi.fn(async () => ({
            data: mockGitHubUser,
          })),
        },
      };
    },
  };
});

import { generateJWT, verifyJWT } from '@/lib/jwt';
import { Hono } from 'hono';
import { authRoutes } from '@/routes/auth';

describe('JWT生成・検証', () => {
  const secret = 'test_jwt_secret_key_minimum_32_chars_long';

  it('有効なユーザーIDとペイロードが与えられた場合、署名済みJWTトークンが返される', async () => {
    // Given: 有効なユーザーIDとペイロード
    const userId = 'user-123';
    const payload = {
      userId,
      login: 'testuser',
    };

    // When: JWT生成関数を呼び出す
    const token = await generateJWT(payload, secret);

    // Then: 署名済みJWTトークンが返される
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('トークンをデコードすると元のペイロードが取得できる', async () => {
    // Given: 生成されたJWTトークン
    const userId = 'user-123';
    const payload = {
      userId,
      login: 'testuser',
    };
    const token = await generateJWT(payload, secret);

    // When: トークンを検証・デコードする
    const decoded = await verifyJWT(token, secret);

    // Then: 元のペイロードが取得できる
    expect(decoded).toBeDefined();
    expect(decoded.userId).toBe(userId);
    expect(decoded.login).toBe('testuser');
  });

  it('有効期限が正しく設定されている', async () => {
    // Given: 生成されたJWTトークン
    const payload = {
      userId: 'user-123',
      login: 'testuser',
    };
    const token = await generateJWT(payload, secret, { expiresIn: '1h' });

    // When: トークンを検証・デコードする
    const decoded = await verifyJWT(token, secret);

    // Then: 有効期限が設定されている
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('改ざんされたトークンは検証に失敗する', async () => {
    // Given: 生成されたJWTトークンを改ざん
    const payload = {
      userId: 'user-123',
      login: 'testuser',
    };
    const token = await generateJWT(payload, secret);
    const tamperedToken = token.slice(0, -5) + 'xxxxx';

    // When/Then: 検証時にエラーが発生する
    await expect(verifyJWT(tamperedToken, secret)).rejects.toThrow();
  });

  it('期限切れのトークンは検証に失敗する', async () => {
    // Given: 既に期限切れのトークン
    const payload = {
      userId: 'user-123',
      login: 'testuser',
    };
    // 1秒で期限切れ
    const token = await generateJWT(payload, secret, { expiresIn: '1ms' });

    // 少し待つ
    await new Promise((resolve) => setTimeout(resolve, 10));

    // When/Then: 検証時にエラーが発生する
    await expect(verifyJWT(token, secret)).rejects.toThrow();
  });
});

describe('OAuth開始エンドポイント', () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route('/auth', authRoutes);
  });

  it('GET /auth/github にリクエストを送信すると、GitHub OAuth認証URLへリダイレクトされる', async () => {
    // When: /auth/github にGETリクエストを送信
    const res = await app.request('/auth/github', {
      method: 'GET',
    }, env);

    // Then: リダイレクトレスポンスが返される
    expect(res.status).toBe(302);

    const location = res.headers.get('Location');
    expect(location).toBeDefined();
    expect(location).toContain('https://github.com/login/oauth/authorize');
    expect(location).toContain('client_id=');
    expect(location).toContain('redirect_uri=');
    expect(location).toContain('scope=');
  });

  it('CSRFトークンがセッションに保存される', async () => {
    // When: /auth/github にGETリクエストを送信
    const res = await app.request('/auth/github', {
      method: 'GET',
    }, env);

    // Then: セッションIDがクッキーにセットされる
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('session_id=');
  });
});

describe('OAuthコールバック処理', () => {
  let app: Hono<{ Bindings: Env }>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route('/auth', authRoutes);

    // fetchをモック化
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = url.toString();

      // GitHub OAuth トークン交換
      if (urlString.includes('github.com/login/oauth/access_token')) {
        return new Response(
          JSON.stringify({
            access_token: 'mock_access_token',
            token_type: 'bearer',
            scope: 'read:user user:email',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return originalFetch(url);
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('GitHub OAuthコールバックでcodeパラメータが返された場合、ユーザー情報を保存してJWTトークンを発行する', async () => {
    // Given: セッションにCSRFトークンを保存
    const sessionId = 'test-session-id';
    const state = 'test-csrf-token';
    await env.KV.put(sessionId, JSON.stringify({ csrfToken: state }));

    // When: /auth/callback にコールバックリクエストを送信
    const res = await app.request(
      `/auth/callback?code=test_code&state=${state}`,
      {
        method: 'GET',
        headers: {
          Cookie: `session_id=${sessionId}`,
        },
      },
      env
    );

    // Then: フロントエンドにリダイレクトされる
    if (res.status !== 302) {
      const error = await res.json();
      console.error('Error response:', error);
    }
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain(env.FRONTEND_URL);

    // JWTトークンがクッキーにセットされる
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('token=');
  });

  it('stateパラメータが一致しない場合、認証が失敗する', async () => {
    // Given: セッションにCSRFトークンを保存
    const sessionId = 'test-session-id';
    const state = 'test-csrf-token';
    await env.KV.put(sessionId, JSON.stringify({ csrfToken: state }));

    // When: 異なるstateでコールバックリクエストを送信
    const res = await app.request(
      '/auth/callback?code=test_code&state=wrong_state',
      {
        method: 'GET',
        headers: {
          Cookie: `session_id=${sessionId}`,
        },
      },
      env
    );

    // Then: エラーが返される
    expect(res.status).toBe(400);
  });
});
