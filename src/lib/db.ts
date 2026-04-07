import pg from 'pg';

const { Pool } = pg;

type PoolClient = pg.PoolClient;

/**
 * DatabaseClient
 *
 * PostgreSQLへの接続とクエリ実行を担当するクラス。
 * パラメータ化クエリによるSQLインジェクション対策、
 * トランザクション管理、コネクションプーリングを実装。
 */
export class DatabaseClient {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    const dbUrl = connectionString || process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error(
        'DATABASE_URL is not defined. Please set it in environment variables.'
      );
    }

    this.pool = new Pool({
      connectionString: dbUrl,
      max: 20, // 最大接続数
      idleTimeoutMillis: 30000, // アイドル接続のタイムアウト (30秒)
      connectionTimeoutMillis: 2000, // 接続タイムアウト (2秒)
    });

    // プールのエラーハンドリング
    this.pool.on('error', (err) => {
      console.error('[DatabaseClient] Unexpected error on idle client', err);
    });

    console.log('[DatabaseClient] Connection pool initialized');
  }

  /**
   * パラメータ化クエリを実行
   *
   * @param sql - SQL文 ($1, $2 形式のプレースホルダー使用)
   * @param params - パラメータ配列
   * @returns クエリ結果
   *
   * @example
   * const result = await db.query(
   *   'SELECT * FROM threads WHERE id = $1',
   *   [threadId]
   * );
   */
  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<pg.QueryResult<T>> {
    const start = Date.now();

    try {
      const result = await this.pool.query<T>(sql, params);
      const duration = Date.now() - start;

      console.log('[DatabaseClient] Query executed', {
        sql: sql.substring(0, 100), // 最初の100文字のみログ
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      console.error('[DatabaseClient] Query failed', {
        sql: sql.substring(0, 100),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * トランザクションを開始
   *
   * @returns トランザクションクライアント
   *
   * @example
   * const client = await db.beginTransaction();
   * try {
   *   await client.query('INSERT INTO threads ...');
   *   await client.query('INSERT INTO posts ...');
   *   await db.commit(client);
   * } catch (error) {
   *   await db.rollback(client);
   *   throw error;
   * }
   */
  async beginTransaction(): Promise<PoolClient> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      console.log('[DatabaseClient] Transaction started');
      return client;
    } catch (error) {
      client.release();
      console.error('[DatabaseClient] Failed to start transaction', error);
      throw error;
    }
  }

  /**
   * トランザクションをコミット
   *
   * @param client - トランザクションクライアント
   */
  async commit(client: PoolClient): Promise<void> {
    try {
      await client.query('COMMIT');
      console.log('[DatabaseClient] Transaction committed');
    } catch (error) {
      console.error('[DatabaseClient] Failed to commit transaction', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * トランザクションをロールバック
   *
   * @param client - トランザクションクライアント
   */
  async rollback(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
      console.log('[DatabaseClient] Transaction rolled back');
    } catch (error) {
      console.error('[DatabaseClient] Failed to rollback transaction', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 接続プールを閉じる
   *
   * アプリケーション終了時に呼び出す
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      console.log('[DatabaseClient] Connection pool closed');
    } catch (error) {
      console.error('[DatabaseClient] Failed to close connection pool', error);
      throw error;
    }
  }

  /**
   * 接続テスト
   *
   * データベース接続が正常に機能しているかを確認
   *
   * @returns 接続成功時true
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('[DatabaseClient] Connection test successful', result.rows[0]);
      return true;
    } catch (error) {
      console.error('[DatabaseClient] Connection test failed', error);
      return false;
    }
  }
}

// シングルトンインスタンス
let dbInstance: DatabaseClient | null = null;

/**
 * DatabaseClientのシングルトンインスタンスを取得
 *
 * @returns DatabaseClientインスタンス
 */
export function getDatabase(): DatabaseClient {
  if (!dbInstance) {
    dbInstance = new DatabaseClient();
  }
  return dbInstance;
}

/**
 * DatabaseClientインスタンスを閉じる
 *
 * アプリケーション終了時に呼び出す
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
