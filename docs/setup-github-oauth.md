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

### 6. 本番環境のドメイン設定

本番環境では、以下の2つのドメインが必要です：

| 用途 | 例 | デプロイ先 |
|------|-----|-----------|
| **フロントエンド** | `app.yourdomain.com` または `yourdomain.com` | Cloudflare Pages |
| **バックエンドAPI** | `api.yourdomain.com` | Cloudflare Workers |

#### 6-1. ドメインの取得

##### オプション A: Cloudflare Registrar で取得（推奨）

**メリット**: DNS設定が自動、管理が一元化、安価

1. **Cloudflare Dashboard にアクセス**
   - https://dash.cloudflare.com/

2. **ドメインを検索**
   - 左サイドバー → **Domain Registration**
   - 希望のドメイン名を検索（例: `adhd-checker.com`）

3. **購入手続き**
   - 利用可能なドメインを選択
   - 支払い情報を入力
   - 購入完了（通常1-5分で利用可能）

4. **自動設定完了**
   - DNSゾーンが自動作成される
   - Cloudflare管理下に入る

##### オプション B: 他のレジストラで取得して移管

**他のレジストラ例**: Google Domains、Namecheap、お名前.com など

1. **ドメイン取得**（任意のレジストラ）

2. **Cloudflareにサイトを追加**
   - Cloudflare Dashboard → **Add site**
   - 取得したドメイン名を入力
   - Freeプランを選択

3. **ネームサーバーを変更**
   - Cloudflareが表示するネームサーバー（例: `ns1.cloudflare.com`, `ns2.cloudflare.com`）をコピー
   - レジストラの管理画面でネームサーバーを変更
   - 反映まで24-48時間待つ

4. **アクティベーション確認**
   - Cloudflare Dashboard でステータスが **Active** になればOK

---

#### 6-2. フロントエンド（Cloudflare Pages）のドメイン設定

1. **Cloudflare Dashboard → Pages にアクセス**
   - https://dash.cloudflare.com/ → **Workers & Pages** → **Pages**

2. **プロジェクトを選択**
   - デプロイ済みのフロントエンドプロジェクトをクリック

3. **カスタムドメインを追加**
   - **Custom domains** タブをクリック
   - **Set up a custom domain** ボタンをクリック

4. **ドメイン設定**

   **パターン1: ルートドメインを使用**
   ```
   ドメイン: yourdomain.com
   ```
   - Cloudflareが自動でDNSレコードを作成
   - CNAME flattening により動作

   **パターン2: サブドメインを使用（推奨）**
   ```
   ドメイン: app.yourdomain.com
   ```
   - CNAMEレコードが自動作成される

5. **SSL証明書の自動発行**
   - Cloudflareが自動でSSL/TLS証明書を発行（通常1-5分）
   - ステータスが **Active** になれば完了

6. **動作確認**
   ```
   https://app.yourdomain.com
   ```
   → フロントエンドが表示されればOK ✅

---

#### 6-3. バックエンド（Cloudflare Workers）のドメイン設定

##### 方法1: Workers Custom Domain（推奨）

1. **Cloudflare Dashboard → Workers & Pages にアクセス**
   - デプロイ済みのWorkerを選択

2. **Settings → Domains & Routes をクリック**

3. **Add Custom Domain をクリック**
   ```
   ドメイン: api.yourdomain.com
   ```

4. **自動DNS設定**
   - Cloudflareが自動でDNSレコードを作成
   - SSL証明書も自動発行

5. **動作確認**
   ```
   https://api.yourdomain.com/auth/github
   ```
   → GitHubのOAuth画面にリダイレクトされればOK ✅

##### 方法2: Workers Routes（zone経由）

**Custom Domainが使えない場合の代替手段**

1. **Cloudflare Dashboard → Websites を選択**
   - 設定したいドメインのゾーンをクリック

