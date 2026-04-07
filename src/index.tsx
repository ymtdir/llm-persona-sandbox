import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { threadsRouter } from './routes/threads';

/**
 * Honoアプリケーション
 */
const app = new Hono();

/**
 * ミドルウェア設定
 */

// ロガーミドルウェア - すべてのリクエストをログ出力
app.use('*', logger());

// CORSミドルウェア - 開発環境で有効化
if (process.env.NODE_ENV !== 'production') {
  app.use('*', cors());
}

/**
 * エラーハンドリングミドルウェア
 */
app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`, err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

/**
 * ルート定義
 */

// ヘルスチェックエンドポイント
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'LLM Persona Sandbox is running',
    timestamp: new Date().toISOString(),
  });
});

// スレッドルートのマウント
app.route('/threads', threadsRouter);

/**
 * サーバー起動
 */
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`[INFO] Starting Hono server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`[INFO] Hono server is running on http://localhost:${port}`);
console.log(`[INFO] Health check: http://localhost:${port}/`);
console.log(`[INFO] Threads API: http://localhost:${port}/threads`);
