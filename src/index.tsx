import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createThreadsRouter } from './routes/threads';
import { DatabaseClient } from './lib/db';
import { ThreadManager } from './services/threadManager';
import { PostManager } from './services/postManager';
import { ResponseGenerator } from './services/responseGenerator';
import { CharacterSelector } from './services/characterSelector';
import { OllamaClient } from './services/ollamaClient';

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
 * 依存性注入 - サービスのインスタンス化
 */
const db = new DatabaseClient();
const threadManager = new ThreadManager(db);
const postManager = new PostManager(db);
const characterSelector = new CharacterSelector();
const ollamaClient = new OllamaClient();
const responseGenerator = new ResponseGenerator(characterSelector, ollamaClient, postManager);

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

// スレッドルートのマウント（依存性注入）
const threadsRouter = createThreadsRouter(threadManager, postManager, responseGenerator);
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
