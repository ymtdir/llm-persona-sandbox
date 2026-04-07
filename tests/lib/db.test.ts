import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../../src/lib/db';

// pg モジュールのモック
vi.mock('pg', () => {
  const mockPoolInstance = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  const mockClientInstance = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const MockPool = vi.fn(() => mockPoolInstance);

  // Export mocks for test access
  MockPool.mockPoolInstance = mockPoolInstance;
  MockPool.mockClientInstance = mockClientInstance;

  return {
    default: {
      Pool: MockPool,
      PoolClient: vi.fn(),
    },
  };
});

describe('DatabaseClient', () => {
  let db: DatabaseClient;
  let mockPoolInstance: any;
  let mockClientInstance: any;
  let MockPool: any;

  beforeEach(async () => {
    // 環境変数を設定
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    // モックのリセット
    vi.clearAllMocks();

    // pg モジュールからモックインスタンスを取得
    const pg = await import('pg');
    MockPool = (pg as any).default.Pool;
    mockPoolInstance = MockPool.mockPoolInstance;
    mockClientInstance = MockPool.mockClientInstance;

    // モックのリセット
    mockPoolInstance.query.mockReset();
    mockPoolInstance.connect.mockReset();
    mockPoolInstance.end.mockReset();
    mockPoolInstance.on.mockReset();
    mockClientInstance.query.mockReset();
    mockClientInstance.release.mockReset();

    // モックの初期設定
    mockPoolInstance.connect.mockResolvedValue(mockClientInstance);

    db = new DatabaseClient();
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
      expect(mockPoolInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should accept connection string as parameter', () => {
      const customUrl = 'postgresql://custom:pass@localhost:5432/customdb';
      const customDb = new DatabaseClient(customUrl);

      const lastCall = MockPool.mock.calls[MockPool.mock.calls.length - 1][0];

      expect(lastCall.connectionString).toBe(customUrl);
    });
  });

  describe('query', () => {
    it('should execute parameterized query', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPoolInstance.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT * FROM threads WHERE id = $1', [
        'thread-123',
      ]);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        'SELECT * FROM threads WHERE id = $1',
        ['thread-123']
      );
      expect(result).toEqual(mockResult);
    });

    it('should execute query without parameters', async () => {
      const mockResult = { rows: [{ count: 10 }], rowCount: 1 };
      mockPoolInstance.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT COUNT(*) FROM threads');

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM threads',
        []
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw error on query failure', async () => {
      const error = new Error('Query failed');
      mockPoolInstance.query.mockRejectedValue(error);

      await expect(
        db.query('SELECT * FROM invalid_table')
      ).rejects.toThrow('Query failed');
    });

    it('should log query execution', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockResult = { rows: [], rowCount: 0 };
      mockPoolInstance.query.mockResolvedValue(mockResult);

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
      mockClientInstance.query.mockResolvedValue({});

      const client = await db.beginTransaction();

      expect(mockPoolInstance.connect).toHaveBeenCalled();
      expect(mockClientInstance.query).toHaveBeenCalledWith('BEGIN');
      expect(client).toBe(mockClientInstance);
    });

    it('should release client on BEGIN failure', async () => {
      const error = new Error('BEGIN failed');
      mockClientInstance.query.mockRejectedValue(error);

      await expect(db.beginTransaction()).rejects.toThrow('BEGIN failed');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    it('should commit transaction and release client', async () => {
      mockClientInstance.query.mockResolvedValue({});

      await db.commit(mockClientInstance);

      expect(mockClientInstance.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });

    it('should release client even if commit fails', async () => {
      const error = new Error('COMMIT failed');
      mockClientInstance.query.mockRejectedValue(error);

      await expect(db.commit(mockClientInstance)).rejects.toThrow('COMMIT failed');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('should rollback transaction and release client', async () => {
      mockClientInstance.query.mockResolvedValue({});

      await db.rollback(mockClientInstance);

      expect(mockClientInstance.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      const error = new Error('ROLLBACK failed');
      mockClientInstance.query.mockRejectedValue(error);

      await expect(db.rollback(mockClientInstance)).rejects.toThrow('ROLLBACK failed');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close connection pool', async () => {
      mockPoolInstance.end.mockResolvedValue(undefined);

      await db.close();

      expect(mockPoolInstance.end).toHaveBeenCalled();
    });

    it('should throw error if close fails', async () => {
      const error = new Error('Close failed');
      mockPoolInstance.end.mockRejectedValue(error);

      await expect(db.close()).rejects.toThrow('Close failed');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      const mockResult = {
        rows: [{ now: new Date() }],
        rowCount: 1,
      };
      mockPoolInstance.query.mockResolvedValue(mockResult);

      const result = await db.testConnection();

      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT NOW()', []);
      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      const error = new Error('Connection failed');
      mockPoolInstance.query.mockRejectedValue(error);

      const result = await db.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Transaction workflow', () => {
    it('should handle complete transaction workflow', async () => {
      mockClientInstance.query.mockResolvedValue({});

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

      expect(mockClientInstance.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClientInstance.query).toHaveBeenCalledWith(
        'INSERT INTO threads (title) VALUES ($1)',
        ['Test Thread']
      );
      expect(mockClientInstance.query).toHaveBeenCalledWith(
        'INSERT INTO posts (thread_id, content) VALUES ($1, $2)',
        ['thread-123', 'Test Post']
      );
      expect(mockClientInstance.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });

    it('should rollback on error during transaction', async () => {
      mockClientInstance.query
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

      expect(mockClientInstance.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClientInstance.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientInstance.release).toHaveBeenCalled();
    });
  });
});
