import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../../src/lib/db';
import pg from 'pg';

// pg モジュールのモック
vi.mock('pg', () => {
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    default: {
      Pool: vi.fn(() => mockPool),
      PoolClient: vi.fn(),
    },
  };
});

describe('DatabaseClient', () => {
  let db: DatabaseClient;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    // 環境変数を設定
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    // モックのリセット
    vi.clearAllMocks();

    // モッククライアントの作成
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    // モックプールの取得
    const Pool = (pg as any).default.Pool;
    db = new DatabaseClient();
    mockPool = Pool.mock.results[0].value;
    mockPool.connect.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  describe('constructor', () => {
    it('should throw error if DATABASE_URL is not defined', () => {
      delete process.env.DATABASE_URL;
      expect(() => new DatabaseClient()).toThrow(
        'DATABASE_URL is not defined'
      );
    });

    it('should initialize pool with connection string', () => {
      const Pool = (pg as any).default.Pool;
      expect(Pool).toHaveBeenCalledWith(
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

    it('should accept connection string as parameter', () => {
      const customUrl = 'postgresql://custom:pass@localhost:5432/customdb';
      const customDb = new DatabaseClient(customUrl);

      const Pool = (pg as any).default.Pool;
      const lastCall = Pool.mock.calls[Pool.mock.calls.length - 1][0];

      expect(lastCall.connectionString).toBe(customUrl);
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

    it('should log query execution', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      await db.query('SELECT * FROM threads');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DatabaseClient] Query executed',
        expect.objectContaining({
          sql: expect.any(String),
          duration: expect.stringContaining('ms'),
          rows: 0,
        })
      );

      consoleSpy.mockRestore();
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

      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
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
});
