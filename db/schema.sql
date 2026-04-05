-- LLM Persona Sandbox Database Schema
-- PostgreSQL 17

-- threads テーブル: スレッド情報
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_post_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  post_count INTEGER DEFAULT 0
);

-- スレッド一覧の高速化（最新レス順ソート）
CREATE INDEX idx_threads_last_post_at ON threads(last_post_at DESC);

-- posts テーブル: レス情報
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  post_number INTEGER NOT NULL,
  author_name VARCHAR(50) NOT NULL DEFAULT '名無しさん',
  character_id VARCHAR(50),
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  anchors TEXT,
  is_user_post BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(thread_id, post_number)
);

-- レス取得の高速化
CREATE INDEX idx_posts_thread_id ON posts(thread_id);
CREATE INDEX idx_posts_thread_post_number ON posts(thread_id, post_number);
