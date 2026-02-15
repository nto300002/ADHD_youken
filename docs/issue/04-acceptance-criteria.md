# Issue #04: 受け入れ要件機能

## 概要
Given/When/Then形式の受け入れ要件を管理し、txt/pdf形式でエクスポートできる機能を実装します。クライアント共有や品質保証に利用します。

## スケジュール
**Day 4**: サイドバー + 受け入れ要件 + エクスポート

## タスクリスト

- [ ] 受け入れ要件CRUD API実装
  - [ ] POST `/api/notes` (type=acceptance)
  - [ ] PATCH `/api/notes/:id` (受け入れ要件更新)
  - [ ] acceptance_criteriaテーブルとの連携
- [ ] Given/When/Thenフォーム実装
  - [ ] 3つのテキストエリア
  - [ ] リアルタイムプレビュー
  - [ ] Gherkin形式バリデーション
- [ ] エクスポート機能
  - [ ] GET `/api/notes/:id/export/txt` - テキスト出力
  - [ ] GET `/api/notes/:id/export/pdf` - PDF出力
  - [ ] pdf-libを使用したPDF生成
  - [ ] フォーマット整形
- [ ] AcceptanceCriteriaコンポーネント
  - [ ] Given/When/Then セクション表示
  - [ ] is_metチェックボックス
  - [ ] エクスポートボタン

## テスト要件（TDDフロー）

### 単体テスト（Backend）

#### テスト1: 受け入れ要件作成
**ファイル**: `acceptance-criteria.test.ts`

**Given**: Given/When/Thenテキストを含むノートデータが送信された場合  
**When**: `POST /api/notes` (type=acceptance) を呼び出す  
**Then**:
- notesテーブルにノートが作成される
- acceptance_criteriaテーブルにエントリが作成される
- 3つのフィールドが正しく保存される

#### テスト2: 受け入れ要件更新
**ファイル**: `acceptance-criteria.test.ts`

**Given**: 既存の受け入れ要件のWhenテキストを変更する場合  
**When**: `PATCH /api/notes/:id` で when_text を更新  
**Then**:
- acceptance_criteriaレコードが更新される
- updated_atタイムスタンプが更新される

#### テスト3: テキストエクスポート
**ファイル**: `export.test.ts`

**Given**: 受け入れ要件ノートのIDが指定された場合  
**When**: `GET /api/notes/:id/export/txt` を呼び出す  
**Then**:
- Content-Type: text/plainのレスポンスが返される
- Given/When/Then がフォーマットされたテキストで返される
- ファイル名がContent-Dispositionヘッダーに含まれる

#### テスト4: PDF生成
**ファイル**: `export.test.ts`

**Given**: 受け入れ要件ノートのIDが指定された場合  
**When**: `GET /api/notes/:id/export/pdf` を呼び出す  
**Then**:
- Content-Type: application/pdfが返される
- pdf-libで生成された有効なPDFが返される
- Given/When/Thenセクションが含まれる

#### テスト5: フォーマット検証
**ファイル**: `export.test.ts`

**Given**: Given/When/Thenテキストに特殊文字が含まれる場合  
**When**: PDFまたはテキストエクスポートを実行  
**Then**:
- 特殊文字が正しくエスケープされる
- 改行が保持される
- 日本語が正しく表示される

### 単体テスト（Frontend）

#### テスト6: Given/When/Thenフォーム
**ファイル**: `AcceptanceCriteriaForm.test.tsx`

**Given**: フォームコンポーネントをレンダリングした場合  
**When**: 3つのテキストエリアが表示される  
**Then**:
- Givenラベルとテキストエリアが表示される
- Whenラベルとテキストエリアが表示される
- Thenラベルとテキストエリアが表示される

#### テスト7: リアルタイムプレビュー
**ファイル**: `AcceptanceCriteriaForm.test.tsx`

**Given**: Givenテキストエリアに「ユーザーがログインしている」と入力した場合  
**When**: プレビューセクションを確認する  
**Then**:
- プレビューに「Given: ユーザーがログインしている」が表示される
- Gherkin形式でハイライトされる

#### テスト8: バリデーション
**ファイル**: `AcceptanceCriteriaForm.test.tsx`

**Given**: 3つのフィールドのうち1つが空の場合  
**When**: 保存ボタンをクリックする  
**Then**:
- バリデーションエラーメッセージが表示される
- 保存処理が実行されない

#### テスト9: エクスポートボタン
**ファイル**: `AcceptanceCriteriaCard.test.tsx`

**Given**: 受け入れ要件カードのエクスポートボタンをクリックした場合  
**When**: ドロップダウンから「PDF」を選択  
**Then**:
- `/api/notes/:id/export/pdf` へのリクエストが送信される
- PDFファイルがダウンロードされる

### 統合テスト

#### テスト10: 受け入れ要件フルフロー
**ファイル**: `acceptance-criteria.integration.test.ts`

**Given**: 新規受け入れ要件を作成する場合  
**When**: Given/When/Thenを入力して保存し、PDFエクスポートする  
**Then**:
- ノートが作成される
- acceptance_criteriaレコードが作成される
- PDFエクスポートが成功する
- PDFに正しい内容が含まれる

### E2Eテスト

#### テスト11: 受け入れ要件作成フロー
**ファイル**: `acceptance-criteria.e2e.test.ts`

**Given**: モーダルで受け入れ要件タイプを選択した場合  
**When**: Given/When/Thenフォームに入力して保存  
**Then**:
- モーダルが閉じる
- 新しいカードが表示される
- カードに入力した内容が表示される

#### テスト12: PDFエクスポートフロー
**ファイル**: `acceptance-criteria.e2e.test.ts`

**Given**: 受け入れ要件カードのメニューを開いた場合  
**When**: 「PDFエクスポート」をクリック  
**Then**:
- ファイルダウンロードダイアログが表示される
- PDFファイルがダウンロードされる

### セキュリティテスト

#### テスト13: PDFインジェクション対策
**ファイル**: `export.security.test.ts`

**Given**: Givenテキストに悪意あるPDFコマンドが含まれる場合  
**When**: PDF生成を実行する  
**Then**:
- 特殊文字がエスケープされる
- PDFインジェクション攻撃が防がれる

## 技術スタック

### Backend
- Hono
- pdf-lib (PDF生成)
- Drizzle ORM

### Frontend
- React 18
- Tanstack Query

### Testing
- Jest
- React Testing Library
- pdf-parse (PDF検証用)

## 関連APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/notes | 作成 (type=acceptance) |
| PATCH | /api/notes/:id | 更新 |
| GET | /api/notes/:id/export/txt | テキスト出力 |
| GET | /api/notes/:id/export/pdf | PDF出力 |

## データモデル

### acceptance_criteria
```sql
CREATE TABLE acceptance_criteria (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
  given_text TEXT NOT NULL,
  when_text TEXT NOT NULL,
  then_text TEXT NOT NULL,
  is_met INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_acceptance_note ON acceptance_criteria(note_id);
```

## 受け入れ基準

- [ ] Given/When/Thenフォームが動作する
- [ ] リアルタイムプレビューが表示される
- [ ] テキストエクスポートが機能する
- [ ] PDFエクスポートが機能する
- [ ] PDFに日本語が正しく表示される
- [ ] 特殊文字がエスケープされる
- [ ] すべてのテストがパスする（カバレッジ80%以上）
