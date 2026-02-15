# セキュリティレビューレポート

**プロジェクト**: ADHD 抜け漏れチェッカー
**レビュー日**: 2026-02-14
**レビュー対象**: バックエンド（Hono + Workers）、フロントエンド（React + Vite）

---

## 📊 総合評価

| カテゴリ | 評価 | コメント |
|---------|------|----------|
| **環境変数管理** | ⚠️ 警告 | wrangler.tomlにシークレット情報がハードコーディング |
| **JWT保存方法** | ✅ 良好 | HttpOnly Cookie使用、適切な属性設定 |
| **SQL ORM** | ✅ 良好 | Drizzle ORM使用、SQLインジェクション対策済み |
| **暗号化** | ✅ 良好 | AES-256-GCM使用、access_token暗号化 |
| **CSRF対策** | ✅ 良好 | stateパラメータによる検証実装 |
| **CORS設定** | ⚠️ 警告 | 任意のオリジンを許可（本番環境で危険） |
| **認証ミドルウェア** | ⚠️ 警告 | 一部エンドポイントで未適用 |

---

## 🔴 重大な問題（Critical）

### 1. wrangler.tomlにシークレット情報がハードコーディング

**ファイル**: `backend/wrangler.toml`
**行**: 17-22

```toml
[vars]
GITHUB_CLIENT_ID = "test_client_id"
GITHUB_CLIENT_SECRET = "test_client_secret"
JWT_SECRET = "test_jwt_secret_key_minimum_32_chars_long"
ENCRYPTION_KEY = "test_encryption_key_32_chars_x"
FRONTEND_URL = "http://localhost:3000"
```

**問題点**:
- GitHubにコミットされた場合、シークレット情報が公開される
- 本番環境とローカル環境で同じ値を使用するリスク
- テスト値が本番に流用される可能性

**影響度**: 🔴 Critical

**修正方法**:
1. `[vars]`セクションを削除
2. ローカル開発: `.dev.vars`ファイルを使用（.gitignore済み）
3. 本番環境: Cloudflare Workers Secretsを使用

**修正例**:
```bash
# ローカル: .dev.vars ファイル作成
GITHUB_CLIENT_ID=your_local_client_id
GITHUB_CLIENT_SECRET=your_local_client_secret
JWT_SECRET=your_local_jwt_secret
ENCRYPTION_KEY=your_local_encryption_key
FRONTEND_URL=http://localhost:5173

# 本番: Wrangler secrets設定
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

---

## 🟡 中程度の問題（High）

### 2. CORS設定が緩い

**ファイル**: `backend/src/index.ts`
**行**: 18-21

```typescript
app.use('/*', cors({
  origin: (origin) => origin, // ❌ 任意のオリジンを許可
  credentials: true,
}));
```

**問題点**:
- 任意のオリジンからのリクエストを許可
- CSRF攻撃のリスク増加
- credentials: trueと組み合わせると危険

**影響度**: 🟡 High

**修正方法**:
```typescript
app.use('/*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.FRONTEND_URL,
      'http://localhost:5173', // 開発環境
      'http://localhost:5174',
    ];
    return allowedOrigins.includes(origin) ? origin : '';
  },
  credentials: true,
}));
```

---

### 3. `/auth/me` エンドポイントに認証ミドルウェア未適用

**ファイル**: `backend/src/routes/auth.ts`
**行**: 183-206

```typescript
authRoutes.get('/me', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  // ...
});
```

**問題点**:
- authMiddlewareが適用されていない
- `c.get('user')` は常にundefinedになる可能性
- 手動チェックではなくミドルウェアで統一すべき

**影響度**: 🟡 High

**修正方法**:
```typescript
import { authMiddleware } from '@/middleware/auth';

// 認証が必要なルートにミドルウェアを適用
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
```

---

## 🟢 軽微な問題（Medium）

### 4. エラーメッセージの詳細度

**ファイル**: `backend/src/routes/auth.ts`
**複数箇所**

**問題点**:
- エラーメッセージが詳細すぎる（攻撃者に情報を与える）
- 例: `"Session not found"`, `"CSRF token mismatch"`

**影響度**: 🟢 Medium

**推奨**:
- 本番環境では汎用的なエラーメッセージを使用
- 詳細はログに記録（攻撃分析用）

```typescript
// 本番環境
return c.json({ error: 'Authentication failed' }, 400);