2. **DNS レコードを追加**
   - **DNS** → **Records** → **Add record**
   - Type: `CNAME`
   - Name: `api`
   - Target: `yourdomain.com` （ダミー値でOK）
   - Proxy status: **Proxied** （オレンジ色のクラウド）

3. **Workers Routes を設定**
   - **Workers Routes** → **Add route**
   - Route: `api.yourdomain.com/*`
   - Worker: デプロイ済みのWorker名を選択

4. **動作確認**（同上）

---

#### 6-4. DNS設定の確認

最終的なDNSレコード構成（例）:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `app` | `your-project.pages.dev` | Proxied |
| CNAME | `api` | Worker Custom Domain または ダミー | Proxied |

**確認コマンド**:
```bash
# フロントエンド
dig app.yourdomain.com

# バックエンド
dig api.yourdomain.com
```

両方ともCloudflareのIPアドレスを返せばOK

---

#### 6-5. GitHub OAuth App の本番環境用設定

1. **GitHub Developer Settings にアクセス**
   - https://github.com/settings/developers

2. **New OAuth App を作成**（または既存のProduction用を編集）

3. **本番環境の情報を入力**

   | フィールド | 値 |
   |-----------|-----|
   | **Application name** | `ADHD Checker (Production)` |
   | **Homepage URL** | `https://app.yourdomain.com` |
   | **Application description** | `ADHD 抜け漏れチェッカー - 本番環境` |
   | **Authorization callback URL** | `https://api.yourdomain.com/auth/callback` |

4. **Client ID と Client Secret を取得**
   - 後述の手順でCloudflare Secretsに設定

---

### 7. 本番環境へのデプロイ

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
# フロントエンドのドメインに合わせる
FRONTEND_URL = "https://app.yourdomain.com"  # サブドメインを使用した場合
# または
FRONTEND_URL = "https://yourdomain.com"      # ルートドメインを使用した場合
```

#### デプロイ

**バックエンド（Cloudflare Workers）:**
```bash
cd backend
pnpm deploy
```

**フロントエンド（Cloudflare Pages）:**
```bash
cd frontend
pnpm deploy
```

または GitHub Actions の自動デプロイを使用（`.github/workflows/deploy.yml`）

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

### 本番環境でOAuth認証が失敗する

**原因1**: ドメイン設定が完了していない

**解決策**:
1. Cloudflare PagesのカスタムドメインがActiveか確認
2. Cloudflare WorkersのCustom Domainが設定済みか確認
3. SSL証明書がActiveか確認（通常1-5分）

**原因2**: GitHub OAuth AppのCallback URLが間違っている

**解決策**:
```
正しいCallback URL: https://api.yourdomain.com/auth/callback
                              ^^^
                              バックエンドのドメイン
```

**原因3**: FRONTEND_URLが間違っている

**解決策**:
```bash
# wrangler.tomlを確認
cat backend/wrangler.toml | grep FRONTEND_URL

# 正しい設定例
FRONTEND_URL = "https://app.yourdomain.com"
```

### DNS設定が反映されない

**原因**: DNS propagationに時間がかかっている

**解決策**:
1. Cloudflare Registrarで取得した場合: 1-5分で反映
2. 他のレジストラから移管した場合: 24-48時間待つ
3. 確認コマンド: `dig app.yourdomain.com`

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

### GitHub OAuth
- [GitHub OAuth Apps Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [OAuth Authorization Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)

### Cloudflare Workers
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)

### Cloudflare Pages
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Pages Deployment](https://developers.cloudflare.com/pages/get-started/deploy-site/)

### Cloudflare DNS & Domains
- [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
- [DNS Management](https://developers.cloudflare.com/dns/)
- [CNAME Flattening](https://developers.cloudflare.com/dns/cname-flattening/)

### セキュリティ
- [OWASP OAuth 2.0 Security](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [Cloudflare SSL/TLS](https://developers.cloudflare.com/ssl/)
