import type { ChatMessage, ChatOptions, ChatResponse } from '../types';

/**
 * Ollama APIベースURL
 * 環境変数から取得、デフォルトはDocker内部URL
 */
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';

/**
 * APIリクエストのタイムアウト時間（ミリ秒）
 */
const REQUEST_TIMEOUT = 30000; // 30秒

/**
 * OllamaClient
 *
 * Ollama APIへのHTTPリクエスト送信を担当するクライアントクラス。
 * チャット補完リクエスト、エラーハンドリング、レスポンスパースを実装。
 */
export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = OLLAMA_BASE_URL, timeout: number = REQUEST_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * チャット補完リクエスト
   *
   * Ollama APIの /api/chat エンドポイントにリクエストを送信し、
   * AIキャラクターのレスを生成する。
   *
   * @param model - 使用するモデル名（例: "llama3.1:8b"）
   * @param messages - チャットメッセージ配列（system + user）
   * @param options - 生成オプション（temperature, num_predict）
   * @returns 生成されたレスポンス
   * @throws {Error} 接続エラー、タイムアウト、JSONパースエラー
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const url = `${this.baseUrl}/api/chat`;

    // AbortControllerでタイムアウトを実装
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log('[INFO] OllamaClient: Sending chat request', {
        model,
        messageCount: messages.length,
        temperature: options?.temperature,
        num_predict: options?.num_predict,
      });

      const startTime = Date.now();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: options || {},
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama API returned status ${response.status}: ${errorText}`
        );
      }

      const data: unknown = await response.json();

      const duration = Date.now() - startTime;

      // レスポンス検証
      if (
        !data ||
        typeof data !== 'object' ||
        !('message' in data) ||
        !data.message ||
        typeof data.message !== 'object' ||
        !('content' in data.message) ||
        typeof data.message.content !== 'string'
      ) {
        throw new Error('Invalid response format: missing message.content');
      }

      console.log('[INFO] OllamaClient: Chat request completed', {
        duration: `${duration}ms`,
        contentLength: data.message.content.length,
      });

      return data as ChatResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      // タイムアウトエラー
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(
          `[ERROR] OllamaClient: Request timed out after ${this.timeout}ms`
        );
        throw new Error(`Ollama API request timed out after ${this.timeout}ms`);
      }

      // 接続エラー
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(
          `[ERROR] OllamaClient: Connection failed to ${this.baseUrl}`,
          error
        );
        throw new Error(
          `Failed to connect to Ollama API at ${this.baseUrl}. Is Ollama running?`
        );
      }

      // その他のエラー
      console.error('[ERROR] OllamaClient: Chat request failed', error);
      throw error;
    }
  }

  /**
   * ヘルスチェック
   *
   * Ollama APIが正常に動作しているか確認する。
   *
   * @returns 正常に動作している場合はtrue
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('[ERROR] OllamaClient: Health check failed', error);
      return false;
    }
  }
}
