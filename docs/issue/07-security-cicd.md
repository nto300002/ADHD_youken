# Issue #07: セキュリティ・CI/CD

## 概要
セキュリティテスト（XSS、CSRF、SQLインジェクション、認証）とCI/CDパイプラインを実装します。全テストを自動化し、デプロイ前に品質を保証します。

## スケジュール
**Day 6-7**: ADHD配慮UI + 磨き込み + デプロイ + 仕上げ

## タスクリスト

- [ ] セキュリティテスト実装
  - [ ] auth.security.test.ts - JWT検証、権限チェック
  - [ ] xss.security.test.ts - 入力サニタイズ、出力エスケープ
  - [ ] csrf.security.test.ts - トークン検証
  - [ ] injection.security.test.ts - パラメータバインディング
- [ ] CI/CDパイプライン構築
  - [ ] GitHub Actions ワークフロー作成
  - [ ] lint: ESLint + Prettier
  - [ ] type-check: TypeScript型チェック
  - [ ] unit-test: Jest（カバレッジ80%）
  - [ ] integration-test: API統合テスト
  - [ ] security-scan: npm audit / Snyk
  - [ ] build-test: Vite build / Wrangler deploy --dry-run
- [ ] デプロイメント
  - [ ] Cloudflare Pages デプロイ（Frontend）
  - [ ] Cloudflare Workers デプロイ（Backend）
  - [ ] カスタムドメイン設定
  - [ ] CORS最終設定
- [ ] 品質保証
  - [ ] カバレッジレポート確認
  - [ ] E2E動作確認
  - [ ] パフォーマンス測定

## テスト要件（TDDフロー）

### セキュリティテスト

#### テスト1: JWT改ざん検証
**ファイル**: `auth.security.test.ts`

**Given**: JWTトークンの署名部分が改ざんされた場合  
**When**: 保護されたエンドポイントにアクセスする  
**Then**:
- 401 Unauthorizedが返される
- エラーメッセージに「Invalid signature」が含まれる
- リクエストが拒否される

#### テスト2: 権限チェック（他ユーザーリソース）
**ファイル**: `auth.security.test.ts`

**Given**: ユーザーAが ユーザーBのノートを削除しようとした場合  
**When**: `DELETE /api/notes/:id` を呼び出す  
**Then**:
- 403 Forbiddenが返される
- ノートは削除されない
- アクセスログに記録される

#### テスト3: XSS対策（入力サニタイズ）
**ファイル**: `xss.security.test.ts`

**Given**: ノートタイトルに`<script>alert('XSS')</script>`が含まれる場合  
**When**: ノートを作成する  
**Then**:
- スクリプトタグがエスケープされる
- DBには`&lt;script&gt;alert('XSS')&lt;/script&gt;`として保存される

#### テスト4: XSS対策（出力エスケープ）
**ファイル**: `xss.security.test.ts`

**Given**: 悪意あるHTMLがDBに保存されている場合  
**When**: ノートを表示する  
**Then**:
- react-markdownがHTMLを無害化する
- スクリプトが実行されない
- リンクにrel="noopener noreferrer"が付与される

#### テスト5: CSRF保護
**ファイル**: `csrf.security.test.ts`

**Given**: CSRFトークンなしでPOSTリクエストが送信された場合  
**When**: `POST /api/notes` を呼び出す  
**Then**:
- 403 Forbiddenが返される
- エラーメッセージに「CSRF token missing」が含まれる

#### テスト6: CSRF保護（トークン不一致）
**ファイル**: `csrf.security.test.ts`

**Given**: 無効なCSRFトークンでリクエストが送信された場合  
**When**: `POST /api/notes` を呼び出す  
**Then**:
- 403 Forbiddenが返される
- リクエストが拒否される

#### テスト7: SQLインジェクション対策
**ファイル**: `injection.security.test.ts`

**Given**: issue_id パラメータに `'; DROP TABLE notes; --` が含まれる場合  
**When**: `GET /api/notes?issue_id=...` を呼び出す  
**Then**:
- Drizzle ORMがパラメータをバインドする
- SQLインジェクションが防がれる
- notesテーブルは削除されない

