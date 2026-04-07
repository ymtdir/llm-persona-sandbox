import type pg from 'pg';

/**
 * トランザクションクライアントインターフェース
 *
 * トランザクション内でクエリを実行するためのインターフェース
 */
export interface TransactionClient {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>>;
}

/**
 * データベースクライアントインターフェース
 *
 * データベース操作を抽象化したインターフェース
 */
export interface IDatabaseClient {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>>;

  beginTransaction(): Promise<TransactionClient>;

  commit(client: TransactionClient): Promise<void>;

  rollback(client: TransactionClient): Promise<void>;

  close(): Promise<void>;

  testConnection(): Promise<boolean>;
}
