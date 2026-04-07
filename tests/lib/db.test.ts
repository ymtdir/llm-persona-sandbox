import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseClient, DatabaseClientFactory } from '../../src/lib/db';
import type { DatabaseConfig } from '../../src/lib/dbConfig';
import { SilentLogger } from '../../src/lib/logger';

// pg モジュールのモック
vi.mock('pg', () => {
  // 各テストで独立したモックインスタンスを作成
  const createMockPool = () => ({
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  });

  const createMockClient = () => ({
    query: vi.fn(),
    release: vi.fn(),
  });

  const MockPool = vi.fn(() => {
    const pool = createMockPool();
    const client = createMockClient();
    pool.connect.mockResolvedValue(client);
    // モックインスタンスをPoolに保存
    (MockPool as any)._lastPool = pool;
    (MockPool as any)._lastClient = client;
    return pool;
  });

  return {
    default: {
      Pool: MockPool,
      PoolClient: vi.fn(),
    },
  };
});

describe('DatabaseClient', () => {
  let db: DatabaseClient;
  let mockConfig: DatabaseConfig;
  let logger: SilentLogger;
  let MockPool: any;
  let mockPool: any;
  let mockClient: any;

  beforeEach(async () => {
    // 環境変数を設定
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    // モックのリセット
    vi.clearAllMocks();
    DatabaseClientFactory.resetInstance();

    // テスト用の設定
    mockConfig = {
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // サイレントロガーを使用（テスト時はログ出力しない）
    logger = new SilentLogger();

    // pg モジュールからモックを取得
    const pg = await import('pg');
    MockPool = (pg as any).default.Pool;

    // DatabaseClientを作成
    db = new DatabaseClient(mockConfig, logger);

    // モックインスタンスを取得
    mockPool = (MockPool as any)._lastPool;
    mockClient = (MockPool as any)._lastClient;
  });

  describe('constructor', () => {
    it('should throw error if DATABASE_URL is not defined and no config provided', () => {
      delete process.env.DATABASE_URL;
      expect(() => new DatabaseClient(undefined, logger)).toThrow(
        'DATABASE_URL is not defined'
      );
    });

    it('should initialize pool with provided config', () => {
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@localhost:5432/testdb',
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        })
      );
    });

    it('should set up error handler on pool', () => {
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should accept custom config', () => {
      const customConfig: DatabaseConfig = {
        connectionString: 'postgresql://custom:pass@localhost:5432/customdb',
        max: 10,
      };
      const customDb = new DatabaseClient(customConfig, logger);

      const lastCall = MockPool.mock.calls[MockPool.mock.calls.length - 1][0];
      expect(lastCall.connectionString).toBe(customConfig.connectionString);
      expect(lastCall.max).toBe(10);
    });
  });

  describe('query', () => {
    it('should execute parameterized query', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT * FROM threads WHERE id = $1', [
        'thread-123',
      ]);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM threads WHERE id = $1',
        ['thread-123']
      );
      expect(result).toEqual(mockResult);
    });

    it('should execute query without parameters', async () => {
      const mockResult = { rows: [{ count: 10 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT COUNT(*) FROM threads');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM threads',
        []
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw error on query failure', async () => {
      const error = new Error('Query failed');
      mockPool.query.mockRejectedValue(error);

      await expect(
        db.query('SELECT * FROM invalid_table')
      ).rejects.toThrow('Query failed');
    });

    it('should handle empty result', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT * FROM threads WHERE id = $1', ['nonexistent']);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle null parameters', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT * FROM threads WHERE title = $1', [null]);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM threads WHERE title = $1',
        [null]
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle very long SQL', async () => {
      const longSql = 'SELECT * FROM threads WHERE ' + 'title = $1 OR '.repeat(100) + 'id = $2';
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      await db.query(longSql, ['test', '123']);

      expect(mockPool.query).toHaveBeenCalledWith(longSql, ['test', '123']);
    });
  });

  describe('beginTransaction', () => {
    it('should start transaction and return client', async () => {
      mockClient.query.mockResolvedValue({});

      const client = await db.beginTransaction();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(client).toBe(mockClient);
    });

    it('should release client on BEGIN failure', async () => {
      const error = new Error('BEGIN failed');
      mockClient.query.mockRejectedValue(error);

      await expect(db.beginTransaction()).rejects.toThrow('BEGIN failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    it('should commit transaction and release client', async () => {
      mockClient.query.mockResolvedValue({});

      await db.commit(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if commit fails', async () => {
      const error = new Error('COMMIT failed');
      mockClient.query.mockRejectedValue(error);

      await expect(db.commit(mockClient)).rejects.toThrow('COMMIT failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('should rollback transaction and release client', async () => {
      mockClient.query.mockResolvedValue({});

      await db.rollback(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      const error = new Error('ROLLBACK failed');
      mockClient.query.mockRejectedValue(error);

      await expect(db.rollback(mockClient)).rejects.toThrow('ROLLBACK failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close connection pool', async () => {
      mockPool.end.mockResolvedValue(undefined);

      await db.close();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should throw error if close fails', async () => {
      const error = new Error('Close failed');
      mockPool.end.mockRejectedValue(error);

      await expect(db.close()).rejects.toThrow('Close failed');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      const mockResult = {
        rows: [{ now: new Date() }],
        rowCount: 1,
      };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await db.testConnection();

      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()', []);
      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      const error = new Error('Connection failed');
      mockPool.query.mockRejectedValue(error);

      const result = await db.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Transaction workflow', () => {
    it('should handle complete transaction workflow', async () => {
      mockClient.query.mockResolvedValue({});

      // トランザクション開始
      const client = await db.beginTransaction();

      // クエリ実行
      await client.query('INSERT INTO threads (title) VALUES ($1)', [
        'Test Thread',
      ]);
      await client.query('INSERT INTO posts (thread_id, content) VALUES ($1, $2)', [
        'thread-123',
        'Test Post',
      ]);

      // コミット
      await db.commit(client);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO threads (title) VALUES ($1)',
        ['Test Thread']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO posts (thread_id, content) VALUES ($1, $2)',
        ['thread-123', 'Test Post']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error during transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // INSERT 1
        .mockRejectedValueOnce(new Error('Query failed')) // INSERT 2 fails
        .mockResolvedValueOnce({}); // ROLLBACK

      const client = await db.beginTransaction();

      try {
        await client.query('INSERT INTO threads (title) VALUES ($1)', [
          'Test Thread',
        ]);
        await client.query('INSERT INTO posts (thread_id, content) VALUES ($1, $2)', [
          'thread-123',
          'Test Post',
        ]);
      } catch (error) {
        await db.rollback(client);
      }

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('DatabaseClientFactory', () => {
    it('should create singleton instance', () => {
      const instance1 = DatabaseClientFactory.getInstance(mockConfig, logger);
      const instance2 = DatabaseClientFactory.getInstance(mockConfig, logger);

      expect(instance1).toBe(instance2);
    });

    it('should create new instance with createInstance', () => {
      const instance1 = DatabaseClientFactory.createInstance(mockConfig, logger);
      const instance2 = DatabaseClientFactory.createInstance(mockConfig, logger);

      expect(instance1).not.toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = DatabaseClientFactory.getInstance(mockConfig, logger);
      DatabaseClientFactory.resetInstance();
      const instance2 = DatabaseClientFactory.getInstance(mockConfig, logger);

      expect(instance1).not.toBe(instance2);
    });

    it('should close and reset instance', async () => {
      const instance = DatabaseClientFactory.getInstance(mockConfig, logger);

      // インスタンス作成後にmockPoolを取得
      const currentMockPool = (MockPool as any)._lastPool;
      currentMockPool.end.mockResolvedValue(undefined);

      await DatabaseClientFactory.closeInstance();

      expect(currentMockPool.end).toHaveBeenCalled();
    });
  });
});
