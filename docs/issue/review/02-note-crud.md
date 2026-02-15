# Issue #02: ノートCRUD

## 概要
メインとなるノート機能のCRUD操作を実装します。テキスト、チェックリスト、受け入れ要件の3タイプのノートを扱い、GitHub Issueとの同期機能も含みます。

## スケジュール
**Day 2**: GitHub連携 + ノートCRUD

## タスクリスト

- [ ] GitHub Issue同期機能
  - [ ] Issue取得API実装
  - [ ] Webhook受信エンドポイント
  - [ ] HMAC署名検証
  - [ ] Issue情報のDB保存
- [ ] ノートCRUD API実装
  - [ ] GET `/api/notes` - 一覧取得（フィルタ/ソート）
  - [ ] GET `/api/notes/:id` - 詳細取得
  - [ ] POST `/api/notes` - 作成
  - [ ] PATCH `/api/notes/:id` - 更新
  - [ ] DELETE `/api/notes/:id` - 削除（アーカイブ）
- [ ] NoteCardコンポーネント実装
  - [ ] カード表示
  - [ ] ピン留め機能
  - [ ] カラー変更
  - [ ] 展開/閉じ機能
- [ ] MasonryGrid実装
  - [ ] react-masonry-cssを使用したレイアウト
  - [ ] フィルタリング機能
  - [ ] ソート機能

## テスト要件（TDDフロー）

### 単体テスト

#### テスト1: ノート作成API
**ファイル**: `notes.test.ts`

**Given**: 有効なノートデータ（タイトル、タイプ、コンテンツ）が送信された場合  
**When**: `POST /api/notes` を呼び出す  
**Then**:
- ノートがDBに保存される
- 作成されたノート情報がレスポンスで返される
- ステータスコード201が返される

#### テスト2: ノート一覧取得（フィルタリング）
**ファイル**: `notes.test.ts`

**Given**: 複数のノートがDB内に存在し、カテゴリフィルタが指定された場合  
**When**: `GET /api/notes?category=Daily Job` を呼び出す  
**Then**:
- 指定されたカテゴリのノートのみが返される
- 結果が作成日時の降順でソートされる

#### テスト3: ノート更新（ピン留め）
**ファイル**: `notes.test.ts`

**Given**: 既存のノートのピン留め状態を変更する場合  
**When**: `PATCH /api/notes/:id` で `is_pinned: true` を送信  
**Then**:
- ノートのis_pinnedフィールドが更新される
- 更新されたノート情報が返される

#### テスト4: バリデーション - 無効なタイプ
**ファイル**: `notes.test.ts`

**Given**: 無効なノートタイプ（text/checklist/acceptance以外）が送信された場合  
**When**: `POST /api/notes` を呼び出す  
**Then**:
- 400 Bad Requestが返される
- バリデーションエラーメッセージが含まれる

#### テスト5: 権限チェック
**ファイル**: `notes.test.ts`

**Given**: 他のユーザーのノートを更新しようとした場合  
**When**: `PATCH /api/notes/:id` を呼び出す  
**Then**:
- 403 Forbiddenが返される
- ノートは更新されない

### 単体テスト（Frontend）

#### テスト6: NoteCardコンポーネント表示
**ファイル**: `NoteCard.test.tsx`

**Given**: ノートデータがpropsとして渡された場合  
**When**: NoteCardコンポーネントをレンダリングする  
**Then**:
- タイトルが表示される
- タイプに応じたアイコンが表示される
- 指定された色が適用される

#### テスト7: ピン留め機能
**ファイル**: `NoteCard.test.tsx`

**Given**: ピン留めボタンがクリックされた場合  
**When**: onPinToggleコールバックが呼ばれる  
**Then**:
- onPinToggleが正しいノートIDで呼ばれる
- ピン留めアイコンの状態が変わる

#### テスト8: カラー変更
**ファイル**: `NoteCard.test.tsx`

**Given**: カラーパレットから色を選択した場合  
**When**: onColorChangeコールバックが呼ばれる  
**Then**:
- onColorChangeが選択された色で呼ばれる
- カードの背景色が変更される

