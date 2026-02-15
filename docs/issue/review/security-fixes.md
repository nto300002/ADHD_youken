# セキュリティ修正ガイド

このドキュメントでは、セキュリティレビューで発見された問題の具体的な修正方法を示します。

---

## 🔴 修正1: wrangler.toml のシークレット情報削除

### 現在の状態（❌ 危険）

**ファイル**: `backend/wrangler.toml`

```toml
[vars]
GITHUB_CLIENT_ID = "test_client_id"
GITHUB_CLIENT_SECRET = "test_client_secret"
JWT_SECRET = "test_jwt_secret_key_minimum_32_chars_long"
ENCRYPTION_KEY = "test_encryption_key_32_chars_x"
FRONTEND_URL = "http://localhost:3000"
```

### 修正後（✅ 安全）

#### 1. wrangler.toml を修正

```toml
name = "adhd-youken"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "adhd-youken-db"
database_id = "local"
migrations_dir = "drizzle/migrations"

# KV Namespace (for sessions)
[[kv_namespaces]]
binding = "KV"
id = "local"

# ❌ [vars] セクションを削除
# シークレット情報はローカル: .dev.vars、本番: Cloudflare Secrets を使用
```

#### 2. `.dev.vars` ファイルを作成（ローカル開発用）

**ファイル**: `backend/.dev.vars`

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# セキュリティ
JWT_SECRET=your_jwt_secret_at_least_32_characters_long_here
ENCRYPTION_KEY=your_encryption_key_32_chars_here

# URLs
FRONTEND_URL=http://localhost:5173
```

**重要**: このファイルは `.gitignore` に含まれています。

#### 3. 本番環境: Cloudflare Workers Secrets を設定

```bash
# GitHub OAuth
wrangler secret put GITHUB_CLIENT_ID
# 入力: 本番用のGitHub Client ID

wrangler secret put GITHUB_CLIENT_SECRET
# 入力: 本番用のGitHub Client Secret

# セキュリティ
wrangler secret put JWT_SECRET
# 入力: 32文字以上のランダム文字列
# 生成方法: openssl rand -base64 32

wrangler secret put ENCRYPTION_KEY
# 入力: 32バイトのhex文字列
# 生成方法: openssl rand -hex 32

wrangler secret put FRONTEND_URL
# 入力: https://your-domain.pages.dev
```

#### 4. .gitignore 確認

```gitignore
# 既に含まれているか確認
.dev.vars
.env
.env.local
```

---

## 🟡 修正2: CORS設定の厳格化

### 現在の状態（❌ 危険）

**ファイル**: `backend/src/index.ts`

```typescript
app.use('/*', cors({
  origin: (origin) => origin, // 任意のオリジンを許可
  credentials: true,
}));
```

### 修正後（✅ 安全）

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS設定（ホワイトリスト化）
app.use('/*', cors({
  origin: (origin, c) => {
    // 許可するオリジンのリスト
    const allowedOrigins = [
      c.env.FRONTEND_URL,           // 本番環境
      'http://localhost:5173',      // ローカル開発（Vite default）
      'http://localhost:5174',      // ローカル開発（port conflict時）
      'http://localhost:3000',      // ローカル開発（代替）
    ];

    // オリジンがホワイトリストに含まれるかチェック
    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // 許可されていないオリジンは空文字列を返す
    return '';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24時間
}));

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// 認証ルート
app.route('/auth', authRoutes);

export default app;
```

---

## 🟡 修正3: 認証ミドルウェアの適用

### 現在の状態（❌ 不完全）

**ファイル**: `backend/src/routes/auth.ts`

```typescript
authRoutes.get('/me', async (c) => {
  const user = c.get('user'); // ❌ authMiddleware未適用のため常にundefined

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  // ...
});
```

### 修正後（✅ 安全）

```typescript
import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';
import { Octokit } from 'octokit';
import { generateJWT } from '@/lib/jwt';
import { encrypt, decrypt } from '@/lib/crypto';
import { getDB, users } from '@/db';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '@/middleware/auth'; // ✅ ミドルウェアをインポート
import type { Env } from '@/index';

export const authRoutes = new Hono<{ Bindings: Env }>();

// ... (他のルートは変更なし)

/**
 * GET /auth/me - 現在のユーザー情報
 * ✅ authMiddleware を適用
 */
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user'); // ✅ authMiddlewareで設定済み

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
```

---

## 🟢 修正4: 暗号化キーの長さチェック

### 現在の状態（⚠️ 警告なし）

**ファイル**: `backend/src/lib/crypto.ts`

```typescript
export async function encrypt(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const keyBuffer = encoder.encode(key.padEnd(32, '0').substring(0, 32)); // ⚠️ 短いキーを自動補完

  // ...
}
```

### 修正後（✅ バリデーション追加）

