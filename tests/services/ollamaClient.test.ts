import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaClient } from '../../src/services/ollamaClient';
import type { ChatMessage, ChatOptions, ChatResponse } from '../../src/types';

// fetchのモック
global.fetch = vi.fn();

describe('OllamaClient', () => {
  let ollamaClient: OllamaClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    ollamaClient = new OllamaClient('http://localhost:11434', 30000);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('chat', () => {
    const model = 'llama3.1:8b';
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ];
    const options: ChatOptions = {
      temperature: 0.8,
      num_predict: 200,
    };

    it('should send chat request successfully', async () => {
      const mockResponse: ChatResponse = {
        message: {
          role: 'assistant',
          content: 'こんにちは！',
        },
        done: true,
        total_duration: 3000000000,
        prompt_eval_duration: 500000000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await ollamaClient.chat(model, messages, options);

      // fetchの呼び出し確認
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            options,
          }),
        })
      );

      // レスポンス確認
      expect(result).toEqual(mockResponse);
      expect(result.message.content).toBe('こんにちは！');
    });

    it('should use default empty options when not provided', async () => {
      const mockResponse: ChatResponse = {
        message: {
          role: 'assistant',
          content: 'Hello!',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await ollamaClient.chat(model, messages);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: {},
          }),
        })
      );
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'model not found',
      });

      await expect(ollamaClient.chat(model, messages)).rejects.toThrow(
        'Ollama API returned status 404: model not found'
      );
    });

    it('should throw error when response format is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(ollamaClient.chat(model, messages)).rejects.toThrow(
        'Invalid response format: missing message.content'
      );
    });

    it('should throw timeout error when request exceeds timeout', async () => {
      // 短いタイムアウトでクライアントを作成
      const shortTimeoutClient = new OllamaClient('http://localhost:11434', 100);

      mockFetch.mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            // AbortSignalのabortイベントを監視
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                reject(new DOMException('The user aborted a request.', 'AbortError'));
              });
            }
            // タイムアウト後まで待機（実際はabortで中断される）
            setTimeout(() => {}, 300);
          })
      );

      await expect(
        shortTimeoutClient.chat(model, messages)
      ).rejects.toThrow('Ollama API request timed out after 100ms');
    });

    it('should throw connection error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError('fetch failed: network error')
      );

      await expect(ollamaClient.chat(model, messages)).rejects.toThrow(
        'Failed to connect to Ollama API at http://localhost:11434. Is Ollama running?'
      );
    });

    it('should log request and response information', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResponse: ChatResponse = {
        message: {
          role: 'assistant',
          content: 'Test response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await ollamaClient.chat(model, messages, options);

      // リクエストログ確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] OllamaClient: Sending chat request',
        expect.objectContaining({
          model,
          messageCount: 2,
          temperature: 0.8,
          num_predict: 200,
        })
      );

      // レスポンスログ確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] OllamaClient: Chat request completed',
        expect.objectContaining({
          duration: expect.stringMatching(/\d+ms/),
          contentLength: 13,
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return true when Ollama is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await ollamaClient.healthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when Ollama is not responding', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await ollamaClient.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when connection fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await ollamaClient.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should use provided baseUrl and timeout', () => {
      const client = new OllamaClient('http://custom:8080', 60000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { role: 'assistant', content: 'test' },
          done: true,
        }),
      });

      client.chat('test', [{ role: 'user', content: 'test' }]);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom:8080/api/chat',
        expect.any(Object)
      );
    });

    it('should use default values when not provided', () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { role: 'assistant', content: 'test' },
          done: true,
        }),
      });

      client.chat('test', [{ role: 'user', content: 'test' }]);

      // デフォルトのbaseUrlが使用されることを確認
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.any(Object)
      );
    });
  });
});
