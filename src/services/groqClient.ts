import type { ChatMessage, ChatOptions, ChatResponse } from '../types';
import type { LLMClient } from './llmClient';

/**
 * Groq APIベースURL
 */
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * APIリクエストのタイムアウト時間（ミリ秒）
 */
const REQUEST_TIMEOUT = 30000; // 30秒

/**
 * Groq APIレスポンス型
 */
interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * GroqClient
 *
 * Groq APIへのHTTPリクエスト送信を担当するクライアントクラス。
 * OpenAI互換APIを使用してチャット補完を実行。
 */
export class GroqClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(
    apiKey: string,
    baseUrl: string = GROQ_BASE_URL,
    timeout: number = REQUEST_TIMEOUT
  ) {
    if (!apiKey) {
      throw new Error('Groq API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * チャット補完リクエスト
   *
   * Groq APIの /chat/completions エンドポイントにリクエストを送信し、
   * AIキャラクターのレスを生成する。
   *
   * @param model - 使用するモデル名（例: "llama-3.1-70b-versatile"）
   * @param messages - チャットメッセージ配列（system + user）
   * @param options - 生成オプション（temperature, num_predict）
   * @returns 生成されたレスポンス
   * @throws {Error} 接続エラー、認証エラー、レート制限エラー等
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    // AbortControllerでタイムアウトを実装
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log('[INFO] GroqClient: Sending chat request', {
        model,
        messageCount: messages.length,
        temperature: options?.temperature,
        max_tokens: options?.num_predict,
      });

      const startTime = Date.now();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.num_predict ?? 200,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Groq API returned status ${response.status}`;

        // エラーメッセージの詳細を抽出
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage += `: ${errorData.error.message}`;
          } else {
            errorMessage += `: ${errorText}`;
          }
        } catch {
          errorMessage += `: ${errorText}`;
        }

        // レート制限エラーの場合
        if (response.status === 429) {
          throw new Error(`Groq API rate limit exceeded. ${errorMessage}`);
        }

        // 認証エラーの場合
        if (response.status === 401) {
          throw new Error(`Groq API authentication failed. Check your API key.`);
        }

        throw new Error(errorMessage);
      }

      const data: GroqChatResponse = await response.json();

      const duration = Date.now() - startTime;

      // レスポンス検証
      if (
        !data.choices ||
        data.choices.length === 0 ||
        !data.choices[0].message ||
        typeof data.choices[0].message.content !== 'string'
      ) {
        throw new Error('Invalid response format: missing choices[0].message.content');
      }

      console.log('[INFO] GroqClient: Chat request completed', {
        duration: `${duration}ms`,
        contentLength: data.choices[0].message.content.length,
        usage: data.usage,
      });

      // Groq APIのレスポンスをChatResponse形式に変換
      return {
        message: {
          role: 'assistant',
          content: data.choices[0].message.content,
        },
        done: true,
        total_duration: duration * 1_000_000, // msをナノ秒に変換
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // タイムアウトエラー
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[ERROR] GroqClient: Request timed out after ${this.timeout}ms`);
        throw new Error(`Groq API request timed out after ${this.timeout}ms`);
      }

      // 接続エラー
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[ERROR] GroqClient: Connection failed to ${this.baseUrl}`, error);
        throw new Error(`Failed to connect to Groq API at ${this.baseUrl}.`);
      }

      // その他のエラー
      console.error('[ERROR] GroqClient: Chat request failed', error);
      throw error;
    }
  }

  /**
   * ヘルスチェック
   *
   * Groq APIが正常に動作しているか確認する。
   * （簡易版：認証が有効かのみチェック）
   *
   * @returns 正常に動作している場合はtrue
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // モデル一覧APIで認証確認（軽量なリクエスト）
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('[ERROR] GroqClient: Health check failed', error);
      return false;
    }
  }
}