// 開発環境（詳細ログ）
console.error('Detailed error:', { sessionId, error: 'Session not found' });
```

---

### 5. 暗号化キーの長さチェック

**ファイル**: `backend/src/lib/crypto.ts`
**行**: 7

```typescript
const keyBuffer = encoder.encode(key.padEnd(32, '0').substring(0, 32));
```

**問題点**:
- 短いキーを自動的に補完（警告なし）
- セキュリティリスク（弱いキーの使用を許可）

**影響度**: 🟢 Medium

**推奨**:
```typescript
export async function encrypt(data: string, key: string): Promise<string> {
  if (key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const keyBuffer = encoder.encode(key.substring(0, 32));
  // ...
}
```

---

## ✅ 良好な実装

### 1. JWT保存方法 ✅

**ファイル**: `backend/src/routes/auth.ts`
**行**: 148-153

```typescript
setCookie(c, 'token', token, {
  httpOnly: true,    // ✅ XSS対策
  secure: true,      // ✅ HTTPS必須
  sameSite: 'Lax',   // ✅ CSRF対策
  maxAge: 7 * 24 * 60 * 60, // 7日
});
```

**評価**: ✅ 完璧な実装
- `httpOnly`: JavaScriptからアクセス不可（XSS対策）
- `secure`: HTTPS通信のみ（中間者攻撃対策）
- `sameSite`: クロスサイトリクエスト制限（CSRF対策）

---

### 2. CSRF対策 ✅

**ファイル**: `backend/src/routes/auth.ts`
**行**: 70-73

```typescript
// CSRF検証
if (session.csrfToken !== state) {
  return c.json({ error: 'CSRF token mismatch' }, 400);
}
```

**評価**: ✅ OAuth stateパラメータによる適切なCSRF対策

---

### 3. access_token暗号化 ✅

**ファイル**: `backend/src/routes/auth.ts`
**行**: 104-105

```typescript
const encryptedToken = await encrypt(accessToken, c.env.ENCRYPTION_KEY);
```

**評価**: ✅ AES-256-GCMによる強力な暗号化

---

### 4. Drizzle ORM使用 ✅

**ファイル**: `backend/src/routes/auth.ts`
**行**: 111-128

```typescript
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
```

**評価**: ✅ パラメータバインディングによるSQLインジェクション対策

---

### 5. セッション管理 ✅

**ファイル**: `backend/src/routes/auth.ts`
**行**: 20-29

```typescript
await c.env.KV.put(
  sessionId,
  JSON.stringify({
    csrfToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10分
  }),
  { expirationTtl: 600 } // 10分
);
```

**評価**: ✅ Cloudflare KVによる適切なセッション管理

---

## 📝 .gitignore チェック ✅

**ファイル**: `.gitignore`

```gitignore
node_modules
dist
.wrangler
.dev.vars      # ✅ 環境変数ファイル除外
*.log
coverage
.DS_Store
.env           # ✅ 環境変数ファイル除外
.env.local     # ✅ 環境変数ファイル除外
*.db
.wrangler-local
```

**評価**: ✅ 適切な設定

---

## 🔍 環境変数露出チェック

### バックエンド

| ファイル | 露出 | 評価 |
|---------|------|------|
| `wrangler.toml` | ❌ あり | テスト値がハードコーディング |
| `src/index.ts` | ✅ なし | 環境変数から取得 |
| `src/routes/auth.ts` | ✅ なし | `c.env.*` 経由で取得 |

### フロントエンド

| ファイル | 露出 | 評価 |
|---------|------|------|
| `vite.config.ts` | ✅ なし | `process.env.VITE_API_URL` 使用 |
| `.env` | ✅ .gitignore済み | - |
| `src/**/*.tsx` | ✅ なし | ハードコーディングなし |

---

## 🎯 優先度別修正リスト

### 最優先（今すぐ修正）

1. ✅ **wrangler.toml からシークレット情報を削除**
   - `.dev.vars` ファイルに移行
   - Cloudflare Workers Secrets設定

2. ✅ **CORS設定を厳格化**
   - 許可するオリジンをホワイトリスト化

3. ✅ **認証ミドルウェアを適用**
   - `/auth/me` エンドポイント

### 高優先（次回リリース前）

4. エラーメッセージの汎用化（本番環境）
5. 暗号化キーの長さチェック追加

### 低優先（今後の改善）

6. レート制限の実装（OAuth エンドポイント）
7. ログ監視・アラート設定
8. セキュリティヘッダーの追加（CSP, HSTS など）

---

## 📚 参考リンク

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/platform/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OAuth 2.0 Security](https://tools.ietf.org/html/rfc6749#section-10)

---

## ✅ 受け入れ基準

- [ ] wrangler.toml からシークレット情報を削除
- [ ] .dev.vars ファイルを作成（.gitignore確認）
- [ ] CORS設定をホワイトリスト化
- [ ] `/auth/me` に authMiddleware 適用
- [ ] 暗号化キーの長さチェック実装
- [ ] セキュリティテスト実施（Issue #01）
