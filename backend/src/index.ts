import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS設定（セキュリティ強化版）
app.use('/*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.FRONTEND_URL,           // 本番環境
      'http://localhost:5173',      // Vite dev server
      'http://localhost:5174',      // 代替ポート
      'http://localhost:3000',      // Next.js dev server
    ];

    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // 許可されていないオリジンをログに記録
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return '';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // プリフライトリクエストのキャッシュ（24時間）
}));

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// 認証ルート
app.route('/auth', authRoutes);

export default app;
