# セキュリティチェックリスト

このチェックリストは、開発・デプロイ時にセキュリティ要件が満たされているかを確認するためのものです。

---

## 🔐 認証・認可

### JWT管理

- [x] **JWTはHttpOnly Cookieに保存**
  - ファイル: `backend/src/routes/auth.ts:148-153`
  - 属性: `httpOnly: true, secure: true, sameSite: 'Lax'`

- [x] **JWTに有効期限を設定**
  - ファイル: `backend/src/lib/jwt.ts:53-56`
  - 期限: 7日（`expiresIn: '7d'`）

- [x] **JWT検証時に有効期限をチェック**
  - ファイル: `backend/src/lib/jwt.ts:72-74`

- [ ] **JWTのリフレッシュトークン実装**（将来的な改善）

### OAuth 2.0

- [x] **CSRFトークン（state）による検証**
  - ファイル: `backend/src/routes/auth.ts:70-73`

- [x] **セッションの有効期限管理**
  - ファイル: `backend/src/routes/auth.ts:26-28`
  - 期限: 10分

- [x] **アクセストークンの暗号化保存**
  - ファイル: `backend/src/routes/auth.ts:104-105`
  - アルゴリズム: AES-256-GCM

- [ ] **OAuth認証エンドポイントのレート制限**（将来的な改善）

### 認証ミドルウェア

- [x] **JWT検証ミドルウェアの実装**
  - ファイル: `backend/src/middleware/auth.ts:16-33`

- [ ] **保護されたエンドポイントにミドルウェア適用**
  - ❌ `/auth/me` に未適用 → 要修正

---

## 🔒 暗号化

### データ暗号化

- [x] **AES-256-GCM使用**
  - ファイル: `backend/src/lib/crypto.ts:9-22`

- [x] **ランダムIV（初期化ベクトル）生成**
  - ファイル: `backend/src/lib/crypto.ts:17`

- [ ] **暗号化キーの長さチェック（32文字以上）**
  - ⚠️ 自動補完されるが警告なし → 要修正

### パスワード・シークレット管理

- [ ] **wrangler.tomlにシークレット情報がない**
  - ❌ 現在ハードコーディングあり → 要修正

- [x] **環境変数ファイルが.gitignoreに含まれる**
  - ファイル: `.gitignore:4,8-9`
  - 対象: `.dev.vars`, `.env`, `.env.local`

- [ ] **本番環境でCloudflare Workers Secretsを使用**
  - 要設定: `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`

---

## 🛡️ CORS・CSRF対策

### CORS設定

- [ ] **許可するオリジンをホワイトリスト化**
  - ❌ 現在: `origin: (origin) => origin`（任意のオリジンを許可） → 要修正
  - 推奨: `FRONTEND_URL`のみ許可

- [x] **credentials: trueの設定**
  - ファイル: `backend/src/index.ts:20`

### CSRF対策

- [x] **OAuth stateパラメータによる検証**
  - ファイル: `backend/src/routes/auth.ts:70-73`

- [x] **sameSite Cookie属性の設定**
  - ファイル: `backend/src/routes/auth.ts:35,151`
  - 値: `'Lax'`

---

## 💉 SQLインジェクション対策

### ORM使用

- [x] **Drizzle ORMを使用**
  - ファイル: `backend/src/routes/auth.ts:111-128`

- [x] **パラメータバインディング**
  - Drizzle ORMが自動で実施

- [x] **生SQLの使用なし**
  - 確認済み: すべてDrizzle API経由

---

## 🕷️ XSS対策

### フロントエンド

- [x] **react-markdownによる安全なマークダウンレンダリング**
  - パッケージ: `react-markdown@^10.1.0`

- [ ] **DOMPurifyの導入検討**（ユーザー入力を表示する場合）

### バックエンド

- [x] **適切なContent-Typeヘッダー**
  - Honoが自動設定

- [ ] **CSPヘッダーの設定**（将来的な改善）

---

## 🔍 情報漏洩対策

### エラーメッセージ

- [ ] **本番環境で詳細なエラーメッセージを隠す**
  - ⚠️ 現在: 詳細すぎる可能性 → 環境変数で切り替え推奨

### ログ

- [x] **機密情報（トークン、パスワード）をログに出力しない**
  - 確認済み: console.logにトークンなし

### HTTPヘッダー

- [ ] **X-Powered-By ヘッダーを削除**（将来的な改善）
- [ ] **Server ヘッダーを隠す**（将来的な改善）

---

## 📦 依存関係

### パッケージ管理

- [x] **pnpm-lock.yaml をコミット**
  - 再現可能なビルド

