import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThreadManager } from '../../src/services/threadManager';
import type { IDatabaseClient, TransactionClient } from '../../src/lib/dbInterface';
import type { Thread, Post } from '../../src/types';

describe('ThreadManager', () => {
  let threadManager: ThreadManager;
  let mockDb: IDatabaseClient;
  let mockClient: TransactionClient;

  beforeEach(() => {
    // モッククライアントの作成
    mockClient = {
      query: vi.fn(),
    };

    // モックDBの作成
    mockDb = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(mockClient),
      commit: vi.fn(),
      rollback: vi.fn(),
      close: vi.fn(),
      testConnection: vi.fn(),
    };

    threadManager = new ThreadManager(mockDb);
  });

  describe('createThread', () => {
    it('should create thread with first post in transaction', async () => {
      const title = 'テストスレッド';
      const firstPost = '初回投稿です';
      const authorName = 'テストユーザー';

      const result = await threadManager.createThread(title, firstPost, authorName);

      // トランザクション開始
      expect(mockDb.beginTransaction).toHaveBeenCalled();

      // スレッド作成クエリ
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO threads'),
        expect.arrayContaining([
          expect.any(String), // UUID
          title,
          expect.any(Date),
          expect.any(Date),
          1, // post_count
        ])
      );

      // 初回レス作成クエリ
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO posts'),
        expect.arrayContaining([
          expect.any(String), // thread_id
          1, // post_number
          authorName,
          firstPost,
          true, // is_user_post
          expect.any(Date),
        ])
      );

      // コミット
      expect(mockDb.commit).toHaveBeenCalledWith(mockClient);

      // 返り値の検証
      expect(result).toMatchObject({
        id: expect.any(String),
        title,
        createdAt: expect.any(Date),
        lastPostAt: expect.any(Date),
        postCount: 1,
      });
    });

    it('should use default author name when not provided', async () => {
      await threadManager.createThread('タイトル', '本文');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO posts'),
        expect.arrayContaining(['名無しさん'])
      );
    });

    it('should rollback on error', async () => {
      const error = new Error('DB Error');
      vi.mocked(mockClient.query).mockRejectedValueOnce(error);

      await expect(
        threadManager.createThread('タイトル', '本文')
      ).rejects.toThrow('DB Error');

      expect(mockDb.rollback).toHaveBeenCalledWith(mockClient);
      expect(mockDb.commit).not.toHaveBeenCalled();
    });

    it('should validate title length (empty)', async () => {
      await expect(threadManager.createThread('', '本文')).rejects.toThrow(
        'タイトルは1-100文字である必要があります'
      );
    });

    it('should validate title length (too long)', async () => {
      const longTitle = 'あ'.repeat(101);
      await expect(threadManager.createThread(longTitle, '本文')).rejects.toThrow(
        'タイトルは1-100文字である必要があります'
      );
    });

    it('should validate first post length (empty)', async () => {
      await expect(threadManager.createThread('タイトル', '')).rejects.toThrow(
        '投稿内容は1-2000文字である必要があります'
      );
    });

    it('should validate first post length (too long)', async () => {
      const longPost = 'あ'.repeat(2001);
      await expect(threadManager.createThread('タイトル', longPost)).rejects.toThrow(
        '投稿内容は1-2000文字である必要があります'
      );
    });

    it('should accept maximum valid lengths', async () => {
      const maxTitle = 'あ'.repeat(100);
      const maxPost = 'あ'.repeat(2000);

      await threadManager.createThread(maxTitle, maxPost);

      expect(mockDb.commit).toHaveBeenCalled();
    });
  });

  describe('listThreads', () => {
    it('should list threads ordered by last_post_at DESC', async () => {
      const mockRows = [
        {
          id: 'uuid-1',
          title: 'スレッド1',
          created_at: new Date('2024-01-01'),
          last_post_at: new Date('2024-01-02'),
          post_count: 5,
        },
        {
          id: 'uuid-2',
          title: 'スレッド2',
          created_at: new Date('2024-01-01'),
          last_post_at: new Date('2024-01-01'),
          post_count: 3,
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockRows,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await threadManager.listThreads();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_post_at DESC'),
        [50] // デフォルトlimit
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'uuid-1',
        title: 'スレッド1',
        postCount: 5,
      });
    });

    it('should use custom limit', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await threadManager.listThreads(10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [10]
      );
    });

    it('should return empty array when no threads', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await threadManager.listThreads();

      expect(result).toEqual([]);
    });
  });

  describe('getThread', () => {
    it('should return thread by id', async () => {
      const mockRow = {
        id: 'uuid-123',
        title: 'テストスレッド',
        created_at: new Date('2024-01-01'),
        last_post_at: new Date('2024-01-02'),
        post_count: 10,
      };

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await threadManager.getThread('uuid-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['uuid-123']
      );

      expect(result).toMatchObject({
        id: 'uuid-123',
        title: 'テストスレッド',
        postCount: 10,
      });
    });

    it('should return null when thread not found', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await threadManager.getThread('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('updateLastPostAt', () => {
    it('should update last_post_at to current timestamp', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      await threadManager.updateLastPostAt('uuid-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE threads'),
        ['uuid-123']
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('last_post_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('incrementPostCount', () => {
    it('should increment post_count by 1', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      await threadManager.incrementPostCount('uuid-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE threads'),
        ['uuid-123']
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('post_count = post_count + 1'),
        expect.any(Array)
      );
    });
  });

  describe('getPostsByThreadId', () => {
    it('should return posts ordered by post_number', async () => {
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

      const result = await threadManager.getPostsByThreadId('uuid-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE thread_id = $1'),
        ['uuid-123']
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY post_number ASC'),
        expect.any(Array)
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        postNumber: 1,
        authorName: '名無しさん',
        isUserPost: true,
      });
      expect(result[1]).toMatchObject({
        id: 2,
        postNumber: 2,
        characterId: 'majiresu',
        isUserPost: false,
      });
    });

    it('should return empty array when no posts', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await threadManager.getPostsByThreadId('uuid-123');

      expect(result).toEqual([]);
    });
  });
});
