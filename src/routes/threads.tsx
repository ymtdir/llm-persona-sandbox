import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { ThreadManager } from '../services/threadManager';
import type { PostManager } from '../services/postManager';
import type { ResponseGenerator } from '../services/responseGenerator';
import { Layout } from '../views/Layout';
import { ThreadList, type Thread as ViewThread } from '../views/ThreadList';
import { ThreadDetail, type ThreadDetailData } from '../views/ThreadDetail';
import { ErrorPage } from '../views/ErrorPage';
import { createThreadSchema, createPostSchema } from './validation';

/**
 * スレッドルーターファクトリー
 *
 * 依存性注入パターンを使用してスレッド関連のエンドポイントを提供
 *
 * @param threadManager - スレッド管理サービス
 * @param postManager - レス管理サービス
 * @param responseGenerator - AI応答生成サービス
 * @returns スレッドルーター
 */
export function createThreadsRouter(
  threadManager: ThreadManager,
  postManager: PostManager,
  responseGenerator: ResponseGenerator
): Hono {
  const threadsRouter = new Hono();

  /**
   * GET /threads
   * スレッド一覧表示
   *
   * 最新50件のスレッドを取得（最新レス順）
   */
  threadsRouter.get('/', async (c) => {
    try {
      const dbThreads = await threadManager.listThreads(50);

      // DBのスレッドをビュー用の型に変換
      const threads: ViewThread[] = dbThreads.map((t) => ({
        id: t.id,
        title: t.title,
        resCount: t.postCount,
        lastResAt: t.lastPostAt,
        createdAt: t.createdAt,
      }));

      return c.html(
        <Layout title="スレッド一覧 - 2ch風掲示板">
          <ThreadList threads={threads} />
        </Layout>
      );
    } catch (error) {
      console.error('[ERROR] Failed to list threads:', error);
      return c.html(
        <ErrorPage message="スレッド一覧の取得に失敗しました。時間をおいて再度お試しください。" />,
        500
      );
    }
  });

  /**
   * GET /threads/new
   * 新規スレッド作成フォーム表示
   *
   * NOTE: このルートは /threads/:id よりも前に定義する必要があります
   * （より具体的なパターンを先にマッチさせるため）
   */
  threadsRouter.get('/new', async (c) => {
    return c.html(
      <Layout title="新規スレッド作成 - 2ch風掲示板">
        <div class="post-form">
          <h2 style="font-size: 18px; margin-bottom: 15px;">新規スレッド作成</h2>

          <form action="/threads" method="post">
            <div class="form-group">
              <label htmlFor="title" class="form-label">
                タイトル:
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                maxlength={100}
                style="width: 100%; max-width: 400px;"
              />
            </div>

            <div class="form-group">
              <label htmlFor="name" class="form-label">
                名前:
              </label>
              <input type="text" id="name" name="name" placeholder="名無しさん" maxlength={64} />
            </div>

            <div class="form-group">
              <label htmlFor="email" class="form-label">
                E-mail:
              </label>
              <input type="email" id="email" name="email" placeholder="sage" maxlength={64} />
              <span style="margin-left: 10px; font-size: 12px; color: #666666;">(省略可)</span>
            </div>

            <div class="form-group">
              <label htmlFor="content" class="form-label">
                内容:
              </label>
              <textarea id="content" name="content" required maxlength={2000}></textarea>
            </div>

            <div class="form-group">
              <label class="form-label"></label>
              <button type="submit">スレッドを立てる</button>
            </div>
          </form>

          <div style="margin-top: 20px; text-align: center;">
            <a href="/threads">スレッド一覧に戻る</a>
          </div>
        </div>
      </Layout>
    );
  });

  /**
   * GET /threads/:id
   * スレッド詳細表示
   *
   * 指定されたIDのスレッドと全レスを取得
   */
  threadsRouter.get('/:id', async (c) => {
    try {
      const threadId = c.req.param('id');

      const dbThread = await threadManager.getThread(threadId);
      if (!dbThread) {
        return c.html(
          <ErrorPage
            message="指定されたスレッドが見つかりません。"
            linkUrl="/threads"
            linkText="スレッド一覧に戻る"
          />,
          404
        );
      }

      const dbPosts = await postManager.getPostsByThread(threadId);

      // DBの投稿をビュー用の型に変換
      const thread: ThreadDetailData = {
        id: dbThread.id,
        title: dbThread.title,
        isLocked: dbThread.postCount >= 1000,
        posts: dbPosts.map((p) => ({
          id: String(p.id),
          number: p.postNumber,
          name: p.authorName || '名無しさん',
          email: undefined,
          content: p.content,
          createdAt: p.createdAt,
          threadId: p.threadId,
        })),
      };

      return c.html(
        <Layout title={`${dbThread.title} - 2ch風掲示板`}>
          <ThreadDetail thread={thread} />
        </Layout>
      );
    } catch (error) {
      console.error('[ERROR] Failed to get thread:', error);
      return c.html(
        <ErrorPage
          message="スレッドの取得に失敗しました。時間をおいて再度お試しください。"
          linkUrl="/threads"
          linkText="スレッド一覧に戻る"
        />,
        500
      );
    }
  });

  /**
   * POST /threads
   * スレッド作成
   *
   * タイトルと初回投稿でスレッドを作成
   */
  threadsRouter.post('/', zValidator('form', createThreadSchema), async (c) => {
    try {
      const { title, name, content } = c.req.valid('form');

      // スレッドと初回投稿を同時作成
      const thread = await threadManager.createThread(title, content, name || '名無しさん');

      // スレッド詳細にリダイレクト
      return c.redirect(`/threads/${thread.id}`);
    } catch (error) {
      console.error('[ERROR] Failed to create thread:', error);
      return c.html(
        <ErrorPage
          message="スレッドの作成に失敗しました。時間をおいて再度お試しください。"
          linkUrl="/threads/new"
          linkText="戻る"
        />,
        500
      );
    }
  });

  /**
   * POST /threads/:id/posts
   * レス投稿
   *
   * 指定されたスレッドにレスを投稿し、AIレス生成をトリガー
   */
  threadsRouter.post('/:id/posts', zValidator('form', createPostSchema), async (c) => {
    try {
      const threadId = c.req.param('id');
      const { name, content } = c.req.valid('form');

      // スレッド存在チェック
      const thread = await threadManager.getThread(threadId);
      if (!thread) {
        return c.html(
          <ErrorPage
            message="指定されたスレッドが見つかりません。"
            linkUrl="/threads"
            linkText="スレッド一覧に戻る"
          />,
          404
        );
      }

      // スレッドがロックされているかチェック（1000レス到達）
      if (thread.postCount >= 1000) {
        return c.html(
          <ErrorPage
            message="このスレッドは1000レスに到達しています。"
            linkUrl={`/threads/${threadId}`}
            linkText="スレッドに戻る"
          />,
          403
        );
      }

      // スレッド履歴を事前に取得（AI応答生成用）
      const threadHistory = await postManager.getPostsByThread(threadId);

      // レス投稿
      const post = await postManager.createPost({
        threadId,
        authorName: name || '名無しさん',
        content,
        isUserPost: true,
      });

      // AIレス生成を非同期で開始（エラーが発生しても投稿は成功とする）
      responseGenerator.generateResponses(threadId, post, threadHistory).catch((error) => {
        console.error('[ERROR] Failed to generate AI responses:', error);
      });

      // スレッド詳細にリダイレクト
      return c.redirect(`/threads/${threadId}#post-${post.postNumber}`);
    } catch (error) {
      console.error('[ERROR] Failed to create post:', error);
      const threadId = c.req.param('id');
      return c.html(
        <ErrorPage
          message="レスの投稿に失敗しました。時間をおいて再度お試しください。"
          linkUrl={`/threads/${threadId}`}
          linkText="スレッドに戻る"
        />,
        500
      );
    }
  });

  return threadsRouter;
}
