/**
 * データベース接続設定
 */
export interface DatabaseConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * デフォルトのデータベース接続設定
 */
export const DEFAULT_DATABASE_CONFIG = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
} as const;

/**
 * 環境変数からデータベース設定を取得
 *
 * @returns データベース設定
 * @throws DATABASE_URLが未定義の場合
 */
export function getDatabaseConfigFromEnv(): DatabaseConfig {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not defined. Please set it in environment variables.'
    );
  }

  return {
    connectionString,
    ...DEFAULT_DATABASE_CONFIG,
  };
}
