import type { LLMClient } from './llmClient';
import { GroqClient } from './groqClient';

/**
 * LLMクライアントファクトリー設定
 */
export interface LLMClientConfig {
  /**
   * Groq API設定
   */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * LLMクライアントファクトリー
 *
 * Groq APIクライアントを生成する。
 *
 * @param config - クライアント設定（省略時は環境変数から取得）
 * @returns LLMクライアントインスタンス
 * @throws {Error} 必要な環境変数が設定されていない場合
 *
 * @example
 * // 環境変数から自動設定
 * const client = createLLMClient();
 *
 * @example
 * // 明示的にAPIキーを指定
 * const client = createLLMClient({
 *   apiKey: 'your-api-key'
 * });
 */
export function createLLMClient(config: LLMClientConfig = {}): LLMClient {
  console.log('[INFO] LLMClientFactory: Creating Groq client');

  const apiKey = config.apiKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Groq API key is required. Set GROQ_API_KEY environment variable or pass apiKey in config.'
    );
  }

  return new GroqClient(apiKey, config.baseUrl);
}

/**
 * 環境変数に基づいてデフォルトモデル名を取得
 *
 * @returns モデル名
 */
export function getDefaultModel(): string {
  return process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
}
