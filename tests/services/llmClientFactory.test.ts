import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLLMClient, getDefaultModel } from '../../src/services/llmClientFactory';
import { GroqClient } from '../../src/services/groqClient';
import { OllamaClient } from '../../src/services/ollamaClient';

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
    describe('Groq provider', () => {
      it('should create GroqClient when provider is "groq"', () => {
        const client = createLLMClient({
          provider: 'groq',
          groq: { apiKey: 'test_key' },
        });

        expect(client).toBeInstanceOf(GroqClient);
      });

      it('should use GROQ_API_KEY from environment variable', () => {
        process.env.GROQ_API_KEY = 'env_test_key';

        const client = createLLMClient({ provider: 'groq' });

        expect(client).toBeInstanceOf(GroqClient);
      });

      it('should throw error when Groq API key is not provided', () => {
        delete process.env.GROQ_API_KEY;

        expect(() => createLLMClient({ provider: 'groq' })).toThrow(
          'Groq API key is required'
        );
      });

      it('should use custom Groq baseUrl when provided', () => {
        const client = createLLMClient({
          provider: 'groq',
          groq: {
            apiKey: 'test_key',
            baseUrl: 'https://custom.groq.com/v1',
          },
        });

        expect(client).toBeInstanceOf(GroqClient);
      });
    });

    describe('Ollama provider', () => {
      it('should create OllamaClient when provider is "ollama"', () => {
        const client = createLLMClient({ provider: 'ollama' });

        expect(client).toBeInstanceOf(OllamaClient);
      });

      it('should use OLLAMA_BASE_URL from environment variable', () => {
        process.env.OLLAMA_BASE_URL = 'http://custom-ollama:11434';

        const client = createLLMClient({ provider: 'ollama' });

        expect(client).toBeInstanceOf(OllamaClient);
      });

      it('should use custom Ollama baseUrl when provided', () => {
        const client = createLLMClient({
          provider: 'ollama',
          ollama: { baseUrl: 'http://localhost:8080' },
        });

        expect(client).toBeInstanceOf(OllamaClient);
      });

      it('should use default baseUrl when not provided', () => {
        delete process.env.OLLAMA_BASE_URL;

        const client = createLLMClient({ provider: 'ollama' });

        expect(client).toBeInstanceOf(OllamaClient);
      });
    });

    describe('Provider selection priority', () => {
      it('should use config provider over environment variable', () => {
        process.env.LLM_PROVIDER = 'ollama';
        process.env.GROQ_API_KEY = 'test_key';

        const client = createLLMClient({ provider: 'groq' });

        expect(client).toBeInstanceOf(GroqClient);
      });

      it('should use environment variable when config provider is not set', () => {
        process.env.LLM_PROVIDER = 'ollama';

        const client = createLLMClient({});

        expect(client).toBeInstanceOf(OllamaClient);
      });

      it('should default to "groq" when neither config nor env is set', () => {
        delete process.env.LLM_PROVIDER;
        process.env.GROQ_API_KEY = 'test_key';

        const client = createLLMClient({});

        expect(client).toBeInstanceOf(GroqClient);
      });
    });

    describe('Error handling', () => {
      it('should throw error for unsupported provider', () => {
        expect(() =>
          createLLMClient({ provider: 'unknown' as any })
        ).toThrow('Unsupported LLM provider: unknown');
      });
    });

    describe('Logging', () => {
      it('should log provider creation', () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        process.env.GROQ_API_KEY = 'test_key';

        createLLMClient({ provider: 'groq' });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO] LLMClientFactory: Creating groq client'
        );

        consoleLogSpy.mockRestore();
      });
    });
  });

  describe('getDefaultModel', () => {
    it('should return Groq model when provider is "groq"', () => {
      process.env.LLM_PROVIDER = 'groq';
      delete process.env.GROQ_MODEL;

      const model = getDefaultModel();

      expect(model).toBe('llama-3.1-70b-versatile');
    });

    it('should return custom Groq model from environment variable', () => {
      process.env.LLM_PROVIDER = 'groq';
      process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';

      const model = getDefaultModel();

      expect(model).toBe('llama-3.3-70b-versatile');
    });

    it('should return Ollama model when provider is "ollama"', () => {
      process.env.LLM_PROVIDER = 'ollama';
      delete process.env.OLLAMA_MODEL;

      const model = getDefaultModel();

      expect(model).toBe('llama3.2:3b');
    });

    it('should return custom Ollama model from environment variable', () => {
      process.env.LLM_PROVIDER = 'ollama';
      process.env.OLLAMA_MODEL = 'llama3.1:8b';

      const model = getDefaultModel();

      expect(model).toBe('llama3.1:8b');
    });

    it('should default to Groq model when provider is not set', () => {
      delete process.env.LLM_PROVIDER;
      delete process.env.GROQ_MODEL;

      const model = getDefaultModel();

      expect(model).toBe('llama-3.1-70b-versatile');
    });

    it('should return default Groq model for unknown provider', () => {
      process.env.LLM_PROVIDER = 'unknown';

      const model = getDefaultModel();

      expect(model).toBe('llama-3.1-70b-versatile');
    });
  });
});
