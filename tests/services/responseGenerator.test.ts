import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponseGenerator } from '../../src/services/responseGenerator';
import { CharacterSelector } from '../../src/services/characterSelector';
import type { LLMClient } from '../../src/services/llmClient';
import { PostManager } from '../../src/services/postManager';
import type { Character, Post, ChatResponse } from '../../src/types';

// モックの作成
vi.mock('../../src/services/characterSelector');
vi.mock('../../src/services/postManager');

describe('ResponseGenerator', () => {
  let responseGenerator: ResponseGenerator;
  let mockCharacterSelector: CharacterSelector;
  let mockLLMClient: LLMClient;
  let mockPostManager: PostManager;

  const testCharacters: Character[] = [
    {
      id: 'test1',
      displayName: 'テストキャラ1',
      systemPrompt: 'Test prompt 1',
      personality: 'Test personality 1',
      speechStyle: 'Test speech 1',
      temperature: 0.8,
      keywords: ['プログラミング'],
      frequency: 8,
    },
    {
      id: 'test2',
      displayName: 'テストキャラ2',
      systemPrompt: 'Test prompt 2',
      personality: 'Test personality 2',
      speechStyle: 'Test speech 2',
      temperature: 0.7,
      keywords: ['デザイン'],
      frequency: 5,
    },
  ];

  const testThreadHistory: Post[] = [
    {
      id: 1,
      threadId: 'thread-1',
      postNumber: 1,
      authorName: '名無しさん',
      characterId: null,
      content: '最初の投稿です',
      anchors: null,
      isUserPost: true,
      createdAt: new Date('2025-01-15T00:00:00Z'),
    },
    {
      id: 2,
      threadId: 'thread-1',
      postNumber: 2,
      authorName: 'テストキャラ1',
      characterId: 'test1',
      content: 'テストレスです',
      anchors: null,
      isUserPost: false,
      createdAt: new Date('2025-01-15T00:00:01Z'),
    },
  ];

  const testUserPost: Post = {
    id: 3,
    threadId: 'thread-1',
    postNumber: 3,
    authorName: '名無しさん',
    characterId: null,
    content: 'プログラミングについて教えて',
    anchors: null,
    isUserPost: true,
    createdAt: new Date('2025-01-15T00:00:02Z'),
  };

  beforeEach(() => {
    // モックのリセット
    vi.clearAllMocks();

    // モックインスタンスの作成
    mockCharacterSelector = new CharacterSelector();
    mockLLMClient = {
      chat: vi.fn(),
      healthCheck: vi.fn(),
    };
    mockPostManager = new PostManager({} as any);

    // ResponseGeneratorインスタンスの作成
    responseGenerator = new ResponseGenerator(
      mockCharacterSelector,
      mockLLMClient,
      mockPostManager
    );
  });

  describe('generateResponses', () => {
    it('should generate responses from selected characters', async () => {
      // キャラクター選択のモック
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
        testCharacters[1],
      ]);

      // LLM APIレスポンスのモック
      const mockResponse: ChatResponse = {
        message: {
          role: 'assistant',
          content: 'テストレスです',
        },
        done: true,
      };
      (mockLLMClient.chat as any).mockResolvedValue(mockResponse);

      // レス保存のモック（2回呼ばれるので2つの値を返す）
      const createPostSpy = vi.spyOn(mockPostManager, 'createPost');
      createPostSpy.mockResolvedValueOnce({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'テストレスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      createPostSpy.mockResolvedValueOnce({
        id: 5,
        threadId: 'thread-1',
        postNumber: 5,
        authorName: 'テストキャラ2',
        characterId: 'test2',
        content: 'テストレスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      // レス生成実行
      const result = await responseGenerator.generateResponses(
        'thread-1',
        testUserPost,
        testThreadHistory
      );

      // キャラクター選択が呼ばれたことを確認
      expect(mockCharacterSelector.selectCharacters).toHaveBeenCalledWith(
        testUserPost.content
      );

      // Ollama APIが2回呼ばれたことを確認
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);

      // レス保存が2回呼ばれたことを確認
      expect(mockPostManager.createPost).toHaveBeenCalledTimes(2);

      // 結果が2件であることを確認
      expect(result).toHaveLength(2);
      // 並行実行なので順序は保証されないため、存在のみを確認
      const authorNames = result.map((r) => r.authorName);
      expect(authorNames).toContain('テストキャラ1');
      expect(authorNames).toContain('テストキャラ2');
    });

    it('should include System Prompt in chat messages', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // Ollama API呼び出しの引数を確認
      expect(mockLLMClient.chat).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('テストキャラ1'),
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('スレッド履歴'),
          }),
        ]),
        expect.objectContaining({
          temperature: 0.8,
          num_predict: 200,
        })
      );
    });

    it('should include thread history in User Prompt', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // User Promptにスレッド履歴が含まれることを確認
      const chatCall = vi.mocked(mockLLMClient.chat).mock.calls[0];
      const userMessage = chatCall[1].find((m) => m.role === 'user');

      expect(userMessage?.content).toContain('1: 名無しさん: 最初の投稿です');
      expect(userMessage?.content).toContain('2: テストキャラ1: テストレスです');
      expect(userMessage?.content).toContain('3: 名無しさん: プログラミングについて教えて');
    });

    it('should continue generation even if one character fails', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
        testCharacters[1],
      ]);

      // 1つ目のキャラクターはエラー、2つ目は成功
      vi.spyOn(mockLLMClient, 'chat')
        .mockRejectedValueOnce(new Error('Ollama API error'))
        .mockResolvedValueOnce({
          message: { role: 'assistant', content: 'レスです' },
          done: true,
        });

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 5,
        threadId: 'thread-1',
        postNumber: 5,
        authorName: 'テストキャラ2',
        characterId: 'test2',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      const result = await responseGenerator.generateResponses(
        'thread-1',
        testUserPost,
        testThreadHistory
      );

      // 1件のみ生成成功
      expect(result).toHaveLength(1);
      expect(result[0].authorName).toBe('テストキャラ2');
    });

    it('should use character temperature and num_predict in options', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // ChatOptionsを確認
      expect(mockLLMClient.chat).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          temperature: 0.8, // testCharacters[0].temperature
          num_predict: 200,
        })
      );
    });

    it('should save generated response with correct data', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: '  生成されたレス内容  ' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: '生成されたレス内容',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // レス保存が正しいデータで呼ばれたことを確認
      expect(mockPostManager.createPost).toHaveBeenCalledWith({
        threadId: 'thread-1',
        content: '生成されたレス内容', // trim済み
        authorName: 'テストキャラ1',
        characterId: 'test1',
        isUserPost: false,
      });
    });

    it('should limit thread history to 20 posts', async () => {
      // 30件の履歴を作成
      const longHistory: Post[] = Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        threadId: 'thread-1',
        postNumber: i + 1,
        authorName: '名無しさん',
        characterId: null,
        content: `投稿${i + 1}`,
        anchors: null,
        isUserPost: true,
        createdAt: new Date(),
      }));

      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 31,
        threadId: 'thread-1',
        postNumber: 31,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, longHistory);

      // User Promptに最新20件のみが含まれることを確認
      const chatCall = vi.mocked(mockLLMClient.chat).mock.calls[0];
      const userMessage = chatCall[1].find((m) => m.role === 'user');

      // 11-30の20件のみが含まれる
      expect(userMessage?.content).toContain('11: 名無しさん: 投稿11');
      expect(userMessage?.content).toContain('30: 名無しさん: 投稿30');
      expect(userMessage?.content).not.toContain('10: 名無しさん: 投稿10');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build System Prompt with character info', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      const chatCall = vi.mocked(mockLLMClient.chat).mock.calls[0];
      const systemMessage = chatCall[1].find((m) => m.role === 'system');

      // System Promptの構造を確認
      expect(systemMessage?.content).toContain('あなたは2chの「テストキャラ1」です');
      expect(systemMessage?.content).toContain('性格:');
      expect(systemMessage?.content).toContain('Test personality 1');
      expect(systemMessage?.content).toContain('口調:');
      expect(systemMessage?.content).toContain('Test speech 1');
      expect(systemMessage?.content).toContain('ルール:');
      expect(systemMessage?.content).toContain('性格・口調を守って');
      expect(systemMessage?.content).toContain('アンカー');
    });
  });

  describe('buildUserPrompt', () => {
    it('should build User Prompt with thread history and user post', async () => {
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      const chatCall = vi.mocked(mockLLMClient.chat).mock.calls[0];
      const userMessage = chatCall[1].find((m) => m.role === 'user');

      // User Promptの構造を確認
      expect(userMessage?.content).toContain('以下のスレッドに対して、レスしてください');
      expect(userMessage?.content).toContain('スレッド履歴:');
      expect(userMessage?.content).toContain('最新の投稿:');
      expect(userMessage?.content).toContain('あなたのレス（本文のみ、レス番号不要）:');
    });
  });

  describe('error handling', () => {
    it('should log error when character selection fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockImplementation(() => {
        throw new Error('Character selection failed');
      });

      await expect(
        responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory)
      ).rejects.toThrow('Character selection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] ResponseGenerator: AI response generation failed',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log info when starting and completing generation', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // 開始ログ
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] ResponseGenerator: Starting AI response generation',
        expect.objectContaining({
          threadId: 'thread-1',
          userPostNumber: 3,
        })
      );

      // 完了ログ
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] ResponseGenerator: AI response generation completed',
        expect.objectContaining({
          successCount: 1,
          failureCount: 0,
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('constructor options', () => {
    it('should use custom model when provided', async () => {
      const customGenerator = new ResponseGenerator(
        mockCharacterSelector,
        mockLLMClient,
        mockPostManager,
        { model: 'custom-model:13b' }
      );

      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await customGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // カスタムモデルが使用されることを確認
      expect(mockLLMClient.chat).toHaveBeenCalledWith(
        'custom-model:13b',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should use custom numPredict when provided', async () => {
      const customGenerator = new ResponseGenerator(
        mockCharacterSelector,
        mockLLMClient,
        mockPostManager,
        { numPredict: 500 }
      );

      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await customGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // カスタムnum_predictが使用されることを確認
      expect(mockLLMClient.chat).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          num_predict: 500,
        })
      );
    });

    it('should use custom maxHistoryLength when provided', async () => {
      // 30件の履歴を作成
      const longHistory: Post[] = Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        threadId: 'thread-1',
        postNumber: i + 1,
        authorName: '名無しさん',
        characterId: null,
        content: `投稿${i + 1}`,
        anchors: null,
        isUserPost: true,
        createdAt: new Date(),
      }));

      const customGenerator = new ResponseGenerator(
        mockCharacterSelector,
        mockLLMClient,
        mockPostManager,
        { maxHistoryLength: 10 }
      );

      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 31,
        threadId: 'thread-1',
        postNumber: 31,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await customGenerator.generateResponses('thread-1', testUserPost, longHistory);

      // User Promptに最新10件のみが含まれることを確認
      const chatCall = vi.mocked(mockLLMClient.chat).mock.calls[0];
      const userMessage = chatCall[1].find((m) => m.role === 'user');

      // 21-30の10件のみが含まれる
      expect(userMessage?.content).toContain('21: 名無しさん: 投稿21');
      expect(userMessage?.content).toContain('30: 名無しさん: 投稿30');
      expect(userMessage?.content).not.toContain('20: 名無しさん: 投稿20');
    });

    it('should use default values when options not provided', async () => {
      // オプションなしでインスタンス作成（既存のresponseGeneratorを使用）
      vi.spyOn(mockCharacterSelector, 'selectCharacters').mockReturnValue([
        testCharacters[0],
      ]);

      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'レスです' },
        done: true,
      };
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue(mockResponse);

      vi.spyOn(mockPostManager, 'createPost').mockResolvedValue({
        id: 4,
        threadId: 'thread-1',
        postNumber: 4,
        authorName: 'テストキャラ1',
        characterId: 'test1',
        content: 'レスです',
        anchors: null,
        isUserPost: false,
        createdAt: new Date(),
      } as Post);

      await responseGenerator.generateResponses('thread-1', testUserPost, testThreadHistory);

      // デフォルト値が使用されることを確認
      expect(mockLLMClient.chat).toHaveBeenCalledWith(
        'llama-3.1-70b-versatile', // Groqデフォルトモデル
        expect.any(Array),
        expect.objectContaining({
          num_predict: 200, // デフォルト値
        })
      );
    });
  });
});
