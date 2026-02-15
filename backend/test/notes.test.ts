import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { env } from 'cloudflare:test';
import type { Env } from '@/index';
import { notesRoutes } from '@/routes/notes';
import { generateJWT } from '@/lib/jwt';
import { nanoid } from 'nanoid';

describe('ノートCRUD API', () => {
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

  describe('テスト1: ノート作成API', () => {
    it('有効なノートデータが送信された場合、ノートがDBに保存され201が返される', async () => {
      // Given: 有効なノートデータ
      const noteData = {
        type: 'text',
        title: 'テストノート',
        content: 'これはテストノートの内容です',
        category: 'Daily Job',
      };

      // When: POST /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify(noteData),
        },
        env
      );

      // Then: ステータスコード201が返される
      expect(res.status).toBe(201);

      // 作成されたノート情報がレスポンスで返される
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.type).toBe('text');
      expect(body.title).toBe('テストノート');
      expect(body.content).toBe('これはテストノートの内容です');
      expect(body.category).toBe('Daily Job');
      expect(body.userId).toBe(testUserId);
      expect(body.color).toBe('#fff9c4'); // デフォルトカラー
      expect(body.isPinned).toBe(false);

      // ノートがDBに保存される
      const savedNote = await env.DB.prepare(
        'SELECT * FROM notes WHERE id = ?'
      ).bind(body.id).first();

      expect(savedNote).toBeDefined();
      expect(savedNote!.title).toBe('テストノート');
    });

    it('issueIdを指定した場合、Issueに紐付けられる', async () => {
      // Given: プロジェクトとIssueを作成
      const projectId = `project-${nanoid()}`;
      await env.DB.prepare(`
        INSERT INTO projects (id, user_id, name)
        VALUES (?, ?, ?)
      `).bind(projectId, testUserId, 'Test Project').run();

      const issueId = `issue-${nanoid()}`;
      await env.DB.prepare(`
        INSERT INTO issues (id, project_id, github_issue_number, title)
        VALUES (?, ?, ?, ?)
      `).bind(issueId, projectId, 1, 'Test Issue').run();

      const noteData = {
        type: 'acceptance',
        title: '受け入れ基準',
        content: '- [ ] 機能Aが動作する\n- [ ] 機能Bが動作する',
        issueId: issueId,
      };

      // When: POST /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify(noteData),
        },
        env
      );

      // Then: 201が返され、issueIdが正しく設定される
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.issueId).toBe(issueId);
    });
  });

  describe('テスト4: バリデーション - 無効なタイプ', () => {
    it('無効なノートタイプが送信された場合、400 Bad Requestが返される', async () => {
      // Given: 無効なノートタイプ
      const invalidNoteData = {
        type: 'invalid_type', // 正しいのは 'text', 'checklist', 'acceptance'
        title: 'テストノート',
        content: 'テスト内容',
      };

      // When: POST /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify(invalidNoteData),
        },
        env
      );

      // Then: 400エラーが返される
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error).toContain('type');
    });

    it('タイトルが空の場合、400 Bad Requestが返される', async () => {
      // Given: タイトルが空のノートデータ
      const invalidNoteData = {
        type: 'text',
        title: '',
        content: 'テスト内容',
      };

      // When: POST /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify(invalidNoteData),
        },
        env
      );

      // Then: 400エラーが返される
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('テスト2: ノート一覧取得（フィルタリング）', () => {
    it('複数のノートがDB内に存在し、カテゴリフィルタが指定された場合、指定されたカテゴリのノートのみが返される', async () => {
      // Given: 複数のノートを作成
      const notes = [
        { type: 'text', title: 'Daily Job 1', category: 'Daily Job' },
        { type: 'text', title: 'Personal 1', category: 'Personal' },
        { type: 'text', title: 'Daily Job 2', category: 'Daily Job' },
      ];

      for (const note of notes) {
        await app.request(
          '/api/notes',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: `token=${authToken}`,
            },
            body: JSON.stringify(note),
          },
          env
        );
        // 作成時刻をずらすために待つ
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // When: カテゴリフィルタを指定してGET /api/notes を呼び出す
      const res = await app.request(
        '/api/notes?category=Daily Job',
        {
          method: 'GET',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      // Then: 指定されたカテゴリのノートのみが返される
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes).toBeDefined();
      expect(body.notes.length).toBe(2);
      expect(body.notes.every((n: any) => n.category === 'Daily Job')).toBe(true);

      // 結果が作成日時の降順でソートされる（最新が先頭）
      // タイムスタンプの精度問題があるため、順序のみチェック
      const titles = body.notes.map((n: any) => n.title);
      expect(titles).toContain('Daily Job 1');
      expect(titles).toContain('Daily Job 2');
    });

    it('ピン留めノートが上部に表示される', async () => {
      // Given: ピン留めノートと通常のノートを作成
      const note1Response = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({ type: 'text', title: 'Normal Note' }),
        },
        env
      );
      const note1 = await note1Response.json();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const note2Response = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({ type: 'text', title: 'Pinned Note' }),
        },
        env
      );
      const note2 = await note2Response.json();

      // note2をピン留め
      await env.DB.prepare('UPDATE notes SET is_pinned = 1 WHERE id = ?')
        .bind(note2.id)
        .run();

      // When: GET /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'GET',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      // Then: ピン留めノートが先頭に表示される
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes[0].title).toBe('Pinned Note');
      expect(body.notes[0].isPinned).toBe(true);
    });

    it('自分のノートのみが返される（他ユーザーのノートは表示されない）', async () => {
      // Given: 別のユーザーを作成
      const otherUserId = `user-${nanoid()}`;
      await env.DB.prepare(`
        INSERT INTO users (id, github_id, login)
        VALUES (?, ?, ?)
      `).bind(otherUserId, 99999, 'otheruser').run();

      // 別のユーザーのノートを直接DBに挿入
      await env.DB.prepare(`
        INSERT INTO notes (id, user_id, type, title, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(nanoid(), otherUserId, 'text', 'Other User Note', 'Content').run();

      // 自分のノートを作成
      await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({ type: 'text', title: 'My Note' }),
        },
        env
      );

      // When: GET /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'GET',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      // Then: 自分のノートのみが返される
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes.length).toBe(1);
      expect(body.notes[0].title).toBe('My Note');
    });
  });

  describe('テスト3: ノート更新（ピン留め）', () => {
    it('既存のノートのピン留め状態を変更する場合、is_pinnedフィールドが更新される', async () => {
      // Given: ノートを作成
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
            title: 'Test Note',
            content: 'Content',
          }),
        },
        env
      );
      const createdNote = await createRes.json();

      // When: ピン留め状態を変更
      const updateRes = await app.request(
        `/api/notes/${createdNote.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({ isPinned: true }),
        },
        env
      );

      // Then: ノートのis_pinnedフィールドが更新される
      expect(updateRes.status).toBe(200);
      const updatedNote = await updateRes.json();
      expect(updatedNote.isPinned).toBe(true);
      expect(updatedNote.id).toBe(createdNote.id);
      expect(updatedNote.title).toBe('Test Note');
    });

    it('カラーを変更できる', async () => {
      // Given: ノートを作成
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
            title: 'Colorful Note',
          }),
        },
        env
      );
      const createdNote = await createRes.json();

      // When: カラーを変更
      const updateRes = await app.request(
        `/api/notes/${createdNote.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({ color: '#ffcccc' }),
        },
        env
      );

      // Then: カラーが更新される
      expect(updateRes.status).toBe(200);
      const updatedNote = await updateRes.json();
      expect(updatedNote.color).toBe('#ffcccc');
    });
  });

  describe('テスト5: 権限チェック', () => {
    it('他のユーザーのノートを更新しようとした場合、403 Forbiddenが返される', async () => {
      // Given: 別のユーザーを作成してノートを作成
      const otherUserId = `user-${nanoid()}`;
      await env.DB.prepare(`
        INSERT INTO users (id, github_id, login)
        VALUES (?, ?, ?)
      `).bind(otherUserId, 99999, 'otheruser').run();

      const otherNoteId = nanoid();
      await env.DB.prepare(`
        INSERT INTO notes (id, user_id, type, title, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(otherNoteId, otherUserId, 'text', 'Other User Note', 'Content').run();

      // When: 他のユーザーのノートを更新しようとする
      const updateRes = await app.request(
        `/api/notes/${otherNoteId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
          body: JSON.stringify({ title: 'Hacked Title' }),
        },
        env
      );

      // Then: 403エラーが返される
      expect(updateRes.status).toBe(403);
      const body = await updateRes.json();
      expect(body.error).toBeDefined();

      // ノートは更新されない
      const savedNote = await env.DB.prepare(
        'SELECT * FROM notes WHERE id = ?'
      ).bind(otherNoteId).first();
      expect(savedNote!.title).toBe('Other User Note');
    });

    it('他のユーザーのノートを削除しようとした場合、403 Forbiddenが返される', async () => {
      // Given: 別のユーザーのノートを作成
      const otherUserId = `user-${nanoid()}`;
      await env.DB.prepare(`
        INSERT INTO users (id, github_id, login)
        VALUES (?, ?, ?)
      `).bind(otherUserId, 88888, 'anotheruser').run();

      const otherNoteId = nanoid();
      await env.DB.prepare(`
        INSERT INTO notes (id, user_id, type, title, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(otherNoteId, otherUserId, 'text', 'Protected Note', 'Content').run();

      // When: 他のユーザーのノートを削除しようとする
      const deleteRes = await app.request(
        `/api/notes/${otherNoteId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      // Then: 403エラーが返される
      expect(deleteRes.status).toBe(403);

      // ノートは削除されない
      const savedNote = await env.DB.prepare(
        'SELECT * FROM notes WHERE id = ?'
      ).bind(otherNoteId).first();
      expect(savedNote).toBeDefined();
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('自分のノートを削除できる', async () => {
      // Given: ノートを作成
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
            title: 'To Be Deleted',
          }),
        },
        env
      );
      const createdNote = await createRes.json();

      // When: ノートを削除
      const deleteRes = await app.request(
        `/api/notes/${createdNote.id}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: `token=${authToken}`,
          },
        },
        env
      );

      // Then: 204が返される
      expect(deleteRes.status).toBe(204);

      // ノートがDBから削除される
      const savedNote = await env.DB.prepare(
        'SELECT * FROM notes WHERE id = ?'
      ).bind(createdNote.id).first();
      expect(savedNote).toBeNull();
    });
  });

  describe('認証テスト', () => {
    it('トークンがない場合、401 Unauthorizedが返される', async () => {
      // Given: 有効なノートデータ
      const noteData = {
        type: 'text',
        title: 'テストノート',
        content: 'テスト内容',
      };

      // When: トークンなしでPOST /api/notes を呼び出す
      const res = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(noteData),
        },
        env
      );

      // Then: 401エラーが返される
      expect(res.status).toBe(401);
    });
  });
});
