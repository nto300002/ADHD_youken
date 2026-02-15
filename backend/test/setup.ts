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

  console.log('✓ Test database initialized');
});
