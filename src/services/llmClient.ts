import type { ChatMessage, ChatOptions, ChatResponse } from '../types';

/**
 * LLMクライアントの共通インターフェース
 *
 * Ollama、Groq、その他のLLMプロバイダーに対応する統一インターフェース
 */
export interface LLMClient {
  /**
   * チャット補完リクエスト
   *
   * @param model - 使用するモデル名
   * @param messages - チャットメッセージ配列（system + user）
   * @param options - 生成オプション（temperature, num_predict）
   * @returns 生成されたレスポンス
   * @throws {Error} 接続エラー、タイムアウト、認証エラー等
   */
  chat(model: string, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * ヘルスチェック（オプション）
   *
   * APIが正常に動作しているか確認する。
   *
   * @returns 正常に動作している場合はtrue
   */
  healthCheck?(): Promise<boolean>;
}
