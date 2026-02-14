# Issue #05: ダッシュボード・チャート

## 概要
ガントチャートとバーンダウンチャートを実装し、Issue進捗の可視化とマイクロ進捗管理を実現します。抜け漏れ検出機能も含みます。

## スケジュール
**Day 5**: ダッシュボード（ガント + バーンダウン）

## タスクリスト

- [ ] ダッシュボード統計API実装
  - [ ] GET `/api/dashboard/stats` - 統計情報
  - [ ] GET `/api/dashboard/gantt` - ガントチャートデータ
  - [ ] GET `/api/dashboard/burndown` - バーンダウンデータ
  - [ ] GET `/api/dashboard/leaks` - 抜け漏れ一覧
- [ ] GanttChartコンポーネント実装
  - [ ] recharts BarChart（横向き）
  - [ ] Issue単位のバー表示
  - [ ] 進捗率の視覚化
  - [ ] 期限超過のハイライト
- [ ] BurndownChartコンポーネント実装
  - [ ] recharts LineChart
  - [ ] 理想線（破線）
  - [ ] 実績線
  - [ ] 日次データプロット
- [ ] チャート切り替えUI
  - [ ] タブボタン
  - [ ] アニメーション遷移
- [ ] 抜け漏れ検出ロジック
  - [ ] 期限切れIssue検出
  - [ ] 未着手Issue検出
  - [ ] テスト要件未完Issue検出
  - [ ] アラート表示

## テスト要件（TDDフロー）

### 単体テスト（Backend）

#### テスト1: 統計情報取得
**ファイル**: `dashboard.test.ts`

**Given**: プロジェクトに10個のIssueがある場合  
**When**: `GET /api/dashboard/stats` を呼び出す  
**Then**:
- 総Issue数が返される
- 完了Issue数が返される
- 進行中Issue数が返される
- 期限超過Issue数が返される

#### テスト2: ガントチャートデータ生成
**ファイル**: `dashboard.test.ts`

**Given**: 複数のIssueにstarted_atとdue_dateが設定されている場合  
**When**: `GET /api/dashboard/gantt` を呼び出す  
**Then**:
- 各IssueのID、タイトル、開始日、期限、進捗率が返される
- 日付がISO 8601形式で返される
- 期限超過フラグが正しく設定される

#### テスト3: バーンダウンデータ計算
**ファイル**: `dashboard.test.ts`

**Given**: スプリント期間が7日間で、日次のチェック項目数履歴がある場合  
**When**: `GET /api/dashboard/burndown` を呼び出す  
**Then**:
- 理想線データ（直線）が返される
- 実績線データ（実際の残タスク数）が返される
- 日付ラベルが返される

#### テスト4: 抜け漏れ検出
**ファイル**: `dashboard.test.ts`

**Given**: 期限切れIssue、未着手Issue、テスト未完Issueが存在する場合  
**When**: `GET /api/dashboard/leaks` を呼び出す  
**Then**:
- 各カテゴリの抜け漏れIssueリストが返される
- Issue ID、タイトル、深刻度が含まれる

### 単体テスト（Frontend）

#### テスト5: GanttChartレンダリング
**ファイル**: `GanttChart.test.tsx`

**Given**: ガントチャートデータが渡された場合  
**When**: GanttChartコンポーネントをレンダリングする  
**Then**:
- rechartsのBarChartが表示される
- 各Issueのバーが表示される
- X軸に日付ラベルが表示される
- Y軸にIssueタイトルが表示される

#### テスト6: 期限超過ハイライト
**ファイル**: `GanttChart.test.tsx`

**Given**: 期限超過Issueがデータに含まれる場合  
**When**: チャートを表示する  
**Then**:
- 該当Issueのバーが赤色でハイライトされる
- ツールチップに「期限超過」と表示される

#### テスト7: 進捗率の視覚化
**ファイル**: `GanttChart.test.tsx`

**Given**: Issueの進捗率が60%の場合  
**When**: チャートを表示する  
**Then**:
- バー内に60%まで濃い色が塗られる
- 残り40%が薄い色で表示される

#### テスト8: BurndownChartレンダリング
**ファイル**: `BurndownChart.test.tsx`

**Given**: バーンダウンデータが渡された場合  
**When**: BurndownChartコンポーネントをレンダリングする  
**Then**:
- rechartsのLineChartが表示される
- 理想線が破線で表示される
- 実績線が実線で表示される

#### テスト9: データ反映
**ファイル**: `BurndownChart.test.tsx`

**Given**: 実績データが理想線を上回っている場合  
**When**: チャートを表示する  
**Then**:
- 実績線が理想線より上に表示される
- 遅延を視覚的に確認できる

### 統合テスト

#### テスト10: チャート切り替え
**ファイル**: `dashboard.integration.test.tsx`

**Given**: ダッシュボード画面でガントチャートが表示されている場合  
**When**: 「バーンダウンチャート」タブをクリックする  
**Then**:
- ガントチャートが非表示になる
- バーンダウンチャートが表示される
- データが正しく読み込まれる

### E2Eテスト

#### テスト11: ダッシュボード表示フロー
**ファイル**: `dashboard.e2e.test.ts`

**Given**: サイドバーの「マイクロ進捗」メニューをクリックした場合  
**When**: ダッシュボード画面に遷移する  
**Then**:
- 統計情報カードが表示される
- ガントチャートがデフォルトで表示される
- チャート切り替えタブが表示される

#### テスト12: 抜け漏れアラート
**ファイル**: `dashboard.e2e.test.ts`

**Given**: 期限超過Issueが2件存在する場合  
**When**: ダッシュボードを開く  
**Then**:
- アラートバナーが表示される
- 「期限超過: 2件」と表示される
- クリックすると抜け漏れ一覧が表示される

### セキュリティテスト

#### テスト13: データアクセス権限
**ファイル**: `dashboard.security.test.ts`

**Given**: 他のユーザーのプロジェクトIDでダッシュボードデータを取得しようとした場合  
**When**: `GET /api/dashboard/stats` を呼び出す  
**Then**:
- 403 Forbiddenが返される
- データが漏洩しない

## 技術スタック

### Backend
- Hono
- Drizzle ORM (データ集計)

### Frontend
- React 18
- recharts (チャート)
- Tanstack Query

### Testing
- Jest
- React Testing Library
- recharts-to-png (チャートスナップショットテスト)

## 関連APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/dashboard/stats | 統計 |
| GET | /api/dashboard/gantt | ガントデータ |
| GET | /api/dashboard/burndown | バーンダウンデータ |
| GET | /api/dashboard/leaks | 抜け漏れ一覧 |

## データモデル

主に既存テーブル（issues, checklist_items）からデータを集計します。

### ダッシュボード統計データ（計算結果）
```typescript
interface DashboardStats {
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  overdueIssues: number;
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
}
```

### ガントチャートデータ
```typescript
interface GanttData {
  issueId: string;
  title: string;
  startDate: string;
  dueDate: string;
  progress: number; // 0-1
  isOverdue: boolean;
}
```

### バーンダウンデータ
```typescript
interface BurndownData {
  dates: string[];
  idealLine: number[];
  actualLine: number[];
}
```

## 受け入れ基準

- [ ] ガントチャートが正しく表示される
- [ ] バーンダウンチャートが正しく表示される
- [ ] 期限超過が赤でハイライトされる
- [ ] チャート切り替えが動作する
- [ ] 抜け漏れ検出が機能する
- [ ] マイクロ進捗メニューから遷移できる
- [ ] すべてのテストがパスする（カバレッジ80%以上）
