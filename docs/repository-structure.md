# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

```
llm-persona-sandbox/
├── src/                     # ソースコード
│   ├── routes/              # Webレイヤー（HTTPエンドポイント）
│   ├── services/            # サービスレイヤー（ビジネスロジック）
│   ├── lib/                 # データレイヤー（DB・外部API）
│   ├── views/               # Hono JSXビュー（HTML生成）
│   ├── types/               # TypeScript型定義
│   └── index.tsx            # アプリケーションエントリーポイント
├── db/                      # データベーススキーマ
│   └── schema.sql           # PostgreSQLスキーマ定義
├── docs/                    # プロジェクトドキュメント
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md (本ドキュメント)
│   ├── development-guidelines.md
│   └── glossary.md
├── .claude/                 # Claude Code設定
│   ├── commands/            # スラッシュコマンド
│   └── skills/              # タスクモード別スキル
├── docker-compose.yml       # Docker Compose設定
├── Dockerfile               # アプリコンテナ定義
├── package.json             # Node.js依存関係
├── tsconfig.json            # TypeScript設定
├── .env.example             # 環境変数テンプレート
├── .env                     # 環境変数（Git管理外）
├── .gitignore               # Git除外設定
└── README.md                # プロジェクト概要
```

## ディレクトリ詳細

### src/ (ソースコードディレクトリ)

#### routes/

**役割**: Webレイヤー - HTTPリクエストの受付、バリデーション、レスポンス生成

**配置ファイル**:

- `threads.tsx`: スレッド関連エンドポイント（一覧表示、詳細表示、作成、レス投稿）

**命名規則**:

- ファイル名: `[リソース名の複数形].tsx`
- クラス名: `[リソース名]Routes`（該当する場合）

**依存関係**:

- 依存可能: `services/`, `types/`, `views/`
- 依存禁止: `lib/`（直接アクセス禁止、必ずservices経由）

**例**:

```typescript
// routes/threads.tsx
import { Hono } from 'hono';
import { ThreadManager } from '../services/threadManager';
import { PostManager } from '../services/postManager';
import { ResponseGenerator } from '../services/responseGenerator';
import { ThreadList } from '../views/ThreadList';
import { ThreadDetail } from '../views/ThreadDetail';

const app = new Hono();

// GET / - スレッド一覧表示
app.get('/', async (c) => {
  const threads = await threadManager.listThreads(50);
  return c.html(<ThreadList threads={threads} />);
});

// GET /thread/:id - スレッド詳細表示
app.get('/thread/:id', async (c) => {
  const threadId = c.req.param('id');
  const thread = await threadManager.getThread(threadId);
  const posts = await postManager.getPostsByThread(threadId);
  return c.html(<ThreadDetail thread={thread} posts={posts} />);
});

// POST /thread - スレッド作成
app.post('/thread', async (c) => {
  const body = await c.req.json();
  // Zodバリデーション
  const validated = threadSchema.parse(body);
  const thread = await threadManager.createThread(validated.title, validated.content);
  return c.redirect(`/thread/${thread.id}`);
});

// POST /thread/:id/post - レス投稿
app.post('/thread/:id/post', async (c) => {
  const threadId = c.req.param('id');
  const body = await c.req.json();
  const validated = postSchema.parse(body);

  // ユーザーレス保存
  const userPost = await postManager.createPost({
    threadId,
    content: validated.content,
    isUserPost: true,
  });

  // AIレス生成（非同期）
  const history = await postManager.getRecentPosts(threadId, 20);
  responseGenerator.generateResponses(threadId, userPost, history);

  return c.redirect(`/thread/${threadId}`);
});

export default app;
```

#### services/

**役割**: サービスレイヤー - ビジネスロジック、データ変換、トランザクション制御

**配置ファイル**:

- `threadManager.ts`: スレッドのCRUD操作
- `postManager.ts`: レスのCRUD操作
- `responseGenerator.ts`: AIキャラクターによるレス生成の統括
- `characterSelector.ts`: 投稿内容に応じたキャラクター選択
- `ollamaClient.ts`: Ollama APIへのHTTPリクエスト送信（※データレイヤーの責務だが、外部API呼び出しのためservicesに配置）

**命名規則**:

