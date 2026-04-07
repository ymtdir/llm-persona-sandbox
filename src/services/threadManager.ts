import type { IDatabaseClient } from '../lib/dbInterface';
import type { Thread, Post } from '../types';
import { randomUUID } from 'crypto';

/**
 * ThreadManager
 *
 * スレッドのCRUD操作を担当するサービスクラス。
 * トランザクション管理とビジネスロジックを実装。
 */
export class ThreadManager {
  private db: IDatabaseClient;

  constructor(db: IDatabaseClient) {
    this.db = db;
  }

  /**
   * スレッドを作成
   *
   * トランザクションを使用してスレッドと初回レスを同時作成
   *
   * @param title - スレッドタイトル（1-100文字）
   * @param firstPost - 初回レスの内容（1-2000文字）
   * @param authorName - 投稿者名（省略時は「名無しさん」）
   * @returns 作成されたスレッド
   * @throws タイトルまたは初回レスが不正な場合
   */
  async createThread(
    title: string,
    firstPost: string,
    authorName: string = '名無しさん'
  ): Promise<Thread> {
    // バリデーション
    if (!title || title.length === 0 || title.length > 100) {
      throw new Error('タイトルは1-100文字である必要があります');
    }

    if (!firstPost || firstPost.length === 0 || firstPost.length > 2000) {
      throw new Error('投稿内容は1-2000文字である必要があります');
    }

    // UUID生成
    const threadId = randomUUID();
    const now = new Date();

    // トランザクション開始
    const client = await this.db.beginTransaction();

    try {
      // スレッド作成
      await client.query(
        `INSERT INTO threads (id, title, created_at, last_post_at, post_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [threadId, title, now, now, 1]
      );

      // 初回レス作成（post_number=1）
      await client.query(
        `INSERT INTO posts (thread_id, post_number, author_name, content, is_user_post, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [threadId, 1, authorName, firstPost, true, now]
      );

      // コミット
      await this.db.commit(client);

      return {
        id: threadId,
        title,
        createdAt: now,
        lastPostAt: now,
        postCount: 1,
      };
    } catch (error) {
      // ロールバック
      await this.db.rollback(client);
      throw error;
    }
  }

  /**
   * スレッド一覧を取得
   *
   * 最終レス日時の降順でソート
   *
   * @param limit - 取得件数（デフォルト: 50）
   * @returns スレッド一覧
   */
  async listThreads(limit: number = 50): Promise<Thread[]> {
    const result = await this.db.query<{
      id: string;
      title: string;
      created_at: Date;
      last_post_at: Date;
      post_count: number;
    }>(
      `SELECT id, title, created_at, last_post_at, post_count
       FROM threads
       ORDER BY last_post_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      lastPostAt: row.last_post_at,
      postCount: row.post_count,
    }));
  }

  /**
   * スレッドを取得
   *
   * @param id - スレッドID（UUID）
   * @returns スレッド情報（存在しない場合はnull）
   */
  async getThread(id: string): Promise<Thread | null> {
    const result = await this.db.query<{
      id: string;
      title: string;
      created_at: Date;
      last_post_at: Date;
      post_count: number;
    }>(
      `SELECT id, title, created_at, last_post_at, post_count
       FROM threads
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      lastPostAt: row.last_post_at,
      postCount: row.post_count,
    };
  }

  /**
   * 最終レス日時を更新
   *
   * @param id - スレッドID
   * @throws スレッドが存在しない場合
   */
  async updateLastPostAt(id: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE threads
       SET last_post_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error(`スレッドが見つかりません: ${id}`);
    }
  }

  /**
   * レス数をインクリメント
   *
   * @param id - スレッドID
   * @throws スレッドが存在しない場合
   */
  async incrementPostCount(id: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE threads
       SET post_count = post_count + 1
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error(`スレッドが見つかりません: ${id}`);
    }
  }

  /**
   * スレッドのレス一覧を取得
   *
   * @param threadId - スレッドID
   * @returns レス一覧（post_number順）
   */
  async getPostsByThreadId(threadId: string): Promise<Post[]> {
    const result = await this.db.query<{
      id: number;
      thread_id: string;
      post_number: number;
      author_name: string;
      character_id: string | null;
      content: string;
      anchors: string | null;
      is_user_post: boolean;
      created_at: Date;
    }>(
      `SELECT id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at
       FROM posts
       WHERE thread_id = $1
       ORDER BY post_number ASC`,
      [threadId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      postNumber: row.post_number,
      authorName: row.author_name,
      characterId: row.character_id,
      content: row.content,
      anchors: row.anchors,
      isUserPost: row.is_user_post,
      createdAt: row.created_at,
    }));
  }
}
