import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroqClient } from '../../src/services/groqClient';
import type { ChatMessage, ChatOptions, ChatResponse } from '../../src/types';

// fetchのモック
global.fetch = vi.fn();

describe('GroqClient', () => {
  let groqClient: GroqClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  const testApiKey = 'test_api_key_123';

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    groqClient = new GroqClient(testApiKey, 'https://api.groq.com/openai/v1', 30000);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should throw error when API key is not provided', () => {
      expect(() => new GroqClient('')).toThrow('Groq API key is required');
    });

    it('should use provided baseUrl and timeout', () => {
      const client = new GroqClient('key', 'https://custom.groq.com/v1', 60000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'test' } }],
        }),
      });

      client.chat('test', [{ role: 'user', content: 'test' }]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.groq.com/v1/chat/completions',
        expect.any(Object)
      );
    });
  });

  describe('chat', () => {
    const model = 'llama-3.1-70b-versatile';
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ];
    const options: ChatOptions = {
      temperature: 0.8,
      num_predict: 200,
    };

    it('should send chat request successfully', async () => {
      const mockGroqResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'llama-3.1-70b-versatile',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'こんにちは！',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGroqResponse,
        text: async () => JSON.stringify(mockGroqResponse),
      });

      const result = await groqClient.chat(model, messages, options);

      // fetchの呼び出し確認
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature,
            max_tokens: options.num_predict,
            stream: false,
          }),
        })
      );

      // レスポンス確認
      expect(result.message.role).toBe('assistant');
      expect(result.message.content).toBe('こんにちは！');
      expect(result.done).toBe(true);
    });

    it('should use default temperature and max_tokens when not provided', async () => {
      const mockGroqResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGroqResponse,
      });

      await groqClient.chat(model, messages);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 200,
            stream: false,
          }),
        })
      );
    });

    it('should throw error when response is not ok (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: { message: 'Model not found' } }),
      });

      await expect(groqClient.chat(model, messages)).rejects.toThrow(
        'Groq API returned status 404: Model not found'
      );
    });

    it('should throw rate limit error when status is 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
      });

      await expect(groqClient.chat(model, messages)).rejects.toThrow(
        'Groq API rate limit exceeded'
      );
    });

    it('should throw authentication error when status is 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(groqClient.chat(model, messages)).rejects.toThrow(
        'Groq API authentication failed. Check your API key.'
      );
    });

    it('should throw error when response format is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(groqClient.chat(model, messages)).rejects.toThrow(
        'Invalid response format: missing choices[0].message.content'
      );
    });

    it('should throw timeout error when request exceeds timeout', async () => {
      const shortTimeoutClient = new GroqClient(testApiKey, undefined, 100);

      mockFetch.mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                reject(new DOMException('The user aborted a request.', 'AbortError'));
              });
            }
            setTimeout(() => {}, 300);
          })
      );

      await expect(shortTimeoutClient.chat(model, messages)).rejects.toThrow(
        'Groq API request timed out after 100ms'
      );
    });

    it('should throw connection error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed: network error'));

      await expect(groqClient.chat(model, messages)).rejects.toThrow(
        'Failed to connect to Groq API'
      );
    });

    it('should log request and response information', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockGroqResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Test response',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 3,
          total_tokens: 13,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGroqResponse,
      });

      await groqClient.chat(model, messages, options);

      // リクエストログ確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] GroqClient: Sending chat request',
        expect.objectContaining({
          model,
          messageCount: 2,
          temperature: 0.8,
          max_tokens: 200,
        })
      );

      // レスポンスログ確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] GroqClient: Chat request completed',
        expect.objectContaining({
          duration: expect.stringMatching(/\d+ms/),
          contentLength: 13,
          usage: expect.objectContaining({
            total_tokens: 13,
          }),
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return true when Groq API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await groqClient.healthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
        })
      );
    });

    it('should return false when Groq API is not responding', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await groqClient.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when connection fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await groqClient.healthCheck();

      expect(result).toBe(false);
    });
  });
});
