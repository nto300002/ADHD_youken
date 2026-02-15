# GitHub OAuth App セットアップガイド

## 概要
ADHD 抜け漏れチェッカーでGitHub OAuth認証を使用するために、GitHub OAuth Appを作成します。

---

## 手順

### 1. GitHub Developer Settings にアクセス

**URL**: https://github.com/settings/developers

または手動で：
1. GitHub にログイン
2. 右上のプロフィールアイコン → **Settings**
3. 左サイドバー最下部 → **Developer settings**
4. **OAuth Apps** をクリック

---

### 2. New OAuth App を作成

**「New OAuth App」** ボタンをクリック

以下の情報を入力：

#### ローカル開発環境用

| フィールド | 値 |
|-----------|-----|
| **Application name** | `ADHD Checker (Local)` |
| **Homepage URL** | `http://localhost:5173` |
| **Application description** | `ADHD 抜け漏れチェッカー - ローカル開発環境` |
| **Authorization callback URL** | `http://localhost:8787/auth/callback` |

> 💡 **ポイント**:
> - Callback URLは `{BACKEND_URL}/auth/callback` の形式
> - ローカルではバックエンドが `http://localhost:8787` で動作（Wrangler dev server）
> - フロントエンドは `http://localhost:5173`（Vite dev server）

#### 本番環境用（別途作成）

| フィールド | 値 |
|-----------|-----|
| **Application name** | `ADHD Checker (Production)` |
| **Homepage URL** | `https://yourdomain.com` |
| **Application description** | `ADHD 抜け漏れチェッカー - 本番環境` |
| **Authorization callback URL** | `https://api.yourdomain.com/auth/callback` |

---

### 3. Client ID と Client Secret を取得

アプリを作成すると、以下が表示されます：

```
Client ID: Ov23liABCDEF1234567890
```

**「Generate a new client secret」** ボタンをクリック

```
Client Secret: 1234567890abcdef1234567890abcdef12345678
```

⚠️ **重要**: Client Secretは一度しか表示されません。必ずコピーしてください。

---

### 4. ローカル開発環境に設定

#### backend/.dev.vars ファイルを作成

```bash
cd backend
cp .dev.vars.example .dev.vars
```

#### .dev.vars を編集

```bash
# GitHub OAuth（ローカル開発用）
GITHUB_CLIENT_ID=Ov23liABCDEF1234567890
GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678

# セキュリティキー（32文字以上のランダム文字列）
# 生成方法: openssl rand -base64 32
JWT_SECRET=KpJIET9qOJPokMXkzKTHAB5psE8EoyZvxC8hxwE2B9k=

# 暗号化キー（64文字のhex文字列 = 32バイト）
# 生成方法: openssl rand -hex 32
ENCRYPTION_KEY=0c29221809e119705902db621a81fa96d77d56c4b8bc179a7038274853940b1f

# フロントエンドURL（開発環境）
FRONTEND_URL=http://localhost:5173
```

#### セキュリティキーの生成

```bash
# JWT_SECRET を生成（32文字以上）
openssl rand -base64 32

# ENCRYPTION_KEY を生成（32バイト = 64文字のhex）
openssl rand -hex 32
```

---

### 5. 動作確認

#### バックエンドを起動

```bash
cd backend
pnpm dev
```

ブラウザで確認:
```
http://localhost:8787/auth/github
```

→ GitHubのログイン画面にリダイレクトされればOK ✅

#### フロントエンドを起動

```bash
cd frontend
pnpm dev
```

ブラウザで確認:
```
http://localhost:5173
```

---

### 6. 本番環境へのデプロイ

#### Cloudflare Workers Secrets に設定

```bash
cd backend

# GitHub OAuth
wrangler secret put GITHUB_CLIENT_ID
# → 本番用のClient IDを入力

wrangler secret put GITHUB_CLIENT_SECRET
# → 本番用のClient Secretを入力

# セキュリティキー
wrangler secret put JWT_SECRET
# → 新しく生成したJWT_SECRETを入力

wrangler secret put ENCRYPTION_KEY
# → 新しく生成したENCRYPTION_KEYを入力
```

⚠️ **重要**: 本番環境では必ず新しいキーを生成してください。開発環境と同じキーを使わないこと。

#### wrangler.toml の FRONTEND_URL を更新

```toml
[vars]
FRONTEND_URL = "https://yourdomain.com"
```

#### デプロイ

```bash
pnpm deploy
```

---

## トラブルシューティング

### エラー: "redirect_uri_mismatch"

**原因**: Callback URLが一致していない

**解決策**:
1. GitHub OAuth App の設定を確認
2. Callback URL が `http://localhost:8787/auth/callback` になっているか確認
3. ポート番号が正しいか確認（Wranglerのデフォルトは8787）

### エラー: "Bad credentials"

**原因**: Client ID または Client Secret が間違っている

**解決策**:
1. `.dev.vars` の値を確認
2. GitHub OAuth App の画面で Client ID を確認
3. Client Secret を再生成して設定し直す

### ローカル環境でポート8787が使えない場合

**wrangler.toml に追加**:
```toml
[dev]
port = 8788  # 別のポート番号
```

**GitHub OAuth App の Callback URL を更新**:
```
http://localhost:8788/auth/callback
```

---

## セキュリティのベストプラクティス

✅ **DO（推奨）**:
- ローカル開発用と本番環境用で別のOAuth Appを作成
- Client Secretは絶対にGitにコミットしない
- 本番環境では強力なJWT_SECRETとENCRYPTION_KEYを使用

❌ **DON'T（非推奨）**:
- 開発環境と本番環境で同じClient Secretを使用
- Client Secretをwrangler.tomlに直接記載
- 弱い暗号化キーを使用（短い文字列、予測可能な文字列）

---

## 参考リンク

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
