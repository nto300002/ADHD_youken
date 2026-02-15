# Issue #03: チェックリスト機能

## 概要
ネスト可能なチェックリスト機能を実装します。プリセットテンプレートからの一括生成、カスタム項目追加、ホバー時の子アイテム追加ボタン、進捗バーなど、ADHD配慮UIを含みます。

## スケジュール
**Day 3**: Masonry + モーダル + チェックリスト

## タスクリスト

- [ ] チェックリストCRUD API実装
  - [ ] PATCH `/api/checklist-items/:id` - チェック状態更新
  - [ ] POST `/api/checklist-items` - 項目追加
  - [ ] PATCH `/api/checklist-items/:id/reorder` - 並替/ネスト変更
  - [ ] DELETE `/api/checklist-items/:id` - 項目削除
- [ ] テンプレート機能
  - [ ] GET `/api/templates` - テンプレート一覧
  - [ ] POST `/api/templates` - テンプレート作成
  - [ ] PUT `/api/templates/:id` - テンプレート更新
  - [ ] プリセット4カテゴリのシード投入
- [ ] ChecklistItemコンポーネント実装
  - [ ] チェック/アンチェック
  - [ ] ネスト表示（インデント）
  - [ ] ドラッグ&ドロップで並替
  - [ ] ホバー時に子アイテム追加ボタン表示
- [ ] CreateNoteModalのチェックリスト対応
  - [ ] タイプ選択UI
  - [ ] プリセット選択UI
  - [ ] 全選択ボタン
  - [ ] カスタム項目入力
- [ ] 進捗バー表示
  - [ ] チェック済み/全体の計算
  - [ ] プログレスバーアニメーション

## テスト要件（TDDフロー）

### 単体テスト（Backend）

#### テスト1: チェック状態更新
**ファイル**: `checklist.test.ts`

**Given**: チェックリスト項目のIDとis_checked値が送信された場合  
**When**: `PATCH /api/checklist-items/:id` を呼び出す  
**Then**:
- is_checkedフィールドが更新される
- checked_atタイムスタンプが記録される
- 更新された項目が返される

#### テスト2: ネスト項目追加
**ファイル**: `checklist.test.ts`

**Given**: 親項目のIDを指定して子項目を追加する場合  
**When**: `POST /api/checklist-items` で parent_id を含めて送信  
**Then**:
- 子項目がDBに保存される
- parent_idが正しく設定される
- sort_orderが親の子項目の最後に設定される

#### テスト3: テンプレート適用
**ファイル**: `checklist.test.ts`

**Given**: テンプレートIDを指定してノートを作成する場合  
**When**: `POST /api/notes` で template_id を含めて送信  
**Then**:
- テンプレートの項目が全てchecklist_itemsとして作成される
- ネスト構造が再現される
- is_checkedは全てfalseで初期化される

#### テスト4: 並替処理
**ファイル**: `checklist.test.ts`

**Given**: 項目の並び順を変更する場合  
**When**: `PATCH /api/checklist-items/:id/reorder` で new_order を送信  
**Then**:
- 該当項目のsort_orderが更新される
- 他の項目のsort_orderも必要に応じて調整される

### 単体テスト（Frontend）

#### テスト5: ChecklistItemレンダリング
**ファイル**: `ChecklistItem.test.tsx`

**Given**: チェックリスト項目データが渡された場合  
**When**: ChecklistItemコンポーネントをレンダリングする  
**Then**:
- テキストが表示される
- チェックボックスが表示される
- is_checkedがtrueの場合、チェックマークが表示される

#### テスト6: チェック/アンチェック
**ファイル**: `ChecklistItem.test.tsx`

**Given**: チェックボックスをクリックした場合  
**When**: onToggleコールバックが呼ばれる  
**Then**:
- onToggleが正しいitem IDで呼ばれる
- チェックマークの表示/非表示が切り替わる
- 打ち消し線が表示/非表示される

#### テスト7: ネスト表示
**ファイル**: `ChecklistItem.test.tsx`

**Given**: 子項目を持つ親項目をレンダリングする場合  
**When**: 子項目が存在する  
**Then**:
- 子項目がインデントして表示される
- 親項目の左にツリー展開アイコンが表示される
- 展開/折りたたみが機能する

#### テスト8: ホバー時の追加ボタン
**ファイル**: `ChecklistItem.test.tsx`

