import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { Env } from '@/index';
import { authMiddleware } from '@/middleware/auth';
import { getDB, notes } from '@/db';
import { eq, and, desc } from 'drizzle-orm';

export const notesRoutes = new Hono<{ Bindings: Env }>();

// バリデーションスキーマ
const createNoteSchema = z.object({
  type: z.enum(['text', 'checklist', 'acceptance']),
  title: z.string().min(1, 'タイトルは必須です'),
  content: z.string().optional(),
  issueId: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
});

// GET /api/notes - ノート一覧取得
notesRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const category = c.req.query('category');
    const issueId = c.req.query('issueId');

    const db = getDB(c.env.DB);

    // 条件を構築
    const conditions = [eq(notes.userId, user.userId)];

    if (category) {
      conditions.push(eq(notes.category, category));
    }

    if (issueId) {
      conditions.push(eq(notes.issueId, issueId));
    }

    // クエリを実行（ピン留め降順 → 作成日時降順）
    const result = await db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.isPinned), desc(notes.createdAt));

    return c.json({ notes: result });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/notes - ノート作成
notesRoutes.post('/', authMiddleware, async (c) => {
  try {
    // リクエストボディを取得
    const body = await c.req.json();

    // バリデーション
    const validationResult = createNoteSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        { error: validationResult.error.errors[0].message },
        400
      );
    }

    const data = validationResult.data;
    const user = c.get('user');

    const db = getDB(c.env.DB);

    // DBに保存（returning()で作成されたノートを直接取得）
    const [note] = await db
      .insert(notes)
      .values({
        id: nanoid(),
        userId: user.userId,
        issueId: data.issueId,
        type: data.type,
        title: data.title,
        content: data.content,
        category: data.category,
        color: data.color || '#fff9c4',
        isPinned: false,
      })
      .returning();

    return c.json(note, 201);
  } catch (error) {
    console.error('Error creating note:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /api/notes/:id - ノート更新
const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  type: z.enum(['text', 'checklist', 'acceptance']).optional(),
  color: z.string().optional(),
  isPinned: z.boolean().optional(),
  category: z.string().optional(),
});

notesRoutes.patch('/:id', authMiddleware, async (c) => {
  try {
    const noteId = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json();

    // バリデーション
    const validationResult = updateNoteSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        { error: validationResult.error.errors[0].message },
        400
      );
    }

    const db = getDB(c.env.DB);

    // ノートが存在するか確認 & 権限チェック
    const [existingNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existingNote) {
      return c.json({ error: 'Note not found' }, 404);
    }

    if (existingNote.userId !== user.userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const data = validationResult.data;

    // 更新するフィールドのみを含むオブジェクトを作成
    const updateData: Partial<typeof notes.$inferInsert> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.category !== undefined) updateData.category = data.category;

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    // 更新を実行
    const [updatedNote] = await db
      .update(notes)
      .set(updateData)
      .where(eq(notes.id, noteId))
      .returning();

    return c.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/notes/:id - ノート削除
notesRoutes.delete('/:id', authMiddleware, async (c) => {
  try {
    const noteId = c.req.param('id');
    const user = c.get('user');

    const db = getDB(c.env.DB);

    // ノートが存在するか確認 & 権限チェック
    const [existingNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existingNote) {
      return c.json({ error: 'Note not found' }, 404);
    }

    if (existingNote.userId !== user.userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // ノートを削除
    await db.delete(notes).where(eq(notes.id, noteId));

    return c.body(null, 204);
  } catch (error) {
    console.error('Error deleting note:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