- [x] **Dependabotの設定**
  - ファイル: `.github/dependabot.yml`

- [ ] **定期的な脆弱性スキャン**
  - ワークフロー: `.github/workflows/security-scan.yml`
  - 実行: 毎週月曜 + PR時

### セキュリティスキャン

- [x] **pnpm audit 実行**
  - CI/CD: `.github/workflows/security-scan.yml:14-51`

- [x] **Dependency Review（PR時）**
  - CI/CD: `.github/workflows/security-scan.yml:53-66`

- [x] **Snyk スキャン（オプション）**
  - CI/CD: `.github/workflows/security-scan.yml:68-142`

- [x] **CodeQL 分析**
  - CI/CD: `.github/workflows/security-scan.yml:144-175`

---

## 🚀 デプロイ

### 環境変数

- [ ] **本番環境変数の設定完了**
  - [ ] `GITHUB_CLIENT_ID`
  - [ ] `GITHUB_CLIENT_SECRET`
  - [ ] `JWT_SECRET`（32文字以上）
  - [ ] `ENCRYPTION_KEY`（32バイト）
  - [ ] `FRONTEND_URL`

### HTTPS

- [x] **Cloudflare Workers はデフォルトでHTTPS**

- [x] **Cookie secure属性**
  - ファイル: `backend/src/routes/auth.ts:34,150`

### GitHub OAuth

- [ ] **本番用OAuthアプリの作成**
  - コールバックURL: `https://your-backend.workers.dev/auth/callback`

- [ ] **本番URLの設定**
  - ホームページURL
  - 認証コールバックURL

---

## 🧪 テスト

### セキュリティテスト

- [x] **JWT検証テスト計画**
  - ファイル: `issue/01-authentication-github.md:99-107`

- [x] **CSRF保護テスト計画**
  - ファイル: `issue/01-authentication-github.md:108-116`

- [x] **access_token暗号化テスト計画**
  - ファイル: `issue/01-authentication-github.md:117-126`

### 実装状況

- [ ] **セキュリティテストの実装**（Issue #01）
  - `backend/test/auth.security.test.ts`

- [ ] **統合テストの実装**（Issue #01）
  - `backend/test/auth.integration.test.ts`

---

## 📊 監視・アラート

### ログ監視

- [ ] **Cloudflare Workers ログの設定**
- [ ] **エラー率アラート設定**
- [ ] **不正アクセス検知**

### パフォーマンス

- [ ] **レート制限の実装**（OAuth エンドポイント）
- [ ] **DDoS対策**（Cloudflare自動）

---

## ✅ デプロイ前チェックリスト

### コード

- [ ] すべてのセキュリティ修正が完了
- [ ] セキュリティテストがパス
- [ ] カバレッジ80%以上

### 設定

- [ ] wrangler.toml にシークレット情報なし
- [ ] .dev.vars が .gitignore に含まれる
- [ ] CORS設定がホワイトリスト化
- [ ] 認証ミドルウェアが適切に適用

### 環境変数

- [ ] ローカル: .dev.vars 設定完了
- [ ] 本番: Cloudflare Secrets 設定完了
- [ ] GitHub OAuth アプリ作成完了

### CI/CD

- [ ] GitHub Actions でセキュリティスキャン実行
- [ ] すべてのCIチェックがパス
- [ ] デプロイワークフローの動作確認

---

## 🎯 優先度マトリクス

| 項目 | 優先度 | ステータス | 期限 |
|-----|-------|----------|------|
| wrangler.tomlのシークレット削除 | 🔴 Critical | ❌ 未完了 | 即時 |
| CORS設定の厳格化 | 🟡 High | ❌ 未完了 | Issue #01 |
| 認証ミドルウェア適用 | 🟡 High | ❌ 未完了 | Issue #01 |
| 暗号化キー長チェック | 🟢 Medium | ❌ 未完了 | Issue #01 |
| エラーメッセージ汎用化 | 🟢 Medium | ❌ 未完了 | 次回リリース |
| レート制限実装 | 🔵 Low | ❌ 未完了 | 将来 |
| CSPヘッダー設定 | 🔵 Low | ❌ 未完了 | 将来 |

---

## 📝 備考

### セキュリティベストプラクティス

1. **最小権限の原則**: 必要最低限の権限のみ付与
2. **多層防御**: 複数のセキュリティ層を実装
3. **フェイルセキュア**: エラー時は安全側に倒す
4. **セキュアバイデフォルト**: デフォルト設定で安全
5. **定期的な見直し**: 月次でセキュリティレビュー

### 参考リンク

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security Best Practices](https://developers.cloudflare.com/workers/platform/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
