import { Hono } from 'hono';

/**
 * スレッドルーター
 *
 * スレッド関連のエンドポイントを提供
 */
export const threadsRouter = new Hono();

/**
 * GET /threads
 * スレッド一覧取得
 *
 * 最新50件のスレッドを取得（最新レス順）
 */
threadsRouter.get('/', async (c) => {
  // TODO: ThreadManagerでスレッド一覧取得（Issue #12で実装）
  return c.json({
    message: 'スレッド一覧取得（未実装）',
    threads: [],
  });
});

/**
 * GET /thread/:id
 * スレッド詳細取得
 *
 * 指定されたIDのスレッドと全レスを取得
 */
threadsRouter.get('/:id', async (c) => {
  const threadId = c.req.param('id');

  // TODO: ThreadManagerとPostManagerでスレッド詳細取得（Issue #12で実装）
  return c.json({
    message: 'スレッド詳細取得（未実装）',
    threadId,
  });
});

/**
 * POST /thread
 * スレッド作成
 *
 * タイトルと初回投稿でスレッドを作成
 */
threadsRouter.post('/', async (c) => {
  // TODO: バリデーションとThreadManager.createThread（Issue #12で実装）
  return c.json({
    message: 'スレッド作成（未実装）',
  });
});

/**
 * POST /thread/:id/post
 * レス投稿
 *
 * 指定されたスレッドにレスを投稿し、AIレス生成をトリガー
 */
threadsRouter.post('/:id/post', async (c) => {
  const threadId = c.req.param('id');

  // TODO: バリデーション、PostManager.createPost、ResponseGenerator.generateResponses（Issue #12で実装）
  return c.json({
    message: 'レス投稿（未実装）',
    threadId,
  });
});