```typescript
/**
 * データを暗号化（AES-256-GCM）
 * @param data 暗号化するデータ
 * @param key 暗号化キー（32文字以上必須）
 */
export async function encrypt(data: string, key: string): Promise<string> {
  // ✅ キーの長さチェック
  if (key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const keyBuffer = encoder.encode(key.substring(0, 32)); // 正確に32文字使用

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );

  const encrypted = new Uint8Array(encryptedBuffer);
  const result = new Uint8Array(iv.length + encrypted.length);
  result.set(iv);
  result.set(encrypted, iv.length);

  return btoa(String.fromCharCode(...result));
}

/**
 * データを復号化（AES-256-GCM）
 * @param encrypted 暗号化されたデータ
 * @param key 暗号化キー（32文字以上必須）
 */
export async function decrypt(encrypted: string, key: string): Promise<string> {
  // ✅ キーの長さチェック
  if (key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(key.substring(0, 32)); // 正確に32文字使用

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const encryptedData = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
```

---

## 🟢 修正5: エラーメッセージの汎用化（本番環境）

### 環境変数ベースのエラーハンドリング

**ファイル**: `backend/src/lib/error-handler.ts`（新規作成）

```typescript
import type { Context } from 'hono';

/**
 * 環境に応じたエラーメッセージを返す
 */
export function getErrorMessage(
  c: Context,
  detailedMessage: string,
  genericMessage: string = 'An error occurred'
): string {
  // 開発環境では詳細メッセージ、本番環境では汎用メッセージ
  const isDevelopment = c.env?.NODE_ENV !== 'production';
  return isDevelopment ? detailedMessage : genericMessage;
}

/**
 * エラーレスポンスを返す（環境に応じて詳細度を調整）
 */
export function errorResponse(
  c: Context,
  status: number,
  detailedMessage: string,
  genericMessage?: string
) {
  const message = getErrorMessage(c, detailedMessage, genericMessage);

  // 本番環境では詳細ログをコンソールに記録（分析用）
  if (c.env?.NODE_ENV === 'production') {
    console.error('[ERROR]', {
      status,
      detail: detailedMessage,
      timestamp: new Date().toISOString(),
    });
  }

  return c.json({ error: message }, status);
}
```

### 使用例

**ファイル**: `backend/src/routes/auth.ts`

```typescript
import { errorResponse } from '@/lib/error-handler';

authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const sessionId = getCookie(c, 'session_id');

  if (!code || !state || !sessionId) {
    return errorResponse(
      c,
      400,
      'Invalid callback parameters: missing code, state, or sessionId',
      'Authentication failed'
    );
  }

  // セッションを取得
  const sessionData = await c.env.KV.get(sessionId);
  if (!sessionData) {
    return errorResponse(
      c,
      400,
      'Session not found in KV store',
      'Authentication failed'
    );
  }

  const session = JSON.parse(sessionData);

  // CSRF検証
  if (session.csrfToken !== state) {
    return errorResponse(
      c,
      400,
      'CSRF token mismatch',
      'Authentication failed'
    );
  }

  // ...
});
```

---

## ✅ 修正チェックリスト

### 最優先（今すぐ実施）

- [ ] `backend/wrangler.toml` から `[vars]` セクションを削除
- [ ] `backend/.dev.vars` ファイルを作成（シークレット情報を移行）
- [ ] `.gitignore` に `.dev.vars` が含まれることを確認
- [ ] `backend/src/index.ts` のCORS設定をホワイトリスト化
- [ ] `backend/src/routes/auth.ts` の `/auth/me` に `authMiddleware` を適用

### 高優先（次回リリース前）

- [ ] `backend/src/lib/crypto.ts` に暗号化キーの長さチェックを追加
- [ ] `backend/src/lib/error-handler.ts` を作成
- [ ] エラーメッセージを汎用化（本番環境）

### 本番デプロイ前

- [ ] Cloudflare Workers Secrets を設定
  - [ ] `GITHUB_CLIENT_ID`
  - [ ] `GITHUB_CLIENT_SECRET`
  - [ ] `JWT_SECRET`（`openssl rand -base64 32`で生成）
  - [ ] `ENCRYPTION_KEY`（`openssl rand -hex 32`で生成）
  - [ ] `FRONTEND_URL`
- [ ] CORS設定に本番URLを追加
- [ ] GitHub OAuthアプリのコールバックURLを更新

---

## 🧪 修正後のテスト

### 1. ローカル開発環境テスト

```bash
# backend/.dev.vars が正しく読み込まれるか確認
cd backend
pnpm dev

# 別ターミナルでテスト
curl http://localhost:8787/health
# 期待: {"status":"ok"}
```

### 2. CORS設定テスト

```bash
# 許可されたオリジンからのリクエスト
curl -X GET http://localhost:8787/health \
  -H "Origin: http://localhost:5173" \
  -v

# 許可されていないオリジンからのリクエスト
curl -X GET http://localhost:8787/health \
  -H "Origin: https://evil.com" \
  -v
```

### 3. 認証フローテスト

```bash
# /auth/me エンドポイント（認証なし）
curl http://localhost:8787/auth/me
# 期待: {"error":"Unauthorized"}

# /auth/me エンドポイント（有効なトークン）
curl http://localhost:8787/auth/me \
  -H "Cookie: token=valid_jwt_token"
# 期待: ユーザー情報
```

---

## 📚 参考資料

- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