- ファイル名: `camelCase.ts`
- クラス名: `PascalCase`（例: `ThreadManager`, `ResponseGenerator`）

**依存関係**:

- 依存可能: `lib/`, `types/`, 他の`services/`
- 依存禁止: `routes/`, `views/`

**例**:

```
services/
├── threadManager.ts       # スレッド管理
├── postManager.ts         # レス管理
├── responseGenerator.ts   # AIレス生成統括
├── characterSelector.ts   # キャラクター選択
└── ollamaClient.ts        # Ollama API呼び出し
```

**循環依存の回避**:

```typescript
// ✅ 良い例: 一方向の依存
// responseGenerator.ts
import { CharacterSelector } from './characterSelector';
import { OllamaClient } from './ollamaClient';
import { PostManager } from './postManager';

// ❌ 悪い例: 循環依存
// responseGenerator.ts
import { PostManager } from './postManager';

// postManager.ts
import { ResponseGenerator } from './responseGenerator'; // 循環依存
```

#### lib/

**役割**: データレイヤー - データ永続化、外部APIアクセス、共通ユーティリティ

**配置ファイル**:

- `db.ts`: PostgreSQL接続とクエリ実行
- `personas.ts`: ペルソナ（キャラクター）定義
- `utils.ts`: 汎用ユーティリティ関数

**命名規則**:

- ファイル名: `camelCase.ts`
- クラス名: `PascalCase`（例: `DatabaseClient`）

**依存関係**:

- 依存可能: `types/`, `node-postgres`, `fetch API`
- 依存禁止: `routes/`, `services/`, `views/`

**例**:

```typescript
// lib/db.ts
import { Pool, QueryResult } from 'pg';

export class DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(sql, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// lib/personas.ts
import { Character } from '../types';

export const characters: Character[] = [
  {
    id: 'majiresu',
    displayName: 'マジレスニキ',
    systemPrompt: 'あなたは2chの「マジレスニキ」です。...',
    personality: '真面目で論理的、煽りに対しても冷静に反論する',
    speechStyle: '「〜だろ」「いや、それは違う」など断定的な口調',
    temperature: 0.7,
    keywords: ['プログラミング', '技術', '正論', '理由'],
    frequency: 8,
  },
  {
    id: 'aori',
    displayName: '煽りカス',
    systemPrompt: 'あなたは2chの「煽りカス」です。...',
    personality: '攻撃的で挑発的、他人の意見を嘲笑する',
    speechStyle: '「ｗｗｗ」「〜じゃんｗ」など煽り口調',
    temperature: 0.9,
    keywords: ['初心者', '間違い', '失敗', '質問'],
    frequency: 7,
  },
  // ... 他のキャラクター
];

export function getCharacters(): Character[] {
  return characters;
}

export function getCharacterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}
```

#### views/

**役割**: Hono JSXビュー - HTML生成、2ch風UIのレンダリング

**配置ファイル**:

- `Layout.tsx`: 共通レイアウト（ヘッダー、フッター、CSS）
- `ThreadList.tsx`: スレッド一覧ビュー
- `ThreadDetail.tsx`: スレッド詳細ビュー（レス一覧、投稿フォーム）

**命名規則**:

- ファイル名: `PascalCase.tsx`（Reactコンポーネントと同様）
- コンポーネント名: `PascalCase`

**依存関係**:

- 依存可能: `types/`, Hono JSX
- 依存禁止: `routes/`, `services/`, `lib/`

**例**:

```tsx
// views/Layout.tsx
import { FC } from 'hono/jsx';

type LayoutProps = {
  title: string;
  children: any;
};

export const Layout: FC<LayoutProps> = ({ title, children }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>{title} - LLM Persona Sandbox</title>
        <style>{`
          body {
            font-family: 'MS PGothic', 'Osaka-Mono', monospace;
            background: #efefef;
            color: #000;
          }
          .thread-detail {
            background: #f0e0d6;
            border: 1px solid #cccccc;
            padding: 16px;
          }
        `}</style>
      </head>
      <body>
        <h1>LLM Persona Sandbox</h1>
        {children}
      </body>
    </html>
  );
};

// views/ThreadList.tsx
import { FC } from 'hono/jsx';
import { Thread } from '../types';
import { Layout } from './Layout';

type ThreadListProps = {
  threads: Thread[];
};

export const ThreadList: FC<ThreadListProps> = ({ threads }) => {
  return (
    <Layout title="スレッド一覧">
      <div class="thread-list">
        <h2>■ スレッド一覧</h2>
        {threads.map((thread) => (
          <div key={thread.id}>
            <a href={`/thread/${thread.id}`}>
              {thread.title} ({thread.postCount}) [
              {thread.lastPostAt.toLocaleString()}]
            </a>
          </div>
        ))}
        <form action="/thread" method="POST">
          <button>新しいスレッドを立てる</button>
        </form>
      </div>
    </Layout>
  );
};
```