**Given**: チェックリスト項目にマウスをホバーした場合  
**When**: マウスがアイテム上にある  
**Then**:
- 右側に「+」追加ボタンが表示される
- ボタンをクリックすると子項目入力欄が表示される
- Enterキーで子項目が追加される

#### テスト9: ドラッグ&ドロップ並替
**ファイル**: `ChecklistItem.test.tsx`

**Given**: 項目をドラッグして別の位置にドロップした場合  
**When**: @dnd-kit/core でドラッグ操作を実行  
**Then**:
- onReorderコールバックが呼ばれる
- 項目の順序が視覚的に変更される

### 統合テスト

#### テスト10: テンプレートからチェックリスト生成
**ファイル**: `checklist.integration.test.ts`

**Given**: プリセットテンプレート「受託基本チェック」を選択した場合  
**When**: ノート作成でテンプレートを適用する  
**Then**:
- 4項目のチェックリストが作成される
- 全ての項目がチェックなしの状態
- ノートタイプが'checklist'に設定される

#### テスト11: 進捗計算
**ファイル**: `checklist.integration.test.ts`

**Given**: 10項目中3項目がチェック済みの場合  
**When**: 進捗率を計算する  
**Then**:
- 進捗率が30%と計算される
- プログレスバーが30%の幅で表示される

### E2Eテスト

#### テスト12: チェックリスト作成フロー
**ファイル**: `checklist.e2e.test.ts`

**Given**: モーダルでチェックリストタイプを選択した場合  
**When**: プリセット選択画面で「技術チェック」と「納品チェック」を選択して保存  
**Then**:
- 8項目（4+4）のチェックリストノートが作成される
- Masonry上にカードが表示される
- 進捗バーが0%で表示される

#### テスト13: ネスト追加フロー
**ファイル**: `checklist.e2e.test.ts`

**Given**: チェックリスト項目「ドメイン設定」にホバーした場合  
**When**: 「+」ボタンをクリックして「DNS設定」と入力してEnter  
**Then**:
- 「ドメイン設定」の下に「DNS設定」が子項目として追加される
- インデントされて表示される

### セキュリティテスト

#### テスト14: 権限チェック（項目更新）
**ファイル**: `checklist.security.test.ts`

**Given**: 他のユーザーのチェックリスト項目を更新しようとした場合  
**When**: `PATCH /api/checklist-items/:id` を呼び出す  
**Then**:
- 403 Forbiddenが返される
- 項目は更新されない

#### テスト15: XSS対策（項目テキスト）
**ファイル**: `checklist.security.test.ts`

**Given**: 項目テキストに`<img src=x onerror=alert(1)>`が含まれる場合  
**When**: 項目を作成して表示する  
**Then**:
- HTMLタグがエスケープされる
- スクリプトが実行されない

## 技術スタック

### Backend
- Hono
- Drizzle ORM
- Zod (バリデーション)

### Frontend
- React 18
- @dnd-kit/core (ドラッグ&ドロップ)
- Tanstack Query

### Testing
- Jest
- React Testing Library
- @testing-library/user-event
- MSW

## 関連APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| PATCH | /api/checklist-items/:id | チェック状態 |
| POST | /api/checklist-items | 項目追加 |
| PATCH | /api/checklist-items/:id/reorder | 並替/ネスト |
| DELETE | /api/checklist-items/:id | 項目削除 |
| GET | /api/templates | 一覧 |
| POST | /api/templates | 作成 |
| PUT | /api/templates/:id | 更新 |

## データモデル

### checklist_items
```sql
CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES checklist_items(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_checked INTEGER DEFAULT 0,
  sort_order INTEGER NOT NULL,
  checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_checklist_note ON checklist_items(note_id);
CREATE INDEX idx_checklist_parent ON checklist_items(parent_id);
```

### checklist_templates
```sql
CREATE TABLE checklist_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT,
  items TEXT NOT NULL, -- JSON配列
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 受け入れ基準

- [ ] チェック/アンチェックが即座に反映される
- [ ] ネスト構造が正しく表示される
- [ ] ホバー時の子アイテム追加ボタンが動作する
- [ ] ドラッグ&ドロップで並替ができる
- [ ] テンプレートから一括生成できる
- [ ] 進捗バーが正確に表示される
- [ ] すべてのテストがパスする（カバレッジ80%以上）
