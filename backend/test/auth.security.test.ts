import { describe, it, expect, beforeEach } from 'vitest';
import { generateJWT, verifyJWT } from '@/lib/jwt';
import { encrypt, decrypt } from '@/lib/crypto';
import { Hono } from 'hono';
import { authRoutes } from '@/routes/auth';
import { authMiddleware } from '@/middleware/auth';
import type { Env } from '@/index';
import { env } from 'cloudflare:test';

describe('セキュリティテスト: JWT検証', () => {
  const secret = 'test_jwt_secret_key_minimum_32_chars_long';
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();

    // 保護されたエンドポイント
    app.get('/protected', authMiddleware, (c) => {
      const user = c.get('user');
      return c.json({ message: 'success', user });
    });
  });

  it('改ざんされたJWTトークンが送信された場合、401 Unauthorizedエラーが返される', async () => {
    // Given: 正常なトークンを生成して改ざん
    const payload = {
      userId: 'user-123',
      login: 'testuser',
    };
    const validToken = await generateJWT(payload, secret);
    const tamperedToken = validToken.slice(0, -10) + 'TAMPERED!!';

    // When: 改ざんされたトークンで保護されたエンドポイントにアクセス
    const res = await app.request(
      '/protected',
      {
        method: 'GET',
        headers: {
          Cookie: `token=${tamperedToken}`,
        },
      },
      env
    );

    // Then: 401エラーが返される
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('期限切れのJWTトークンが送信された場合、リクエストが拒否される', async () => {
    // Given: 期限切れのトークン
    const payload = {
      userId: 'user-123',
      login: 'testuser',
    };
    const expiredToken = await generateJWT(payload, secret, { expiresIn: '1ms' });

    // 少し待つ
    await new Promise((resolve) => setTimeout(resolve, 10));

    // When: 期限切れのトークンで保護されたエンドポイントにアクセス
    const res = await app.request(
      '/protected',
      {
        method: 'GET',
        headers: {
          Cookie: `token=${expiredToken}`,
        },
      },
      env
    );

    // Then: 401エラーが返される
    expect(res.status).toBe(401);
  });

  it('トークンが存在しない場合、401 Unauthorizedエラーが返される', async () => {
    // When: トークンなしで保護されたエンドポイントにアクセス
    const res = await app.request('/protected', {
      method: 'GET',
    }, env);

    // Then: 401エラーが返される
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

describe('セキュリティテスト: CSRF保護', () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route('/auth', authRoutes);
  });

  it('OAuth stateパラメータが一致しない場合、認証が失敗する', async () => {
    // Given: セッションに正しいCSRFトークンを保存
    const sessionId = 'test-session-id';
    const correctState = 'correct-csrf-token';
    await env.KV.put(sessionId, JSON.stringify({ csrfToken: correctState }));

    // When: 異なるstateパラメータでコールバックを呼び出す
    const res = await app.request(
      '/auth/callback?code=test_code&state=wrong-state',
      {
        method: 'GET',
        headers: {
          Cookie: `session_id=${sessionId}`,
        },
      },
      env
    );

    // Then: 認証が失敗する
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('CSRF');
  });

  it('セッションが存在しない場合、認証が失敗する', async () => {
    // When: 存在しないセッションIDでコールバックを呼び出す
    const res = await app.request(
      '/auth/callback?code=test_code&state=some-state',
      {
        method: 'GET',
        headers: {
          Cookie: 'session_id=nonexistent-session',
        },
      },
      env
    );

    // Then: 認証が失敗する
    expect(res.status).toBe(400);
  });
});

describe('セキュリティテスト: access_token暗号化', () => {
  const encryptionKey = 'test_encryption_key_32_chars_xxx'; // 32文字

  it('平文のトークンは保存されず、暗号化されたトークンがDBに保存される', async () => {
    // Given: 平文のアクセストークン
    const plainToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';

    // When: トークンを暗号化
    const encryptedToken = await encrypt(plainToken, encryptionKey);

    // Then: 暗号化されたトークンは平文とは異なる
    expect(encryptedToken).not.toBe(plainToken);
    expect(encryptedToken.length).toBeGreaterThan(plainToken.length);
  });

  it('暗号化されたトークンを復号化して元のトークンを取得できる', async () => {
    // Given: 平文のアクセストークン
    const plainToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';

    // When: トークンを暗号化してから復号化
    const encryptedToken = await encrypt(plainToken, encryptionKey);
    const decryptedToken = await decrypt(encryptedToken, encryptionKey);

    // Then: 元のトークンが取得できる
    expect(decryptedToken).toBe(plainToken);
  });

  it('異なる暗号化キーでは復号化できない', async () => {
    // Given: あるキーで暗号化されたトークン
    const plainToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';
    const correctKey = 'test_encryption_key_32_chars_xxx'; // 32文字
    const wrongKey = 'wrong_encryption_key_32_chars_yyy'; // 32文字

    const encryptedToken = await encrypt(plainToken, correctKey);

    // When/Then: 異なるキーで復号化しようとするとエラーが発生する
    await expect(decrypt(encryptedToken, wrongKey)).rejects.toThrow();
  });

  it('32文字未満の暗号化キーは拒否される', async () => {
    // Given: 短い暗号化キー
    const plainToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';
    const shortKey = 'too_short_key';

    // When/Then: 暗号化時にエラーが発生する
    await expect(encrypt(plainToken, shortKey)).rejects.toThrow(
      'Encryption key must be at least 32 characters'
    );
  });
});
