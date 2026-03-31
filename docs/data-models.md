# データモデル定義書 (Data Models)

## 概要

LLM Persona Sandboxで使用されるデータモデルとデータベーススキーマの詳細定義。

**関連ドキュメント**:
- [機能設計書](./functional-design.md) - データモデルの使用方法
- [アーキテクチャ設計書](./architecture.md) - データ永続化戦略

## エンティティ定義

### Thread（スレッド）

**概要**: 2ch風掲示板における話題のまとまり。

**フィールド**:

```typescript
interface Thread {
  id: string;           // UUID v4形式、主キー
  title: string;        // スレッドタイトル（1-100文字）
  createdAt: Date;      // 作成日時
  lastPostAt: Date;     // 最終レス日時
  postCount: number;    // レス数（0以上）
}
```

**制約**:
- `id`: UUID v4形式、主キー、自動生成
- `title`: 1-100文字、必須
- `postCount`: 0以上、デフォルト0
- `lastPostAt`: レス追加時に自動更新

**リレーション**:
- Post との 1:N 関係（1つのスレッドは複数のレスを持つ）

### Post（レス）

**概要**: スレッド内の個別の投稿。

**フィールド**:

```typescript
interface Post {
  id: number;           // 連番ID、自動採番
  threadId: string;     // スレッドID（外部キー）
  postNumber: number;   // レス番号（スレッド内で1から開始）
  authorName: string;   // 投稿者名（デフォルト: "名無しさん"）
  characterId: string | null; // キャラクターID（ユーザー投稿の場合はnull）
  content: string;      // 投稿内容（1-2000文字）
  anchors: string | null; // アンカー情報（カンマ区切り: "1,2,5"）
  isUserPost: boolean;  // ユーザー投稿フラグ（true: ユーザー, false: AI）
  createdAt: Date;      // 作成日時
}
```

**制約**:
- `id`: 自動採番、主キー
- `threadId`: threads.id への外部キー
- `postNumber`: スレッド内で連番、1から開始
- `content`: 1-2000文字、必須
- `isUserPost`: デフォルト false
- `(threadId, postNumber)`: UNIQUE制約

**リレーション**:
- Thread との N:1 関係（複数のレスは1つのスレッドに属する）

### Character（キャラクター）

**概要**: AIが演じる2ch住民のペルソナ。

**フィールド**:

```typescript
interface Character {
  id: string;           // キャラクターID（例: "majiresu"）
  displayName: string;  // 表示名（例: "マジレスニキ"）
  systemPrompt: string; // System Prompt（LLMに渡す指示）
  personality: string;  // 性格説明
  speechStyle: string;  // 口調の特徴
  temperature: number;  // LLM temperature（0.0-1.0）
  keywords: string[];   // 反応しやすいキーワード
  frequency: number;    // 発言頻度（1-10、高いほど頻繁）
}
```

**制約**:
- `id`: 英数字、主キー
- `temperature`: 0.0-1.0の範囲
- `frequency`: 1-10の範囲

**データソース**: コード内定義（`src/lib/personas.ts`）、データベースには保存しない

**デフォルトキャラクター**:
- `majiresu`: マジレスニキ（真面目、論理的）
- `aori`: 煽りカス（攻撃的、挑発的）
- `monoshiri`: 物知りおじさん（博識、説教口調）
- `rom`: ROM専（控えめ、観察者）
- `newcomer`: 新参（初心者、質問多め）

## ER図

```
┌────────────────────────┐           ┌────────────────────────┐
│       THREAD           │           │         POST           │
├────────────────────────┤           ├────────────────────────┤
│ id           (PK)      │───────┐   │ id           (PK)      │
│ title                  │       │   │ threadId     (FK)      │
│ createdAt              │       │   │ postNumber             │
│ lastPostAt             │       └──<│ authorName             │
│ postCount              │   1:N     │ characterId            │
└────────────────────────┘           │ content                │
                                     │ anchors                │
                                     │ isUserPost             │
                                     │ createdAt              │
                                     └────────────────────────┘

リレーション:
- 1つのTHREADは複数のPOSTを持つ (1:N)
- ON DELETE CASCADE: スレッド削除時に関連レスも自動削除
```

## データベーススキーマ

### threads テーブル

```sql
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_post_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  post_count INTEGER DEFAULT 0
);

-- スレッド一覧の高速化（最新レス順ソート）
CREATE INDEX idx_threads_last_post_at ON threads(last_post_at DESC);
```

**インデックス戦略**:
- `idx_threads_last_post_at`: スレッド一覧表示時の `ORDER BY last_post_at DESC` を最適化

