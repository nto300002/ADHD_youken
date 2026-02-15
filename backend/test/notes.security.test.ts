import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { env } from 'cloudflare:test';
import type { Env } from '@/index';
import { notesRoutes } from '@/routes/notes';
import { generateJWT } from '@/lib/jwt';
import { nanoid } from 'nanoid';

describe('ノートセキュリティテスト', () => {
  let app: Hono<{ Bindings: Env }>;
  let testUserId: string;
  let authToken: string;

  beforeEach(async () => {
    // テストユーザーを作成
    testUserId = `user-${nanoid()}`;
    await env.DB.prepare(`
      INSERT INTO users (id, github_id, login)
      VALUES (?, ?, ?)
    `).bind(testUserId, 12345, 'testuser').run();

    // 認証トークンを生成
    authToken = await generateJWT(
      { userId: testUserId, login: 'testuser' },
      env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_chars_long'
    );

    // アプリケーションをセットアップ
    app = new Hono<{ Bindings: Env }>();
    app.route('/api/notes', notesRoutes);
  });

  describe('テスト14: XSS対策（ノートコンテンツ）', () => {
    it('ノートコンテンツに<script>タグが含まれる場合、そのまま保存される（サニタイズはフロントエンドで行う）', async () => {
      // Given: <script>タグを含むノートコンテンツ
      const maliciousContent = '<script>alert("XSS")</script>This is a note';

      // When: ノートを作成
      const createRes = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            type: 'text',
            title: 'Test Note with Script',
            content: maliciousContent,
          }),
        },
        env
      );

      // Then: ノートが作成される
      expect(createRes.status).toBe(201);
      const createdNote = await createRes.json();

      // コンテンツがそのまま保存される（バックエンドではサニタイズしない）
      expect(createdNote.content).toBe(maliciousContent);

      // DBから取得しても同じ内容
      const savedNote = await env.DB.prepare(
        'SELECT * FROM notes WHERE id = ?'
      ).bind(createdNote.id).first();

      expect(savedNote!.content).toBe(maliciousContent);
    });

    it('ノートタイトルに<img>タグが含まれる場合、そのまま保存される', async () => {
      // Given: <img>タグを含むタイトル
      const maliciousTitle = '<img src=x onerror=alert("XSS")>Malicious Title';

      // When: ノートを作成
      const createRes = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            type: 'text',
            title: maliciousTitle,
            content: 'Normal content',
          }),
        },
        env
      );

      // Then: ノートが作成される
      expect(createRes.status).toBe(201);
      const createdNote = await createRes.json();

      // タイトルがそのまま保存される
      expect(createdNote.title).toBe(maliciousTitle);
    });

    it('ノート一覧取得時、コンテンツがそのまま返される（フロントエンドでエスケープが必要）', async () => {
      // Given: XSSペイロードを含むノートを作成
      const xssPayload = '<script>document.cookie</script>';
      const createRes = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            type: 'text',
            title: 'XSS Test',
            content: xssPayload,
          }),
        },
        env
      );

      const createdNote = await createRes.json();

      // When: ノート一覧を取得
      const listRes = await app.request(
        '/api/notes',
        {
          method: 'GET',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      // Then: コンテンツがそのまま返される
      expect(listRes.status).toBe(200);
      const body = await listRes.json();

      const note = body.notes.find((n: any) => n.id === createdNote.id);
      expect(note).toBeDefined();
      expect(note.content).toBe(xssPayload);
    });

    it('ノート更新時、XSSペイロードを含むコンテンツに更新できる', async () => {
      // Given: 通常のノートを作成
      const createRes = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            type: 'text',
            title: 'Normal Note',
            content: 'Normal content',
          }),
        },
        env
      );

      const createdNote = await createRes.json();

      // When: XSSペイロードを含むコンテンツに更新
      const maliciousUpdate = '<iframe src="javascript:alert(1)"></iframe>';
      const updateRes = await app.request(
        `/api/notes/${createdNote.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            content: maliciousUpdate,
          }),
        },
        env
      );

      // Then: 更新が成功する
      expect(updateRes.status).toBe(200);
      const updatedNote = await updateRes.json();

      // コンテンツがそのまま保存される
      expect(updatedNote.content).toBe(maliciousUpdate);
    });
  });

  describe('追加のセキュリティテスト', () => {
    it('非常に長いコンテンツ（DoS攻撃）を送信した場合も正常に処理される', async () => {
      // Given: 非常に長いコンテンツ（100KB）
      const longContent = 'A'.repeat(100000);

      // When: ノートを作成
      const createRes = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            type: 'text',
            title: 'Long Content Note',
            content: longContent,
          }),
        },
        env
      );

      // Then: ノートが作成される
      expect(createRes.status).toBe(201);
      const createdNote = await createRes.json();
      expect(createdNote.content.length).toBe(100000);
    });

    it('SQLインジェクション攻撃を試みても安全（Drizzle ORMが保護）', async () => {
      // Given: SQLインジェクション用のペイロード
      const sqlInjection = "'; DROP TABLE notes; --";

      // When: タイトルにSQLインジェクションを含むノートを作成
      const createRes = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({
            type: 'text',
            title: sqlInjection,
            content: 'Test content',
          }),
        },
        env
      );

      // Then: ノートが正常に作成される
      expect(createRes.status).toBe(201);
      const createdNote = await createRes.json();
      expect(createdNote.title).toBe(sqlInjection);

      // notesテーブルがまだ存在することを確認
      const verifyRes = await app.request(
        '/api/notes',
        {
          method: 'GET',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      expect(verifyRes.status).toBe(200);
    });
  });
});
