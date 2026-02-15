import { beforeAll } from 'vitest';
import { env } from 'cloudflare:test';

// テスト開始前にDBマイグレーションを実行
beforeAll(async () => {
  // usersテーブルを作成
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      github_id INTEGER NOT NULL,
      login TEXT NOT NULL,
      avatar_url TEXT,
      access_token TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // インデックスを作成
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id)
  `).run();

  // projectsテーブルを作成
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      github_repo_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  // issuesテーブルを作成
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      github_issue_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      state TEXT DEFAULT 'open',
      priority TEXT,
      due_date TEXT,
      started_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `).run();

  // notesテーブルを作成
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      issue_id TEXT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      color TEXT DEFAULT '#fff9c4',
      is_pinned INTEGER DEFAULT 0,
      sort_order INTEGER,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_id) REFERENCES issues(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  console.log('✓ Test database initialized (users, projects, issues, notes)');
});