#### types/

**役割**: TypeScript型定義の集約

**配置ファイル**:

- `index.ts`: 全ての型定義をエクスポート

**命名規則**:

- ファイル名: `index.ts`（単一ファイル）または `[ドメイン].ts`（複数ファイル）
- 型名: `PascalCase`（例: `Thread`, `Post`, `Character`）

**依存関係**:

- 依存可能: なし（型定義は依存を持たない）
- 依存禁止: すべて

**例**:

```typescript
// types/index.ts
export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  lastPostAt: Date;
  postCount: number;
}

export interface Post {
  id: number;
  threadId: string;
  postNumber: number;
  authorName: string;
  characterId: string | null;
  content: string;
  anchors: string | null;
  isUserPost: boolean;
  createdAt: Date;
}

export interface Character {
  id: string;
  displayName: string;
  systemPrompt: string;
  personality: string;
  speechStyle: string;
  temperature: number;
  keywords: string[];
  frequency: number;
}

export interface CreatePostData {
  threadId: string;
  postNumber: number;
  authorName?: string;
  characterId?: string;
  content: string;
  anchors?: string;
  isUserPost: boolean;
}
```

#### index.tsx

**役割**: アプリケーションのエントリーポイント - Honoアプリの初期化、ルート登録、サーバー起動

**例**:

```typescript
// src/index.tsx
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import threadsRoute from './routes/threads';

const app = new Hono();

// ルート登録
app.route('/', threadsRoute);

// サーバー起動
const port = parseInt(process.env.PORT || '3000', 10);
serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running at http://localhost:${port}`);
```

### db/ (データベーススキーマディレクトリ)

**役割**: PostgreSQLスキーマ定義の管理

**配置ファイル**:

- `schema.sql`: テーブル定義、インデックス定義

**例**:

```sql
-- db/schema.sql
-- threads テーブル
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_post_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  post_count INTEGER DEFAULT 0
);

CREATE INDEX idx_threads_last_post_at ON threads(last_post_at DESC);

-- posts テーブル
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

CREATE INDEX idx_posts_thread_id ON posts(thread_id);
CREATE INDEX idx_posts_thread_post_number ON posts(thread_id, post_number);
```

### docs/ (ドキュメントディレクトリ)

**配置ドキュメント**:

- `product-requirements.md`: プロダクト要求定義書（PRD）
- `functional-design.md`: 機能設計書
- `architecture.md`: アーキテクチャ設計書
- `repository-structure.md`: リポジトリ構造定義書（本ドキュメント）
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: 用語集

### .claude/ (Claude Code設定ディレクトリ)

**役割**: Claude Code設定とカスタマイズ

**構造**:

```
.claude/
├── commands/              # スラッシュコマンド
│   ├── setup-project.md
│   ├── create-pr.md
│   ├── create-issue.md
│   └── resolve-issue.md
└── skills/                # タスクモード別スキル
    ├── prd-writing/
    ├── functional-design/
    ├── architecture-design/
    ├── repository-structure/
    ├── development-guidelines/
    ├── glossary-creation/
    ├── issue-tracking/
    ├── issue-resolution/
    └── pr-creation/
