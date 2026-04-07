import pg from 'pg';
import type { IDatabaseClient, TransactionClient } from './dbInterface';
import type { DatabaseConfig } from './dbConfig';
import { getDatabaseConfigFromEnv } from './dbConfig';
import type { Logger } from './logger';
import { getDefaultLogger } from './logger';

const { Pool } = pg;

/**
 * DatabaseClient
 *
 * PostgreSQLへの接続とクエリ実行を担当するクラス。
 * パラメータ化クエリによるSQLインジェクション対策、
 * トランザクション管理、コネクションプーリングを実装。
 *
 * 依存性注入により、設定とロガーを外部から提供可能。
 */
export class DatabaseClient implements IDatabaseClient {
  private pool: pg.Pool;
  private logger: Logger;

  /**
   * DatabaseClientを構築
   *
   * @param config - データベース接続設定（省略時は環境変数から取得）
   * @param logger - ロガー（省略時はデフォルトロガーを使用）
   */
  constructor(config?: DatabaseConfig, logger?: Logger) {
    const dbConfig = config || getDatabaseConfigFromEnv();
    this.logger = logger || getDefaultLogger();

    this.pool = new Pool({
      connectionString: dbConfig.connectionString,
      max: dbConfig.max,
      idleTimeoutMillis: dbConfig.idleTimeoutMillis,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
    });

    // プールのエラーハンドリング
    this.pool.on('error', (err) => {
      this.logger.error('[DatabaseClient] Unexpected error on idle client', err);
    });

    this.logger.log('[DatabaseClient] Connection pool initialized');
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

      this.logger.log('[DatabaseClient] Query executed', {
        sql: sql.substring(0, 100), // 最初の100文字のみログ
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.logger.error('[DatabaseClient] Query failed', {
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
  async beginTransaction(): Promise<TransactionClient> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      this.logger.log('[DatabaseClient] Transaction started');
      return client;
    } catch (error) {
      client.release();
      this.logger.error('[DatabaseClient] Failed to start transaction', error);
      throw error;
    }
  }

  /**
   * トランザクションをコミット
   *
   * @param client - トランザクションクライアント
   */
  async commit(client: TransactionClient): Promise<void> {
    const poolClient = client as pg.PoolClient;
    try {
      await poolClient.query('COMMIT');
      this.logger.log('[DatabaseClient] Transaction committed');
    } catch (error) {
      this.logger.error('[DatabaseClient] Failed to commit transaction', error);
      throw error;
    } finally {
      poolClient.release();
    }
  }

  /**
   * トランザクションをロールバック
   *
   * @param client - トランザクションクライアント
   */
  async rollback(client: TransactionClient): Promise<void> {
    const poolClient = client as pg.PoolClient;
    try {
      await poolClient.query('ROLLBACK');
      this.logger.log('[DatabaseClient] Transaction rolled back');
    } catch (error) {
      this.logger.error('[DatabaseClient] Failed to rollback transaction', error);
      throw error;
    } finally {
      poolClient.release();
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
      this.logger.log('[DatabaseClient] Connection pool closed');
    } catch (error) {
      this.logger.error('[DatabaseClient] Failed to close connection pool', error);
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
      this.logger.log('[DatabaseClient] Connection test successful', result.rows[0]);
      return true;
    } catch (error) {
      this.logger.error('[DatabaseClient] Connection test failed', error);
      return false;
    }
  }
}

/**
 * DatabaseClientファクトリー
 *
 * グローバルシングルトンの代わりに、明示的なファクトリーパターンを使用。
 * テスト時には異なるインスタンスを作成可能。
 */
export class DatabaseClientFactory {
  private static instance: IDatabaseClient | null = null;

  /**
   * シングルトンインスタンスを取得
   *
   * @param config - データベース接続設定
   * @param logger - ロガー
   * @returns DatabaseClientインスタンス
   */
  static getInstance(config?: DatabaseConfig, logger?: Logger): IDatabaseClient {
    if (!this.instance) {
      this.instance = new DatabaseClient(config, logger);
    }
    return this.instance;
  }

  /**
   * 新しいインスタンスを作成
   *
   * テスト時に使用
   *
   * @param config - データベース接続設定
   * @param logger - ロガー
   * @returns 新しいDatabaseClientインスタンス
   */
  static createInstance(config?: DatabaseConfig, logger?: Logger): IDatabaseClient {
    return new DatabaseClient(config, logger);
  }

  /**
   * シングルトンインスタンスをリセット
   *
   * テスト時に使用
   */
  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * シングルトンインスタンスを閉じてリセット
   */
  static async closeInstance(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}

/**
 * デフォルトのDatabaseClientインスタンスを取得
 *
 * 後方互換性のための便利関数
 *
 * @returns DatabaseClientインスタンス
 */
export function getDatabase(): IDatabaseClient {
  return DatabaseClientFactory.getInstance();
}

/**
 * DatabaseClientインスタンスを閉じる
 *
 * 後方互換性のための便利関数
 */
export async function closeDatabase(): Promise<void> {
  await DatabaseClientFactory.closeInstance();
}