#### テスト8: レートリミット
**ファイル**: `rate-limit.security.test.ts`

**Given**: 同一IPから1分間に100回以上リクエストが送信された場合  
**When**: 101回目のリクエストを送信  
**Then**:
- 429 Too Many Requestsが返される
- Retry-Afterヘッダーが含まれる

### CI/CDテスト

#### テスト9: lint チェック
**ファイル**: CI/CDパイプライン

**Given**: コードにESLintエラーがある場合  
**When**: `pnpm run lint` を実行  
**Then**:
- エラーが検出される
- 終了コード1が返される
- CI/CDパイプラインが失敗する

#### テスト10: 型チェック
**ファイル**: CI/CDパイプライン

**Given**: TypeScript型エラーがある場合  
**When**: `tsc --noEmit` を実行  
**Then**:
- 型エラーが検出される
- CI/CDパイプラインが失敗する

#### テスト11: 単体テストカバレッジ
**ファイル**: CI/CDパイプライン

**Given**: カバレッジが80%未満の場合  
**When**: `pnpm run test:coverage` を実行  
**Then**:
- カバレッジレポートが生成される
- 終了コード1が返される
- CI/CDパイプラインが失敗する

#### テスト12: セキュリティスキャン
**ファイル**: CI/CDパイプライン

**Given**: 依存関係に脆弱性がある場合  
**When**: `npm audit` または `snyk test` を実行  
**Then**:
- 脆弱性が検出される
- 深刻度が表示される
- CI/CDパイプラインが失敗する

#### テスト13: ビルドテスト
**ファイル**: CI/CDパイプライン

**Given**: 本番用ビルドを実行する場合  
**When**: `pnpm run build` を実行  
**Then**:
- ビルドが成功する
- dist/フォルダにファイルが生成される
- 警告が0件である

### 統合テスト

#### テスト14: CI/CDパイプライン全体
**ファイル**: GitHub Actions

**Given**: Pull Requestが作成された場合  
**When**: GitHub Actionsワークフローが実行される  
**Then**:
- lint、type-check、unit-testが全て実行される
- 全てのテストがパスする
- PRステータスチェックが緑になる

#### テスト15: デプロイフロー
**ファイル**: GitHub Actions

**Given**: mainブランチにマージされた場合  
**When**: デプロイワークフローが実行される  
**Then**:
- 全テストが実行される
- セキュリティスキャンがパスする
- ビルドが成功する
- Cloudflare Pages/Workersにデプロイされる

### E2Eテスト

#### テスト16: セキュリティヘッダー確認
**ファイル**: `security.e2e.test.ts`

**Given**: 本番環境にデプロイされた場合  
**When**: ページのHTTPレスポンスヘッダーを確認する  
**Then**:
- Content-Security-Policyヘッダーが設定されている
- X-Frame-Options: DENYが設定されている
- X-Content-Type-Options: nosniffが設定されている

## 技術スタック

### Backend
- Hono (セキュリティミドルウェア)
- crypto (CSRF トークン)

### CI/CD
- GitHub Actions
- ESLint + Prettier
- TypeScript
- Jest
- npm audit / Snyk
- Wrangler CLI

### Deployment
- Cloudflare Pages (Frontend)
- Cloudflare Workers (Backend)

## 関連APIエンドポイント

すべてのエンドポイントにセキュリティ対策を適用

## セキュリティ対策

### 実装済み対策
- JWT認証
- CSRF保護
- XSS対策（入力サニタイズ + 出力エスケープ）
- SQLインジェクション対策（パラメータバインディング）
- レートリミット
- HTTPS強制
- セキュアヘッダー
- access_token暗号化

### CI/CDパイプライン

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run type-check
      - run: pnpm run test:coverage
      - run: pnpm run test:integration
      - run: npm audit
      - run: pnpm run build

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: wrangler publish
      - run: wrangler pages publish
```

## 受け入れ基準

- [ ] 全セキュリティテストがパスする
- [ ] CI/CDパイプラインが動作する
- [ ] カバレッジが80%以上
- [ ] 脆弱性スキャンがクリーン
- [ ] 本番デプロイが成功する
- [ ] セキュリティヘッダーが設定されている
- [ ] レートリミットが機能する