```

## ファイル配置規則

### ソースファイル

| ファイル種別         | 配置先    | 命名規則       | 例               |
| -------------------- | --------- | -------------- | ---------------- |
| ルート定義           | routes/   | [リソース].tsx | threads.tsx      |
| サービスクラス       | services/ | camelCase.ts   | threadManager.ts |
| リポジトリクラス     | lib/      | camelCase.ts   | db.ts            |
| ビューコンポーネント | views/    | PascalCase.tsx | ThreadList.tsx   |
| 型定義               | types/    | index.ts       | index.ts         |
| ペルソナ定義         | lib/      | camelCase.ts   | personas.ts      |
| ユーティリティ関数   | lib/      | camelCase.ts   | utils.ts         |
| エントリーポイント   | src/      | index.tsx      | index.tsx        |

### 設定ファイル

| ファイル種別         | 配置先             | 命名規則           | 例                 |
| -------------------- | ------------------ | ------------------ | ------------------ |
| Docker Compose設定   | プロジェクトルート | docker-compose.yml | docker-compose.yml |
| Dockerfile           | プロジェクトルート | Dockerfile         | Dockerfile         |
| TypeScript設定       | プロジェクトルート | tsconfig.json      | tsconfig.json      |
| npm依存関係          | プロジェクトルート | package.json       | package.json       |
| 環境変数             | プロジェクトルート | .env               | .env               |
| 環境変数テンプレート | プロジェクトルート | .env.example       | .env.example       |
| Git除外設定          | プロジェクトルート | .gitignore         | .gitignore         |
| ESLint設定           | プロジェクトルート | eslint.config.js   | eslint.config.js   |
| Prettier設定         | プロジェクトルート | .prettierrc        | .prettierrc        |

## 命名規則

### ディレクトリ名

- **レイヤーディレクトリ**: 複数形、kebab-case
  - 例: `routes/`, `services/`, `views/`
- **機能ディレクトリ**: 単数形、kebab-case（現時点では不使用、将来的なスケーリング時に検討）
  - 例: `task-management/`, `user-authentication/`

### ファイル名

- **ルート定義**: kebab-case.tsx（リソース名の複数形）
  - 例: `threads.tsx`, `posts.tsx`
- **サービスクラス**: camelCase.ts
  - 例: `threadManager.ts`, `postManager.ts`, `responseGenerator.ts`
- **ビューコンポーネント**: PascalCase.tsx
  - 例: `ThreadList.tsx`, `ThreadDetail.tsx`, `Layout.tsx`
- **型定義**: index.ts または PascalCase.ts
  - 例: `index.ts`, `Thread.ts`
- **定数ファイル**: camelCase.ts
  - 例: `personas.ts`, `utils.ts`

### クラス名・関数名

- **クラス**: PascalCase
  - 例: `ThreadManager`, `ResponseGenerator`, `DatabaseClient`
- **関数**: camelCase
  - 例: `createThread()`, `getCharacters()`, `formatThreadHistory()`
- **コンポーネント**: PascalCase
  - 例: `ThreadList`, `Layout`

## 依存関係のルール

### レイヤー間の依存

```
routes/ (Webレイヤー)
    ↓ (OK)
services/ (サービスレイヤー)
    ↓ (OK)
lib/ (データレイヤー)
```

**許可される依存**:

- `routes/` → `services/`, `views/`, `types/` ✅
- `services/` → `lib/`, `types/` ✅
- `lib/` → `types/` ✅
- `views/` → `types/` ✅

**禁止される依存**:

- `lib/` → `services/` ❌
- `lib/` → `routes/` ❌
- `services/` → `routes/` ❌
- `services/` → `views/` ❌
- `views/` → `routes/` ❌
- `views/` → `services/` ❌
- `views/` → `lib/` ❌

### モジュール間の依存

**循環依存の禁止**:

```typescript
// ❌ 悪い例: 循環依存
// services/responseGenerator.ts
import { PostManager } from './postManager';

// services/postManager.ts
import { ResponseGenerator } from './responseGenerator'; // 循環依存
```

**解決策: 依存関係の見直し**:

```typescript
// ✅ 良い例: 一方向の依存
// services/responseGenerator.ts
import { PostManager } from './postManager';
import { CharacterSelector } from './characterSelector';

