# Issue #01: 認証・GitHub連携

## 概要
GitHub OAuthによるユーザー認証とセッション管理機能を実装します。JWT認証を使用してセキュアなAPI通信を実現し、GitHub Webhookの受信・検証機能も含みます。

## スケジュール
**Day 1**: 環境 + 認証 + テスト基盤

## タスクリスト

- [ ] Hono + Wrangler + D1 セットアップ
- [ ] Drizzle スキーマ定義（users, sessions）+ マイグレーション
- [ ] GitHub OAuth 実装
  - [ ] `/auth/github` エンドポイント（OAuth開始）
  - [ ] `/auth/callback` エンドポイント（コールバック処理）
  - [ ] GitHub API経由でユーザー情報取得
- [ ] JWT認証実装
  - [ ] JWT生成・検証ミドルウェア
  - [ ] access_tokenの暗号化保存
- [ ] Cloudflare KVセッション管理
- [ ] MSW セットアップ + テストユーティリティ
- [ ] CI: GitHub Actions (lint + test)

## テスト要件（TDDフロー）

### 単体テスト

#### テスト1: JWT生成・検証
**ファイル**: `auth.test.ts`

**Given**: 有効なユーザーIDとペイロードが与えられた場合  
**When**: JWT生成関数を呼び出す  
**Then**: 
- 署名済みJWTトークンが返される
- トークンをデコードすると元のペイロードが取得できる
- 有効期限が正しく設定されている

#### テスト2: OAuth開始エンドポイント
**ファイル**: `auth.test.ts`

**Given**: `/auth/github`にGETリクエストが送信された場合  
**When**: エンドポイントハンドラーが実行される  
**Then**:
- GitHub OAuth認証URLへのリダイレクトレスポンスが返される
- リダイレクトURLにclient_id、redirect_uri、scopeが含まれる
- CSRFトークンがセッションに保存される

#### テスト3: OAuthコールバック処理
**ファイル**: `auth.test.ts`

**Given**: GitHub OAuthコールバックでcodeパラメータが返された場合  
**When**: `/auth/callback`エンドポイントが呼び出される  
**Then**:
- codeを使用してaccess_tokenを取得する
- GitHub API経由でユーザー情報を取得する
- usersテーブルにユーザー情報を保存または更新する
- JWTトークンを生成してクッキーにセットする
- フロントエンドURLにリダイレクトする

### 統合テスト

#### テスト4: OAuth認証フロー全体
**ファイル**: `auth.integration.test.ts`

**Given**: 未認証ユーザーがアプリケーションにアクセスした場合  
**When**: OAuth認証フローを完了する  
**Then**:
- `/auth/github`からGitHubへリダイレクトされる
- GitHubでの認証後、`/auth/callback`が呼ばれる
- ユーザー情報がDBに保存される
- 有効なJWTトークンが発行される
- 保護されたAPIエンドポイントにアクセスできる

#### テスト5: セッション管理
**ファイル**: `session.integration.test.ts`

**Given**: 認証済みユーザーのJWTトークンが与えられた場合  
**When**: 保護されたAPIエンドポイントにリクエストを送信する  
**Then**:
- JWTミドルウェアがトークンを検証する
- リクエストコンテキストにユーザー情報が設定される
- APIレスポンスが正常に返される

### E2Eテスト

#### テスト6: エンドツーエンド認証フロー
**ファイル**: `auth.e2e.test.ts`

**Given**: ブラウザでアプリケーションを開いた場合  
**When**: ログインボタンをクリックしてOAuth認証を完了する  
**Then**:
- GitHubログイン画面が表示される
- 認証後、ダッシュボードにリダイレクトされる
- ユーザーのアバターと名前が表示される
- ログアウト機能が動作する

### セキュリティテスト

#### テスト7: JWT検証セキュリティ
**ファイル**: `auth.security.test.ts`

**Given**: 改ざんされたJWTトークンが送信された場合  
**When**: 保護されたエンドポイントにアクセスする  
**Then**:
- 401 Unauthorizedエラーが返される
- リクエストが拒否される

#### テスト8: CSRF保護
**ファイル**: `auth.security.test.ts`

**Given**: OAuth stateパラメータが一致しない場合  
**When**: `/auth/callback`エンドポイントが呼ばれる  
**Then**:
- 認証が失敗する
- エラーメッセージが返される

#### テスト9: access_token暗号化
**ファイル**: `auth.security.test.ts`

**Given**: GitHub access_tokenをDBに保存する場合  
**When**: 暗号化関数を使用する  
**Then**:
- 平文のトークンは保存されない
- 暗号化されたトークンがDBに保存される
- 復号化して元のトークンを取得できる

## 技術スタック

### Backend
- Hono (エッジAPI)
- hono/jwt (JWT認証)
- Octokit (GitHub API)
- Drizzle ORM
- Cloudflare KV (セッション)
- crypto (暗号化)

### Testing
- Jest
- MSW (GitHub APIモック)
- Hono テスト (app.request)

## 関連APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /auth/github | OAuth開始 |
| GET | /auth/callback | コールバック |
| POST | /auth/logout | ログアウト |
| GET | /auth/me | 現在のユーザー情報 |

## データモデル

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  login TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT, -- 暗号化
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### sessions (KV)
```typescript
interface Session {
  userId: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}
```

## 受け入れ基準

- [ ] GitHub OAuthフローが正常に動作する
- [ ] JWTトークンが正しく発行・検証される
- [ ] access_tokenが暗号化されてDBに保存される
- [ ] CSRFトークンが検証される
- [ ] すべてのテストがパスする（カバレッジ80%以上）
- [ ] セキュリティテストがパスする
