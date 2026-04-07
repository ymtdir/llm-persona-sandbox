import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostManager } from '../../src/services/postManager';
import type { IDatabaseClient, TransactionClient } from '../../src/lib/dbInterface';
import type { CreatePostData } from '../../src/types';

describe('PostManager', () => {
  let postManager: PostManager;
  let mockDb: IDatabaseClient;
  let mockClient: TransactionClient;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    };

    mockDb = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(mockClient),
      commit: vi.fn(),
      rollback: vi.fn(),
      close: vi.fn(),
      testConnection: vi.fn(),
    };

    postManager = new PostManager(mockDb);
  });

  describe('createPost', () => {
    it('should create post with auto-incremented post_number', async () => {
      // getNextPostNumber: 既存レスがある場合（トランザクション内）
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({
          rows: [{ max_post_number: 5 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        // createPost: INSERT RETURNING（トランザクション内）
        .mockResolvedValueOnce({
          rows: [
            {
              id: 123,
              thread_id: 'uuid-123',
              post_number: 6,
              author_name: 'テストユーザー',
              character_id: null,
              content: 'テスト投稿',
              anchors: null,
              is_user_post: true,
              created_at: new Date('2024-01-01'),
            },
          ],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        });

      const data: CreatePostData = {
        threadId: 'uuid-123',
        content: 'テスト投稿',
        authorName: 'テストユーザー',
      };

      const result = await postManager.createPost(data);

      // トランザクション開始確認
      expect(mockDb.beginTransaction).toHaveBeenCalled();

      // getNextPostNumber呼び出し確認（FOR UPDATE付き）
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('MAX(post_number)'),
        ['uuid-123']
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE'),
        expect.any(Array)
      );

      // INSERT呼び出し確認
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO posts'),
        expect.arrayContaining([
          'uuid-123',
          6, // post_number
          'テストユーザー',
          null, // character_id
          'テスト投稿',
          null, // anchors
          true, // is_user_post
          expect.any(Date),
        ])
      );

      // コミット確認
      expect(mockDb.commit).toHaveBeenCalledWith(mockClient);

      // 返り値の検証
      expect(result).toMatchObject({
        id: 123,
        postNumber: 6,
        authorName: 'テストユーザー',
        content: 'テスト投稿',
        isUserPost: true,
      });
    });

    it('should use default values', async () => {
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({
          rows: [{ max_post_number: null }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              thread_id: 'uuid-123',
              post_number: 1,
              author_name: '名無しさん',
              character_id: null,
              content: 'テスト',
              anchors: null,
              is_user_post: true,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        });

      const data: CreatePostData = {
        threadId: 'uuid-123',
        content: 'テスト',
      };

      await postManager.createPost(data);

      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.arrayContaining([
          'uuid-123',
          1, // post_number（初回）
          '名無しさん', // デフォルトauthorName
          null, // character_id
          'テスト',
          null, // anchors
          true, // デフォルトisUserPost
          expect.any(Date),
        ])
      );
    });

    it('should create AI post when characterId is provided', async () => {
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({
          rows: [{ max_post_number: 1 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              thread_id: 'uuid-123',
              post_number: 2,
              author_name: 'マジレスニキ',
              character_id: 'majiresu',
              content: 'AI投稿だぞ',
              anchors: '1',
              is_user_post: false,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        });

      const data: CreatePostData = {
        threadId: 'uuid-123',
        content: 'AI投稿だぞ',
        authorName: 'マジレスニキ',
        characterId: 'majiresu',
        anchors: '1',
        isUserPost: false,
      };

      const result = await postManager.createPost(data);

      expect(result).toMatchObject({
        characterId: 'majiresu',
        anchors: '1',
        isUserPost: false,
      });
    });

    it('should validate content length (empty)', async () => {
      const data: CreatePostData = {
        threadId: 'uuid-123',
        content: '',
      };

      await expect(postManager.createPost(data)).rejects.toThrow(
        '投稿内容は1-2000文字である必要があります'
      );
    });

    it('should validate content length (too long)', async () => {
      const longContent = 'あ'.repeat(2001);
      const data: CreatePostData = {
        threadId: 'uuid-123',
        content: longContent,
      };

      await expect(postManager.createPost(data)).rejects.toThrow(
        '投稿内容は1-2000文字である必要があります'
      );
    });

    it('should accept maximum valid length', async () => {
      const maxContent = 'あ'.repeat(2000);
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({
          rows: [{ max_post_number: null }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              thread_id: 'uuid-123',
              post_number: 1,
              author_name: '名無しさん',
              character_id: null,
              content: maxContent,
              anchors: null,
              is_user_post: true,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        });

      const data: CreatePostData = {
        threadId: 'uuid-123',
        content: maxContent,
      };

      await postManager.createPost(data);

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockDb.commit).toHaveBeenCalledWith(mockClient);
    });
  });

  describe('getPostsByThread', () => {
    it('should get all posts in ascending order', async () => {
      const mockRows = [
        {
          id: 1,
          thread_id: 'uuid-123',
          post_number: 1,
          author_name: '名無しさん',
          character_id: null,
          content: '1番目の投稿',
          anchors: null,
          is_user_post: true,
          created_at: new Date('2024-01-01'),
        },
        {
          id: 2,
          thread_id: 'uuid-123',
          post_number: 2,
          author_name: 'マジレスニキ',
          character_id: 'majiresu',
          content: '2番目の投稿',
          anchors: '1',
          is_user_post: false,
          created_at: new Date('2024-01-02'),
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockRows,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await postManager.getPostsByThread('uuid-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY post_number ASC'),
        ['uuid-123']
      );

      expect(result).toHaveLength(2);
      expect(result[0].postNumber).toBe(1);
      expect(result[1].postNumber).toBe(2);
    });

    it('should respect limit parameter', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await postManager.getPostsByThread('uuid-123', 10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['uuid-123', 10]
      );
    });

    it('should return empty array when no posts', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await postManager.getPostsByThread('uuid-123');

      expect(result).toEqual([]);
    });
  });

  describe('getNextPostNumber', () => {
    it('should return 1 for first post', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ max_post_number: null }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await postManager.getNextPostNumber('uuid-123');

      expect(result).toBe(1);
    });

    it('should return max + 1 for subsequent posts', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ max_post_number: 42 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await postManager.getNextPostNumber('uuid-123');

      expect(result).toBe(43);
    });
  });

  describe('getRecentPosts', () => {
    it('should get recent posts in ascending order', async () => {
      // サブクエリ+外側のORDER BY ASCで返される最終結果（ASC順）
      const mockRows = [
        {
          id: 1,
          thread_id: 'uuid-123',
          post_number: 1,
          author_name: '名無しさん',
          character_id: null,
          content: '1番目',
          anchors: null,
          is_user_post: true,
          created_at: new Date('2024-01-01'),
        },
        {
          id: 2,
          thread_id: 'uuid-123',
          post_number: 2,
          author_name: '名無しさん',
          character_id: null,
          content: '2番目',
          anchors: null,
          is_user_post: true,
          created_at: new Date('2024-01-02'),
        },
        {
          id: 3,
          thread_id: 'uuid-123',
          post_number: 3,
          author_name: '名無しさん',
          character_id: null,
          content: '3番目',
          anchors: null,
          is_user_post: true,
          created_at: new Date('2024-01-03'),
        },
      ];

      // サブクエリを使ったSQL（DESC→ASC）の最終結果をモック
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockRows,
        rowCount: 3,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await postManager.getRecentPosts('uuid-123', 3);

      // サブクエリ内でDESC、外側でASC順にソート
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY post_number DESC'),
        ['uuid-123', 3]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY post_number ASC'),
        expect.any(Array)
      );

      // ASC順に並んでいることを確認
      expect(result).toHaveLength(3);
      expect(result[0].postNumber).toBe(1);
      expect(result[1].postNumber).toBe(2);
      expect(result[2].postNumber).toBe(3);
    });

    it('should use default limit of 20', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await postManager.getRecentPosts('uuid-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.anything(),
        ['uuid-123', 20]
      );
    });

    it('should return empty array when no posts', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await postManager.getRecentPosts('uuid-123');

      expect(result).toEqual([]);
    });
  });
});