// services/postManager.ts
// ResponseGeneratorに依存しない（呼び出しはroutes/から）
```

## スケーリング戦略

### 機能の追加

新しい機能を追加する際の配置方針:

1. **小規模機能**: 既存ファイルに追加
   - 例: `threadManager.ts`に新しいメソッド`archiveThread()`を追加
2. **中規模機能**: 新しいファイルを作成
   - 例: `services/searchService.ts`を追加してスレッド検索機能を実装
3. **大規模機能**: レイヤー内にサブディレクトリを作成（将来実装）
   - 例: `services/analytics/`ディレクトリを作成し、アクセス解析機能を分離

**現時点の構成（MVP段階）**:

```
src/
├── routes/
│   └── threads.tsx          # 全エンドポイント
├── services/
│   ├── threadManager.ts
│   ├── postManager.ts
│   ├── responseGenerator.ts
│   ├── characterSelector.ts
│   └── ollamaClient.ts
├── lib/
│   ├── db.ts
│   ├── personas.ts
│   └── utils.ts
└── views/
    ├── Layout.tsx
    ├── ThreadList.tsx
    └── ThreadDetail.tsx
```

**将来的なスケーリング（機能追加時）**:

```
src/
├── routes/
│   ├── threads.tsx          # スレッド関連
│   ├── users.tsx            # ユーザー認証（将来実装）
│   └── search.tsx           # 検索機能（将来実装）
├── services/
│   ├── thread/              # スレッド機能をモジュール化
│   │   ├── threadManager.ts
│   │   ├── postManager.ts
│   │   └── responseGenerator.ts
│   ├── character/
│   │   ├── characterSelector.ts
│   │   └── characterManager.ts
│   └── analytics/           # アクセス解析（将来実装）
│       └── viewTracker.ts
└── lib/
    ├── db.ts
    ├── ollamaClient.ts      # Ollama専用クライアント
    ├── personas.ts
    └── utils.ts
```

### ファイルサイズの管理

**ファイル分割の目安**:

- 1ファイル: 300行以下を推奨
- 300-500行: リファクタリングを検討
- 500行以上: 分割を強く推奨

**分割方法の例**:

```typescript
// 悪い例: 1ファイルに全機能（800行）
// services/responseGenerator.ts

// 良い例: 責務ごとに分割
// services/responseGenerator.ts (200行) - レス生成の統括
// services/promptBuilder.ts (150行) - プロンプト構築ロジック
// services/responseParser.ts (100行) - LLMレスポンスのパース
```

## 特殊ディレクトリ

### .steering/ (ステアリングファイル)

**役割**: 特定の開発作業における「今回何をするか」を定義

**構造**:

```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md      # 今回の作業の要求内容
    ├── design.md            # 変更内容の設計
    └── tasklist.md          # タスクリスト
```

**命名規則**: `20260115-add-user-profile` 形式

**使用例**:

```
.steering/
└── 20260130-implement-character-selection/
    ├── requirements.md      # キャラクター選択ロジックの要求
    ├── design.md            # 選択アルゴリズムの設計
    └── tasklist.md          # 実装タスク一覧
```

## 除外設定

### .gitignore

プロジェクトで除外すべきファイル:

```
# 依存関係
node_modules/

# ビルド成果物
dist/
build/

# 環境変数
.env

# ステアリングファイル
.steering/

# ログファイル
*.log
npm-debug.log*

# OS固有
.DS_Store
Thumbs.db

# IDEファイル
.vscode/
.idea/

# Dockerボリュームデータ（ホストマシン上のバックアップ等）
.backup/
```

### .dockerignore

Dockerビルド時に除外すべきファイル:

```
node_modules/
.git/
.gitignore
.env
.steering/
*.log
.DS_Store
README.md
docs/
```

## まとめ

本リポジトリ構造定義書では、LLM Persona Sandboxの明確で保守しやすいディレクトリ構造を定義しました。

**主要な設計判断**:

1. **レイヤードアーキテクチャの徹底**: routes（Web）→ services（ビジネスロジック）→ lib（データ）の一方向依存
2. **責務の明確化**: 各ディレクトリが単一の明確な役割を持つ
3. **スケーリングへの配慮**: MVP段階はシンプルな構造、将来的にはモジュール分離が容易
4. **命名規則の統一**: ファイル種別に応じたcamelCase/PascalCase/kebab-caseの使い分け

**次のステップ**:

1. 開発ガイドラインの作成（`docs/development-guidelines.md`）
2. 用語集の作成（`docs/glossary.md`）
3. 実装開始（Docker環境構築、データベーススキーマ作成、コア機能実装）
