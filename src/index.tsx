import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

// ルートパスでHello Worldを返す
app.get('/', (c) => {
  return c.text('Hello World from LLM Persona Sandbox!');
});

// ヘルスチェックエンドポイント
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ポート番号を環境変数から取得
const port = parseInt(process.env.PORT || '3000', 10);

// サーバーの起動
console.log(`Server is running on http://localhost:${port}`);
serve({
  fetch: app.fetch,
  port,
});
