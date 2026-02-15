import { Hono } from 'hono';
import type { Env } from '@/index';
import { getDB, issues, projects } from '@/db';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

// HMAC署名検証関数
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signature.slice(7); // 'sha256=' を除去

  // Web Crypto APIを使用してHMAC-SHA256を計算
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);

  // ArrayBufferをhex文字列に変換
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const actualSignature = signatureArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // タイミング攻撃を防ぐために定数時間比較
  return actualSignature === expectedSignature;
}

// POST /api/webhooks/github - GitHub Webhook受信
webhookRoutes.post('/github', async (c) => {
  try {
    const signature = c.req.header('X-Hub-Signature-256');
    const eventType = c.req.header('X-GitHub-Event');

    if (!signature) {
      return c.json({ error: 'Missing signature header' }, 401);
    }

    // リクエストボディを取得
    const rawBody = await c.req.text();

    // HMAC署名を検証
    const isValid = await verifyWebhookSignature(
      rawBody,
      signature,
      c.env.GITHUB_WEBHOOK_SECRET
    );

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // JSONとしてパース
    const payload = JSON.parse(rawBody);

    // イベントタイプによって処理を分岐
    if (eventType !== 'issues') {
      return c.json({
        message: `Event type '${eventType}' skipped (only 'issues' events are processed)`,
      });
    }

    // Issue イベントを処理
    const db = getDB(c.env.DB);
    const issueNumber = payload.issue.number;
    const issueTitle = payload.issue.title;
    const issueState = payload.issue.state;
    const repoId = payload.repository.id;

    // リポジトリIDからプロジェクトを検索
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.githubRepoId, repoId))
      .limit(1);

    if (!project) {
      return c.json(
        { error: 'Project not found for this repository' },
        404
      );
    }

    // 既存のIssueを検索
    const [existingIssue] = await db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.projectId, project.id),
          eq(issues.githubIssueNumber, issueNumber)
        )
      )
      .limit(1);

    if (existingIssue) {
      // 既存のIssueを更新
      await db
        .update(issues)
        .set({
          title: issueTitle,
          state: issueState,
        })
        .where(eq(issues.id, existingIssue.id));

      return c.json({
        message: 'Issue updated successfully',
        issueId: existingIssue.id,
      });
    } else {
      // 新しいIssueを作成
      const [newIssue] = await db
        .insert(issues)
        .values({
          id: nanoid(),
          projectId: project.id,
          githubIssueNumber: issueNumber,
          title: issueTitle,
          state: issueState,
        })
        .returning();

      return c.json({
        message: 'Issue created successfully',
        issueId: newIssue.id,
      });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
