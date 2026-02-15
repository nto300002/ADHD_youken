# GitHub Secrets設定ガイド

CI/CDパイプラインの動作に必要なGitHub Secretsの設定方法を説明します。

## 設定手順

1. GitHubリポジトリの **Settings** > **Secrets and variables** > **Actions** に移動
2. **New repository secret** をクリック
3. 以下のSecretsを追加

## 必須Secrets一覧

### Cloudflare関連

#### `CLOUDFLARE_API_TOKEN`
**説明**: Cloudflare APIトークン（Workers, Pages, D1へのアクセス権限）

**取得方法**:
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **My Profile** > **API Tokens** に移動
3. **Create Token** をクリック
4. テンプレート: **Edit Cloudflare Workers** を選択
5. 必要な権限:
   - Account > Cloudflare Workers > Edit
   - Account > Cloudflare Pages > Edit
   - Account > D1 > Edit
6. 生成されたトークンをコピー

**値の例**:
```
y_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

---

#### `CLOUDFLARE_ACCOUNT_ID`
**説明**: CloudflareアカウントID

**取得方法**:
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. サイドバーから任意のWorkerまたはPagesプロジェクトを開く
3. URLに含まれる `account/<ACCOUNT_ID>` の部分をコピー
   - 例: `https://dash.cloudflare.com/<ACCOUNT_ID>/workers/...`

または、ダッシュボード右下の **Account ID** からコピー

**値の例**:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

#### `API_BASE_URL`
**説明**: デプロイされたバックエンドAPI のURL

**設定タイミング**: 初回デプロイ後

**値の例**:
```
https://adhd-youken-backend.your-subdomain.workers.dev
```

**取得方法**:
1. Backend を初回デプロイ（手動またはCI/CD）
2. Cloudflare Workers ダッシュボードで確認
3. または、デプロイログから取得

---

#### `FRONTEND_URL`
**説明**: デプロイされたフロントエンドのURL

**設定タイミング**: 初回デプロイ後

**値の例**:
```
https://adhd-youken.pages.dev
```

**取得方法**:
1. Frontend を初回デプロイ（手動またはCI/CD）
2. Cloudflare Pages ダッシュボードで確認
3. または、デプロイログから取得

---

### GitHub OAuth関連

#### `GITHUB_CLIENT_ID`
**説明**: GitHub OAuthアプリケーションのクライアントID

**取得方法**:
1. [GitHub Settings](https://github.com/settings/developers) > **OAuth Apps** に移動
2. **New OAuth App** をクリック
3. アプリケーション情報を入力:
   - **Application name**: `ADHD 抜け漏れチェッカー`
   - **Homepage URL**: `https://adhd-youken.pages.dev`
   - **Authorization callback URL**: `https://adhd-youken-backend.your-subdomain.workers.dev/auth/callback`
4. **Register application** をクリック
5. **Client ID** をコピー

**値の例**:
```
Iv1.a1b2c3d4e5f6g7h8
```

---

#### `GITHUB_CLIENT_SECRET`
**説明**: GitHub OAuthアプリケーションのクライアントシークレット

**取得方法**:
1. 上記で作成したOAuthアプリの詳細ページで **Generate a new client secret** をクリック
2. 生成されたシークレットをコピー（⚠️ 一度しか表示されません）

**値の例**:
```
abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890
```

---

### セキュリティ関連

#### `JWT_SECRET`
**説明**: JWT署名用シークレットキー（32文字以上推奨）

**生成方法**:
```bash
# ランダムな32バイトの文字列を生成
openssl rand -base64 32
```

**値の例**:
```
xK9pL2mN5qR8tU1wZ4aB7cD0eF3gH6jI9kL2mN5qR8tU=
```

---

#### `WEBHOOK_SECRET`
**説明**: GitHub Webhook検証用シークレット

**生成方法**:
```bash
# ランダムな32バイトの文字列を生成
openssl rand -base64 32
```

**値の例**:
```
yL0pM3nO6rS9uV2xA5bC8dE1fG4hJ7kM0nP3qR6sT9vW=
```

---

#### `ENCRYPTION_KEY`
**説明**: access_token暗号化用キー（32バイト）

**生成方法**:
```bash
# 32バイトのhex文字列を生成
openssl rand -hex 32
```

**値の例**:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

### オプションSecrets

#### `SNYK_TOKEN`
**説明**: Snykセキュリティスキャン用トークン（オプション）

**取得方法**:
1. [Snyk](https://snyk.io/) にサインアップ
2. **Settings** > **General** > **Auth Token** からトークンを取得

**値の例**:
```
abc12345-def6-7890-ghij-klmnopqrstuv
```

---

## 設定完了チェックリスト

- [ ] `CLOUDFLARE_API_TOKEN` - Cloudflare APIアクセス権限
- [ ] `CLOUDFLARE_ACCOUNT_ID` - CloudflareアカウントID
- [ ] `API_BASE_URL` - バックエンドAPI URL（初回デプロイ後）
- [ ] `FRONTEND_URL` - フロントエンドURL（初回デプロイ後）
- [ ] `GITHUB_CLIENT_ID` - GitHub OAuth クライアントID
- [ ] `GITHUB_CLIENT_SECRET` - GitHub OAuth シークレット
- [ ] `JWT_SECRET` - JWT署名キー
- [ ] `WEBHOOK_SECRET` - Webhook検証キー
- [ ] `ENCRYPTION_KEY` - 暗号化キー
- [ ] `SNYK_TOKEN` - Snykトークン（オプション）

## 初回セットアップフロー

1. **Cloudflare Secrets を設定**
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. **セキュリティ Secrets を生成・設定**
   - `JWT_SECRET`
   - `WEBHOOK_SECRET`
   - `ENCRYPTION_KEY`

3. **GitHub OAuth アプリを作成**
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

4. **初回デプロイ（手動）**
   ```bash
   # Backend
   cd backend
   wrangler deploy --env production

   # Frontend
   cd frontend
   pnpm build
   # Cloudflare Pages でデプロイ
   ```

5. **デプロイURL を設定**
   - `API_BASE_URL`
   - `FRONTEND_URL`

6. **（オプション）Snyk トークンを設定**
   - `SNYK_TOKEN`

7. **動作確認**
   - PR を作成してCI が実行されることを確認
   - main にマージしてデプロイが実行されることを確認

## トラブルシューティング

### Secrets が認識されない

- Secret名のスペルミスを確認
- Secretの値に余分な空白や改行が含まれていないか確認
- ワークフローファイルで正しく参照されているか確認

### Cloudflare デプロイに失敗

- `CLOUDFLARE_API_TOKEN` の権限を確認
- `CLOUDFLARE_ACCOUNT_ID` が正しいか確認
- Cloudflareダッシュボードで該当プロジェクトが存在するか確認

### OAuth認証に失敗

- `GITHUB_CLIENT_ID` と `GITHUB_CLIENT_SECRET` が正しいか確認
- GitHub OAuth アプリのコールバックURLが正しいか確認
- `API_BASE_URL` が正しく設定されているか確認

## セキュリティベストプラクティス

- ✅ Secretsは絶対にコミットしない
- ✅ 定期的にトークンをローテーション（90日ごと推奨）
- ✅ 不要になったトークンは即座に削除
- ✅ 本番環境とステージング環境でSecrets を分ける
- ✅ Cloudflare Workers の環境変数でもSecrets を設定（重複管理）

## 参考リンク

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
