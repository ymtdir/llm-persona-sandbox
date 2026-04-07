import type { IDatabaseClient } from '../lib/dbInterface';
import type { Post, CreatePostData } from '../types';

/**
 * PostManager
 *
 * レスのCRUD操作を担当するサービスクラス。
 * レス番号の自動採番とビジネスロジックを実装。
 */
export class PostManager {
  private db: IDatabaseClient;

  constructor(db: IDatabaseClient) {
    this.db = db;
  }

  /**
   * レスを作成
   *
   * レス番号を自動採番してレスを作成
   *
   * @param data - レス作成データ
   * @returns 作成されたレス
   * @throws 投稿内容が不正な場合
   */
  async createPost(data: CreatePostData): Promise<Post> {
    // バリデーション
    if (!data.content || data.content.length === 0 || data.content.length > 2000) {
      throw new Error('投稿内容は1-2000文字である必要があります');
    }

    // 次のレス番号を取得
    const postNumber = await this.getNextPostNumber(data.threadId);

    // デフォルト値の設定
    const authorName = data.authorName || '名無しさん';
    const isUserPost = data.isUserPost ?? true;
    const characterId = data.characterId || null;
    const anchors = data.anchors || null;
    const now = new Date();

    // レス作成
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
      `INSERT INTO posts (thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at`,
      [data.threadId, postNumber, authorName, characterId, data.content, anchors, isUserPost, now]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      threadId: row.thread_id,
      postNumber: row.post_number,
      authorName: row.author_name,
      characterId: row.character_id,
      content: row.content,
      anchors: row.anchors,
      isUserPost: row.is_user_post,
      createdAt: row.created_at,
    };
  }

  /**
   * スレッドの全レスを取得
   *
   * @param threadId - スレッドID
   * @param limit - 取得件数（省略時は全件取得）
   * @returns レス一覧（post_number昇順）
   */
  async getPostsByThread(threadId: string, limit?: number): Promise<Post[]> {
    const sql = limit
      ? `SELECT id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at
         FROM posts
         WHERE thread_id = $1
         ORDER BY post_number ASC
         LIMIT $2`
      : `SELECT id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at
         FROM posts
         WHERE thread_id = $1
         ORDER BY post_number ASC`;

    const params = limit ? [threadId, limit] : [threadId];

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
    }>(sql, params);

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

  /**
   * 次のレス番号を取得
   *
   * スレッド内の現在の最大レス番号 + 1を返す
   *
   * @param threadId - スレッドID
   * @returns 次のレス番号（最初のレスの場合は1）
   */
  async getNextPostNumber(threadId: string): Promise<number> {
    const result = await this.db.query<{ max_post_number: number | null }>(
      `SELECT MAX(post_number) as max_post_number
       FROM posts
       WHERE thread_id = $1`,
      [threadId]
    );

    const maxPostNumber = result.rows[0]?.max_post_number;
    return maxPostNumber ? maxPostNumber + 1 : 1;
  }

  /**
   * 最新N件のレスを取得
   *
   * AIレス生成時の文脈取得用
   *
   * @param threadId - スレッドID
   * @param limit - 取得件数（デフォルト: 20）
   * @returns 最新N件のレス（post_number昇順）
   */
  async getRecentPosts(threadId: string, limit: number = 20): Promise<Post[]> {
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
       ORDER BY post_number DESC
       LIMIT $2`,
      [threadId, limit]
    );

    // DESC順で取得したものをASC順に並び替え
    return result.rows
      .reverse()
      .map((row) => ({
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