### 統合テスト

#### テスト9: GitHub Issue同期
**ファイル**: `github-sync.test.ts`

**Given**: GitHub Webhookからissue作成イベントが送信された場合  
**When**: `/api/webhooks/github` エンドポイントが呼ばれる  
**Then**:
- HMAC署名が検証される
- Issueデータが解析される
- issuesテーブルにIssueが保存される
- 200 OKが返される

#### テスト10: Issue紐付けノート作成
**ファイル**: `notes.integration.test.ts`

**Given**: Issue IDを指定してノートを作成する場合  
**When**: `POST /api/notes` で issue_id を含めて送信  
**Then**:
- ノートがIssueに紐付けられる
- `GET /api/issues/:id` でノート一覧が取得できる

### E2Eテスト

#### テスト11: ノート作成フロー
**ファイル**: `note-crud.e2e.test.ts`

**Given**: ダッシュボード画面で「メモを入力...」をクリックした場合  
**When**: モーダルでテキストを入力して保存ボタンをクリックする  
**Then**:
- モーダルが閉じる
- 新しいノートカードがMasonry上に表示される
- カードに入力したテキストが表示される

#### テスト12: ノート削除フロー
**ファイル**: `note-crud.e2e.test.ts`

**Given**: ノートカードの削除ボタンをクリックした場合  
**When**: 確認ダイアログでOKを選択する  
**Then**:
- ノートがアーカイブされる
- カードが画面から消える
- ゴミ箱セクションに移動する

### セキュリティテスト

#### テスト13: Webhook HMAC検証
**ファイル**: `github-sync.security.test.ts`

**Given**: 不正な署名を持つWebhookリクエストが送信された場合  
**When**: `/api/webhooks/github` エンドポイントが呼ばれる  
**Then**:
- 401 Unauthorizedが返される
- Webhookペイロードが処理されない

#### テスト14: XSS対策（ノートコンテンツ）
**ファイル**: `notes.security.test.ts`

**Given**: ノートコンテンツに`<script>`タグが含まれる場合  
**When**: ノートを作成して表示する  
**Then**:
- スクリプトがサニタイズされる
- HTMLエスケープされて表示される
- XSS攻撃が防がれる

## 技術スタック

### Backend
- Hono
- Drizzle ORM
- Octokit (GitHub API)
- crypto (HMAC検証)
- Zod (バリデーション)

### Frontend
- React 18
- Tanstack Query (データフェッチ)
- Zustand (状態管理)
- react-masonry-css
- react-markdown (MD表示)

### Testing
- Jest
- React Testing Library
- MSW
- @testing-library/user-event

## 関連APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/notes | 一覧（カテゴリ/Issue/ピン） |
| GET | /api/notes/:id | 詳細取得 |
| POST | /api/notes | 作成（テキスト/CL/受入） |
| PATCH | /api/notes/:id | 更新（色/ピン/並替） |
| DELETE | /api/notes/:id | 削除（アーカイブ） |
| POST | /api/webhooks/github | Webhook受信 |
| POST | /api/projects/:id/sync | Issue同期 |

## データモデル

### notes
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES issues(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('text', 'checklist', 'acceptance')),
  title TEXT NOT NULL,
  content TEXT, -- JSON or Markdown
  color TEXT DEFAULT '#fff9c4',
  is_pinned INTEGER DEFAULT 0,
  sort_order INTEGER,
  category TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### issues
```sql
CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  github_issue_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT DEFAULT 'open',
  priority TEXT,
  due_date TEXT,
  started_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 受け入れ基準

- [ ] ノートCRUD操作がすべて動作する
- [ ] GitHub Issue同期が正常に動作する
- [ ] Webhook HMAC検証が機能する
- [ ] ピン留めノートが上部に固定表示される
- [ ] Masonryレイアウトが正しく表示される
- [ ] すべてのテストがパスする（カバレッジ80%以上）
- [ ] XSS対策が実装されている
