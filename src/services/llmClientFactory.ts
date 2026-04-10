import type { LLMClient } from './llmClient';
import { GroqClient } from './groqClient';
import { OllamaClient } from './ollamaClient';

/**
 * サポートされているLLMプロバイダー
 */
export type LLMProvider = 'groq' | 'ollama';

/**
 * LLMクライアントファクトリー設定
 */
export interface LLMClientConfig {
  /**
   * 使用するプロバイダー
   * デフォルト: 環境変数LLM_PROVIDER、または'groq'
   */
  provider?: LLMProvider;

  /**
   * Groq API設定
   */
  groq?: {
    apiKey?: string;
    baseUrl?: string;
  };

  /**
   * Ollama設定
   */
  ollama?: {
    baseUrl?: string;
  };
}

/**
 * LLMクライアントファクトリー
 *
 * 環境変数に基づいて適切なLLMクライアント（Groq/Ollama）を生成する。
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
 * // 明示的にGroqを指定
 * const client = createLLMClient({
 *   provider: 'groq',
 *   groq: { apiKey: 'your-api-key' }
 * });
 */
export function createLLMClient(config: LLMClientConfig = {}): LLMClient {
  // プロバイダーの決定（優先順位: 引数 > 環境変数 > デフォルト）
  const provider: LLMProvider =
    config.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'groq';

  console.log(`[INFO] LLMClientFactory: Creating ${provider} client`);

  switch (provider) {
    case 'groq': {
      const apiKey = config.groq?.apiKey || process.env.GROQ_API_KEY;

      if (!apiKey) {
        throw new Error(
          'Groq API key is required. Set GROQ_API_KEY environment variable or pass apiKey in config.'
        );
      }

      return new GroqClient(apiKey, config.groq?.baseUrl);
    }

    case 'ollama': {
      const baseUrl =
        config.ollama?.baseUrl ||
        process.env.OLLAMA_BASE_URL ||
        'http://ollama:11434';

      return new OllamaClient(baseUrl);
    }

    default: {
      throw new Error(
        `Unsupported LLM provider: ${provider}. Supported providers: groq, ollama`
      );
    }
  }
}

/**
 * 環境変数に基づいてデフォルトモデル名を取得
 *
 * @returns モデル名
 */
export function getDefaultModel(): string {
  const provider: LLMProvider =
    (process.env.LLM_PROVIDER as LLMProvider) || 'groq';

  switch (provider) {
    case 'groq':
      return process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
    case 'ollama':
      return process.env.OLLAMA_MODEL || 'llama3.2:3b';
    default:
      return 'llama-3.1-70b-versatile';
  }
}
