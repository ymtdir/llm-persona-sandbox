import type { IDatabaseClient } from '../lib/dbInterface';
import type { Post, CreatePostData } from '../types';

/**
 * 投稿内容の最大文字数
 */
const MAX_CONTENT_LENGTH = 2000;

/**
 * データベース行の型定義
 */
type PostRow = {
  id: number;
  thread_id: string;
  post_number: number;
  author_name: string;
  character_id: string | null;
  content: string;
  anchors: string | null;
  is_user_post: boolean;
  created_at: Date;
};

/**
 * データベース行をPost型にマッピング
 */
function mapRowToPost(row: PostRow): Post {
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
   * トランザクション内でFOR UPDATEを使用して競合を防止
   *
   * @param data - レス作成データ
   * @returns 作成されたレス
   * @throws 投稿内容が不正な場合
   */
  async createPost(data: CreatePostData): Promise<Post> {
    // バリデーション
    if (!data.content || data.content.length === 0 || data.content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`投稿内容は1-${MAX_CONTENT_LENGTH}文字である必要があります`);
    }

    // デフォルト値の設定
    const authorName = data.authorName || '名無しさん';
    const isUserPost = data.isUserPost ?? true;
    const characterId = data.characterId || null;
    const anchors = data.anchors || null;
    const now = new Date();

    // トランザクション開始
    const client = await this.db.beginTransaction();

    try {
      // スレッドをロックして次のレス番号を計算
      const threadResult = await client.query<{ post_count: number }>(
        `SELECT post_count
         FROM threads
         WHERE id = $1
         FOR UPDATE`,
        [data.threadId]
      );

      const postNumber = (threadResult.rows[0]?.post_count || 0) + 1;

      // レス作成
      const result = await client.query<PostRow>(
        `INSERT INTO posts (thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at`,
        [data.threadId, postNumber, authorName, characterId, data.content, anchors, isUserPost, now]
      );

      // スレッドのpost_countとlast_post_atを更新
      await client.query(
        `UPDATE threads
         SET post_count = $1, last_post_at = $2
         WHERE id = $3`,
        [postNumber, now, data.threadId]
      );

      // コミット
      await this.db.commit(client);

      return mapRowToPost(result.rows[0]);
    } catch (error) {
      // ロールバック
      await this.db.rollback(client);
      throw error;
    }
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
    const result = await this.db.query<PostRow>(sql, params);

    return result.rows.map(mapRowToPost);
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
    // サブクエリでDESC順に取得し、外側のクエリでASC順に並び替え
    const result = await this.db.query<PostRow>(
      `SELECT id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at
       FROM (
         SELECT id, thread_id, post_number, author_name, character_id, content, anchors, is_user_post, created_at
         FROM posts
         WHERE thread_id = $1
         ORDER BY post_number DESC
         LIMIT $2
       ) AS recent_posts
       ORDER BY post_number ASC`,
      [threadId, limit]
    );

    return result.rows.map(mapRowToPost);
  }
}