### posts テーブル

```sql
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
```

**制約の意図**:
- `ON DELETE CASCADE`: スレッド削除時に関連レスも自動削除（参照整合性の保証）
- `CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)`: データベースレベルでバリデーション
- `UNIQUE(thread_id, post_number)`: レス番号の重複防止

**インデックス戦略**:
- `idx_posts_thread_id`: スレッド詳細表示時のレス取得を最適化
- `idx_posts_thread_post_number`: 複合インデックスによる高速検索

## データ型の選択理由

| フィールド    | 型          | 理由                                                                     |
| ------------- | ----------- | ------------------------------------------------------------------------ |
| threads.id    | UUID        | 分散システムでもID衝突が発生しない、URLに埋め込み可能、セキュリティ向上 |
| posts.id      | SERIAL      | 自動採番、整数型で効率的                                                 |
| title         | VARCHAR(100)| 固定長制約によるバリデーション、インデックス効率化                       |
| content       | TEXT        | 可変長テキスト、2000文字制限はCHECK制約で実現                            |
| is_user_post  | BOOLEAN     | true/false の明確な表現、インデックス効率が良い                          |
| created_at    | TIMESTAMP   | タイムゾーン非対応だが、単一サーバー運用では問題なし                     |
| anchors       | TEXT        | カンマ区切り文字列（"1,2,5"）、JSON型も検討したが簡潔さを優先             |

## サンプルデータ

### スレッド作成例

```sql
INSERT INTO threads (title) VALUES ('プログラミング言語で一番好きなのは？');
-- 結果: id = 550e8400-e29b-41d4-a716-446655440000（自動生成）
```

### ユーザーレス投稿例

```sql
INSERT INTO posts (thread_id, post_number, author_name, content, is_user_post)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  '名無しさん',
  '俺はTypeScriptかな',
  true
);
```

### AIレス投稿例

```sql
INSERT INTO posts (thread_id, post_number, author_name, character_id, content, anchors, is_user_post)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  2,
  'マジレスニキ',
  'majiresu',
  'いや、それは正しい選択だろ。型安全性が段違いだし、エディタの補完も強力。>>1の言う通り、TypeScript一択。',
  '1',
  false
);
```

## データ整合性の保証

### トランザクション管理

**スレッド作成時**:

```typescript
BEGIN;
  INSERT INTO threads (title) VALUES ('スレッドタイトル') RETURNING id;
  INSERT INTO posts (thread_id, post_number, content, is_user_post)
    VALUES (thread_id, 1, '初回投稿', true);
  UPDATE threads SET post_count = 1 WHERE id = thread_id;
COMMIT;
```

**レス投稿時**:

```typescript
BEGIN;
  INSERT INTO posts (thread_id, post_number, content, is_user_post)
    VALUES (thread_id, next_post_number, 'レス内容', true);
  UPDATE threads SET post_count = post_count + 1, last_post_at = CURRENT_TIMESTAMP
    WHERE id = thread_id;
COMMIT;
```

### 外部キー制約の活用

```sql
-- スレッド削除時に関連レスも自動削除
DELETE FROM threads WHERE id = '550e8400-e29b-41d4-a716-446655440000';
-- 結果: posts テーブルの関連レスも自動削除（ON DELETE CASCADE）
```

## パフォーマンス考慮事項

### クエリ最適化

**スレッド一覧取得**:

```sql
-- インデックス idx_threads_last_post_at を使用
SELECT * FROM threads
ORDER BY last_post_at DESC
LIMIT 50;
```

**スレッド詳細とレス取得**:

```sql
-- 2つのクエリを並列実行
SELECT * FROM threads WHERE id = $1;
SELECT * FROM posts WHERE thread_id = $1 ORDER BY post_number;
```

### データ量の想定

- **MVP段階**: スレッド数 1000件、レス数 10000件、DB容量 約100MB
- **インデックスサイズ**: 約20MB（全インデックス合計）
- **想定成長率**: 月100スレッド、月1000レス

## バックアップ・復元

詳細は [デプロイメントガイド](./deployment-guide.md#バックアップ戦略) を参照。

**基本コマンド**:

```bash
# バックアップ
docker exec db pg_dump -U postgres llm_persona_sandbox > backup.sql

# 復元
docker exec -i db psql -U postgres llm_persona_sandbox < backup.sql
```

## 関連ドキュメント

- [機能設計書](./functional-design.md) - データモデルの使用方法
- [アーキテクチャ設計書](./architecture.md) - データ永続化戦略
- [用語集](./glossary.md) - Thread, Post, Character の用語説明
