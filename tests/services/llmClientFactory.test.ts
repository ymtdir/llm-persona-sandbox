import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLLMClient, getDefaultModel } from '../../src/services/llmClientFactory';
import { GroqClient } from '../../src/services/groqClient';

describe('LLMClientFactory', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 環境変数のバックアップ
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;
  });

  describe('createLLMClient', () => {
    it('should create GroqClient with API key from config', () => {
      const client = createLLMClient({
        apiKey: 'test_key',
      });

      expect(client).toBeInstanceOf(GroqClient);
    });

    it('should create GroqClient with API key from environment variable', () => {
      process.env.GROQ_API_KEY = 'env_test_key';

      const client = createLLMClient();

      expect(client).toBeInstanceOf(GroqClient);
    });

    it('should throw error when Groq API key is not provided', () => {
      delete process.env.GROQ_API_KEY;

      expect(() => createLLMClient()).toThrow('Groq API key is required');
    });

    it('should use custom Groq baseUrl when provided', () => {
      const client = createLLMClient({
        apiKey: 'test_key',
        baseUrl: 'https://custom.groq.com/v1',
      });

      expect(client).toBeInstanceOf(GroqClient);
    });

    it('should prefer config apiKey over environment variable', () => {
      process.env.GROQ_API_KEY = 'env_key';

      const client = createLLMClient({ apiKey: 'config_key' });

      expect(client).toBeInstanceOf(GroqClient);
    });
  });

  describe('getDefaultModel', () => {
    it('should return default Groq model when env var is not set', () => {
      delete process.env.GROQ_MODEL;

      const model = getDefaultModel();

      expect(model).toBe('llama-3.3-70b-versatile');
    });

    it('should return custom model from environment variable', () => {
      process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';

      const model = getDefaultModel();

      expect(model).toBe('llama-3.3-70b-versatile');
    });
  });
});
