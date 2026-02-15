import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { env } from 'cloudflare:test';
import type { Env } from '@/index';
import { webhookRoutes } from '@/routes/webhooks';
import { generateJWT } from '@/lib/jwt';
import { nanoid } from 'nanoid';
import { createHmac } from 'node:crypto';

describe('GitHub Webhook受信機能', () => {
  let app: Hono<{ Bindings: Env }>;
  let testUserId: string;
  let testProjectId: string;
  const webhookSecret = 'test_webhook_secret_key';

  beforeEach(async () => {
    // テストユーザーを作成
    testUserId = `user-${nanoid()}`;
    await env.DB.prepare(`
      INSERT INTO users (id, github_id, login, access_token)
      VALUES (?, ?, ?, ?)
    `).bind(testUserId, 12345, 'testuser', 'test_token').run();

    // テストプロジェクトを作成
    testProjectId = `project-${nanoid()}`;
    await env.DB.prepare(`
      INSERT INTO projects (id, user_id, github_repo_id, name)
      VALUES (?, ?, ?, ?)
    `).bind(testProjectId, testUserId, 123456789, 'test-repo').run();

    // アプリケーションをセットアップ
    app = new Hono<{ Bindings: Env }>();
    app.route('/api/webhooks', webhookRoutes);
  });

  describe('テスト9: GitHub Issue同期', () => {
    it('GitHub Webhookからissue作成イベントが送信された場合、Issueデータが保存され200が返される', async () => {
      // Given: GitHub Webhookペイロード
      const payload = {
        action: 'opened',
        issue: {
          number: 42,
          title: 'Test Issue from Webhook',
          state: 'open',
        },
        repository: {
          id: 123456789,
          name: 'test-repo',
        },
      };

      const payloadString = JSON.stringify(payload);

      // HMAC署名を生成
      const signature = createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      // When: /api/webhooks/github エンドポイントが呼ばれる
      const res = await app.request(
        '/api/webhooks/github',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': `sha256=${signature}`,
            'X-GitHub-Event': 'issues',
          },
          body: payloadString,
        },
        { ...env, GITHUB_WEBHOOK_SECRET: webhookSecret }
      );

      // Then: 200 OKが返される
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBeDefined();

      // Issueデータが解析され、issuesテーブルに保存される
      const savedIssue = await env.DB.prepare(`
        SELECT * FROM issues WHERE github_issue_number = ? AND project_id = ?
      `).bind(42, testProjectId).first();

      expect(savedIssue).toBeDefined();
      expect(savedIssue!.title).toBe('Test Issue from Webhook');
      expect(savedIssue!.state).toBe('open');
      expect(savedIssue!.github_issue_number).toBe(42);
    });

    it('Issue更新イベント（closed）を受信した場合、既存のIssueのstateが更新される', async () => {
      // Given: 既存のIssueを作成
      const issueId = `issue-${nanoid()}`;
      await env.DB.prepare(`
        INSERT INTO issues (id, project_id, github_issue_number, title, state)
        VALUES (?, ?, ?, ?, ?)
      `).bind(issueId, testProjectId, 42, 'Existing Issue', 'open').run();

      const payload = {
        action: 'closed',
        issue: {
          number: 42,
          title: 'Existing Issue',
          state: 'closed',
        },
        repository: {
          id: 123456789,
          name: 'test-repo',
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      // When: issue closedイベントを受信
      const res = await app.request(
        '/api/webhooks/github',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': `sha256=${signature}`,
            'X-GitHub-Event': 'issues',
          },
          body: payloadString,
        },
        { ...env, GITHUB_WEBHOOK_SECRET: webhookSecret }
      );

      // Then: 200が返され、stateが更新される
      expect(res.status).toBe(200);

      const updatedIssue = await env.DB.prepare(`
        SELECT * FROM issues WHERE id = ?
      `).bind(issueId).first();

      expect(updatedIssue!.state).toBe('closed');
    });
  });

  describe('テスト13: Webhook HMAC検証（セキュリティ）', () => {
    it('不正な署名を持つWebhookリクエストが送信された場合、401 Unauthorizedが返される', async () => {
      // Given: 不正な署名
      const payload = {
        action: 'opened',
        issue: {
          number: 99,
          title: 'Malicious Issue',
          state: 'open',
        },
        repository: {
          id: 123456789,
        },
      };

      const payloadString = JSON.stringify(payload);
      const wrongSignature = 'sha256=wrong_signature_hash';

      // When: 不正な署名でWebhookリクエストを送信
      const res = await app.request(
        '/api/webhooks/github',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': wrongSignature,
            'X-GitHub-Event': 'issues',
          },
          body: payloadString,
        },
        { ...env, GITHUB_WEBHOOK_SECRET: webhookSecret }
      );

      // Then: 401 Unauthorizedが返される
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain('signature');

      // Webhookペイロードが処理されない（Issueが保存されない）
      const savedIssue = await env.DB.prepare(`
        SELECT * FROM issues WHERE github_issue_number = ?
      `).bind(99).first();

      expect(savedIssue).toBeNull();
    });

    it('X-Hub-Signature-256ヘッダーがない場合、401 Unauthorizedが返される', async () => {
      // Given: 署名ヘッダーなし
      const payload = {
        action: 'opened',
        issue: {
          number: 88,
          title: 'Unsigned Issue',
          state: 'open',
        },
        repository: {
          id: 123456789,
        },
      };

      // When: 署名ヘッダーなしでリクエスト
      const res = await app.request(
        '/api/webhooks/github',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Event': 'issues',
          },
          body: JSON.stringify(payload),
        },
        { ...env, GITHUB_WEBHOOK_SECRET: webhookSecret }
      );

      // Then: 401が返される
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('サポートされていないイベントタイプの場合、200が返されるが処理はスキップされる', async () => {
      // Given: サポートされていないイベント（push）
      const payload = {
        ref: 'refs/heads/main',
        commits: [],
      };

      const payloadString = JSON.stringify(payload);
      const signature = createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      // When: pushイベントを受信
      const res = await app.request(
        '/api/webhooks/github',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': `sha256=${signature}`,
            'X-GitHub-Event': 'push',
          },
          body: payloadString,
        },
        { ...env, GITHUB_WEBHOOK_SECRET: webhookSecret }
      );

      // Then: 200が返されるが、メッセージにスキップされたことが示される
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('skipped');
    });
  });
});
