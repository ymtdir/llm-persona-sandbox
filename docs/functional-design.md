# 機能設計書 (Functional Design Document)

## システム構成図

```
┌──────────────┐
│  ユーザー    │
│  (ブラウザ)  │
└──────┬───────┘
       │ HTTP Request
       ▼
┌────────────────────────────┐
│  Honoアプリケーション      │
│  (routes + views)          │
└─┬──────┬──────────────────┬┘
  │      │                  │
  │      │                  ▼
  │      │         ┌──────────────────────┐
  │      │         │ ResponseGenerator    │
  │      │         │ (AIレス生成)         │
  │      │         └────┬──────────────┬──┘
  │      │              │              │
  │      │              ▼              ▼
  │      │    ┌─────────────────┐  ┌──────────────┐
  │      │    │CharacterSelector│  │OllamaClient  │
  │      │    │(キャラクター選択)│  │(LLM API呼出) │
  │      │    └─────────────────┘  └──────┬───────┘
  │      │                                 │ HTTP API
  │      │                                 ▼
  │      │                        ┌─────────────────┐
  │      │                        │    Ollama       │
  │      │                        │  (LLMサーバー)  │
  │      │                        └─────────────────┘
  │      │
  ▼      ▼
┌──────────────┐  ┌──────────────┐
│ThreadManager │  │ PostManager  │
│(スレッド管理)│  │ (レス管理)   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                ▼
        ┌──────────────┐
        │  PostgreSQL  │
        │(threads/posts)│
        └──────────────┘
```

## Docker構成図

```
┌────────────────────────────────────────────────────────┐
│             Docker Compose環境                         │
│                                                        │
│  ┌──────────────────┐                                 │
│  │      app         │                                 │
│  │  Node.js + Hono  │                                 │
│  │   Port: 3000     │                                 │
│  └────┬──────────┬──┘                                 │
│       │          │                                    │
│       │          └──────────┐                         │
│       │                     │                         │
│       │  http://ollama:11434│ postgresql://db:5432   │
│       │                     │                         │
│       ▼                     ▼                         │
│  ┌──────────────┐     ┌──────────────┐               │
│  │   ollama     │     │     db       │               │
│  │  Ollama LLM  │     │ PostgreSQL   │               │
│  │ Port: 11434  │     │  Port: 5432  │               │
│  └──────┬───────┘     └──────┬───────┘               │
│         │                    │                        │
└─────────┼────────────────────┼────────────────────────┘
          │ (volume)           │ (volume)
          ▼                    ▼
  ┌───────────────┐    ┌───────────────┐
  │ ollama-data   │    │   db-data     │
  └───────────────┘    └───────────────┘

外部アクセス:
  ユーザー → http://localhost:3000 → app
```

## 技術スタック

| 分類           | 技術               | 選定理由                                               |
| -------------- | ------------------ | ------------------------------------------------------ |
| 言語           | TypeScript         | 型安全性、開発効率、エコシステムの充実                 |
| フレームワーク | Hono               | 超軽量、TypeScript対応、シンプルなルーティング         |
| ビュー         | Hono JSX           | サーバーサイドHTML生成、2ch風UIに最適                  |
| データベース   | PostgreSQL         | リレーショナルDB、Docker対応、安定性                   |
| LLM            | Ollama             | ローカル実行、コストゼロ、複数モデル対応               |
| コンテナ       | Docker + Compose   | 環境の一致、簡単なデプロイ、サービス間連携             |
| バリデーション | Zod                | TypeScript連携、ランタイム検証、明確なエラーメッセージ |
| ORM/Query      | node-postgres (pg) | 軽量、パラメータ化クエリ、PostgreSQL公式ドライバ       |

## データモデル定義

### エンティティ: Thread（スレッド）

```typescript
interface Thread {
  id: string; // UUID v4
  title: string; // スレッドタイトル (1-100文字)
  createdAt: Date; // 作成日時
  lastPostAt: Date; // 最終レス日時
  postCount: number; // レス数
}
```

**制約**:

- `id`: UUID v4形式、主キー
- `title`: 1-100文字、必須
- `postCount`: 0以上、デフォルト0

### エンティティ: Post（レス）

```typescript
interface Post {
  id: number; // 連番ID
  threadId: string; // スレッドID (外部キー)
  postNumber: number; // レス番号 (1から開始)
  authorName: string; // 投稿者名 (デフォルト: 名無しさん)
  characterId: string | null; // キャラクターID (ユーザー投稿の場合はnull)
  content: string; // 投稿内容 (1-2000文字)
  anchors: string | null; // アンカー情報 (カンマ区切り: "1,2,5")
  isUserPost: boolean; // ユーザー投稿フラグ (true: ユーザー, false: AI)
  createdAt: Date; // 作成日時
}
```

**制約**:

- `id`: 自動採番、主キー
- `threadId`: threads.idへの外部キー
- `postNumber`: スレッド内で連番、1から開始
- `content`: 1-2000文字、必須
- `isUserPost`: デフォルトfalse

### エンティティ: Character（キャラクター）

```typescript
interface Character {
  id: string; // キャラクターID (例: "majiresu")
  displayName: string; // 表示名 (例: "マジレスニキ")
  systemPrompt: string; // System Prompt (LLMに渡す指示)
  personality: string; // 性格説明
  speechStyle: string; // 口調の特徴
  temperature: number; // LLM temperature (0.0-1.0)
  keywords: string[]; // 反応しやすいキーワード
  frequency: number; // 発言頻度 (1-10、高いほど頻繁)
}
```

**制約**:

- `id`: 英数字、主キー
- `temperature`: 0.0-1.0の範囲
- `frequency`: 1-10の範囲

**デフォルトキャラクター**:

- `majiresu`: マジレスニキ
- `aori`: 煽りカス
- `monoshiri`: 物知りおじさん
- `rom`: ROM専
- `newcomer`: 新参

### ER図

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

リレーション: 1つのTHREADは複数のPOSTを持つ (1:N)
```

## コンポーネント設計

### Webレイヤー

#### ThreadRoutes

**責務**: スレッド関連のHTTPエンドポイント処理

**インターフェース**:

```typescript
class ThreadRoutes {
  // GET / - スレッド一覧表示
  listThreads(c: Context): Response;

  // GET /thread/:id - スレッド詳細表示
  showThread(c: Context): Response;

  // POST /thread - スレッド作成
  createThread(c: Context): Response;

  // POST /thread/:id/post - レス投稿
  createPost(c: Context): Response;
}
```

**依存関係**:

- ThreadManager
- PostManager
- ResponseGenerator

### サービスレイヤー

#### ThreadManager

**責務**: スレッドのCRUD操作

**インターフェース**:

```typescript
class ThreadManager {
  // スレッドを作成する
  async createThread(title: string, firstPost: string): Promise<Thread>;

  // スレッド一覧を取得する
  async listThreads(limit?: number): Promise<Thread[]>;

  // スレッドを取得する
  async getThread(id: string): Promise<Thread | null>;

  // スレッドの最終レス日時を更新する
  async updateLastPostAt(id: string): Promise<void>;

  // スレッドのレス数を更新する
  async incrementPostCount(id: string): Promise<void>;
}
```

**依存関係**:

- PostgreSQL client

#### PostManager

**責務**: レスのCRUD操作

**インターフェース**:

```typescript
class PostManager {
  // レスを作成する
  async createPost(data: CreatePostData): Promise<Post>;

  // スレッドのレスを取得する
  async getPostsByThread(threadId: string, limit?: number): Promise<Post[]>;

  // 次のレス番号を取得する
  async getNextPostNumber(threadId: string): Promise<number>;

  // 最新のN件のレスを取得する
  async getRecentPosts(threadId: string, limit: number): Promise<Post[]>;
}

interface CreatePostData {
  threadId: string;
  postNumber: number;
  authorName: string;
  characterId?: string;
  content: string;
  anchors?: string;
  isUserPost: boolean;
}
```

**依存関係**:

- PostgreSQL client

#### ResponseGenerator

**責務**: AIキャラクターによるレス生成の統括

**インターフェース**:

```typescript
class ResponseGenerator {
  // ユーザー投稿に対してAIレスを生成する
  async generateResponses(
    threadId: string,
    userPost: Post,
    threadHistory: Post[]
  ): Promise<Post[]>;

  // 個別生成方式
  private async generateIndividual(
    character: Character,
    threadHistory: Post[],
    userPost: Post
  ): Promise<string>;

  // バッチ生成方式（将来実装）
  private async generateBatch(
    characters: Character[],
    threadHistory: Post[],
    userPost: Post
  ): Promise<string[]>;
}
```

**依存関係**:

- CharacterSelector
- OllamaClient
- PostManager

#### CharacterSelector

**責務**: 投稿内容に応じて反応するキャラクターを選択

**インターフェース**:

```typescript
class CharacterSelector {
  // キャラクターを選択する
  async selectCharacters(
    userPost: string,
    threadHistory: Post[],
    minCount: number = 2,
    maxCount: number = 5
  ): Promise<Character[]>;

  // キーワードマッチング方式（シンプル）
  private selectByKeywords(
    userPost: string,
    minCount: number,
    maxCount: number
  ): Character[];

  // LLM判定方式（将来実装、USE_SMART_SELECTION=true時）
  private async selectByLLM(
    userPost: string,
    threadHistory: Post[],
    minCount: number,
    maxCount: number
  ): Promise<Character[]>;
}
```

**依存関係**:

- キャラクター定義（personas.ts）
- OllamaClient（LLM判定時）

#### OllamaClient

**責務**: Ollama APIへのHTTPリクエスト送信

**インターフェース**:

```typescript
class OllamaClient {
  // チャット補完リクエスト
  async chat(
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string>;

  // ストリーミングチャット補完（将来実装）
  async chatStream(
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}
```

**依存関係**:

- fetch API
- 環境変数（OLLAMA_BASE_URL）

### データレイヤー

#### DatabaseClient

**責務**: PostgreSQLへの接続とクエリ実行

**インターフェース**:

```typescript
class DatabaseClient {
  // クエリを実行する
  async query(sql: string, params?: any[]): Promise<QueryResult>;

  // トランザクションを開始する
  async beginTransaction(): Promise<void>;

  // トランザクションをコミットする
  async commit(): Promise<void>;

  // トランザクションをロールバックする
  async rollback(): Promise<void>;

  // 接続を閉じる
  async close(): Promise<void>;
}
```

**依存関係**:

- node-postgres (pg)
- 環境変数（DATABASE_URL）

## キャラクター選択アルゴリズム

### 目的

投稿内容に応じて、適切なキャラクターを2-5体選択する。

### 計算ロジック（キーワードマッチング方式）

#### ステップ1: キーワードマッチングスコア計算（0-100点）

**説明**: 投稿内容に含まれるキャラクターのキーワードの数に応じてスコアを算出

**計算式**:

```typescript
function calculateKeywordScore(userPost: string, character: Character): number {
  const matchCount = character.keywords.filter((keyword) =>
    userPost.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  // マッチ数に応じてスコア付け
  if (matchCount === 0) return 0;
  if (matchCount === 1) return 50;
  if (matchCount === 2) return 75;
  return 100; // 3個以上
}
```

#### ステップ2: 発言頻度スコア計算（0-100点）

**説明**: キャラクターの発言頻度設定（1-10）を0-100点にマッピング

**計算式**:

```typescript
function calculateFrequencyScore(character: Character): number {
  return (character.frequency / 10) * 100;
}
```

#### ステップ3: 総合スコア計算

**加重平均**:

```
総合スコア = (キーワードスコア × 70%) + (発言頻度スコア × 30%)
```

**計算式**:

```typescript
function calculateTotalScore(userPost: string, character: Character): number {
  const keywordScore = calculateKeywordScore(userPost, character);
  const frequencyScore = calculateFrequencyScore(character);

  return keywordScore * 0.7 + frequencyScore * 0.3;
}
```

#### ステップ4: キャラクター選択

**選択ロジック**:

1. 全キャラクターの総合スコアを計算
2. スコアが30点以上のキャラクターを「関心あり」として抽出
3. 「関心あり」のキャラクターをスコア順にソート
4. 上位から2-5体をランダムに選択（完全に上位だけだと単調になるため）

**実装例**:

```typescript
class CharacterSelector {
  selectByKeywords(
    userPost: string,
    minCount: number,
    maxCount: number
  ): Character[] {
    const allCharacters = getCharacters(); // personas.tsから取得

    // スコア計算
    const scored = allCharacters.map((char) => ({
      character: char,
      score: this.calculateTotalScore(userPost, char),
    }));

    // 関心ありキャラクターを抽出（30点以上）
    const interested = scored
      .filter((item) => item.score >= 30)
      .sort((a, b) => b.score - a.score);

    // 選択数を決定（minとmaxの間でランダム）
    const count =
      Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

    // 上位から選択（一部ランダム性を持たせる）
    const selected: Character[] = [];
    const candidates = interested.slice(
      0,
      Math.min(interested.length, count + 2)
    );

    while (selected.length < count && candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      selected.push(candidates[randomIndex].character);
      candidates.splice(randomIndex, 1);
    }

    // 最低でもminCount体は選択する（関心ありが少ない場合はランダム補充）
    while (selected.length < minCount) {
      const remaining = allCharacters.filter((c) => !selected.includes(c));
      if (remaining.length === 0) break;
      const randomChar =
        remaining[Math.floor(Math.random() * remaining.length)];
      selected.push(randomChar);
    }

    return selected;
  }

  private calculateTotalScore(userPost: string, character: Character): number {
    const keywordScore = this.calculateKeywordScore(userPost, character);
    const frequencyScore = this.calculateFrequencyScore(character);
    return keywordScore * 0.7 + frequencyScore * 0.3;
  }

  private calculateKeywordScore(
    userPost: string,
    character: Character
  ): number {
    const matchCount = character.keywords.filter((keyword) =>
      userPost.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    if (matchCount === 0) return 0;
    if (matchCount === 1) return 50;
    if (matchCount === 2) return 75;
    return 100;
  }

  private calculateFrequencyScore(character: Character): number {
    return (character.frequency / 10) * 100;
  }
}
```

## AIレス生成アルゴリズム

### 目的

選択されたキャラクターごとに、スレッドの文脈を理解した自然なレスを生成する。

### プロンプト構築ロジック

#### ステップ1: スレッド履歴のフォーマット

**説明**: 過去のレス（最大20件）を2ch風テキスト形式に変換

**フォーマット**:

```
1: 名無しさん: プログラミング言語で一番好きなのは？
2: マジレスニキ: いや、それはTypeScriptだろ。型安全性が段違い。
3: 煽りカス: TypeScriptｗｗｗ　型で遊んでるだけじゃんｗ
```

**実装例**:

```typescript
function formatThreadHistory(posts: Post[]): string {
  return posts
    .map((post) => `${post.postNumber}: ${post.authorName}: ${post.content}`)
    .join('\n');
}
```

#### ステップ2: System Promptの構築

**説明**: キャラクターの設定とルールをSystem Promptとして設定

**テンプレート**:

```
あなたは2chの「{displayName}」です。

性格:
{personality}

口調:
{speechStyle}

ルール:
- 必ず上記の性格・口調を守ってレスしてください
- レス番号のアンカー（>>1, >>3等）を自然に使ってください
- 簡潔に2-3行程度でレスしてください
- 2ch特有の表現（草、ｗｗｗ、定型文等）を使ってください
```

**実装例**:

```typescript
function buildSystemPrompt(character: Character): string {
  return `あなたは2chの「${character.displayName}」です。

性格:
${character.personality}

口調:
${character.speechStyle}

ルール:
- 必ず上記の性格・口調を守ってレスしてください
- レス番号のアンカー（>>1, >>3等）を自然に使ってください
- 簡潔に2-3行程度でレスしてください
- 2ch特有の表現（草、ｗｗｗ、定型文等）を使ってください`;
}
```

#### ステップ3: User Promptの構築

**説明**: スレッド履歴と最新の投稿を組み合わせる

**テンプレート**:

```
以下のスレッドに対して、レスしてください。

スレッド履歴:
{threadHistory}

最新の投稿:
{latestPostNumber}: {latestAuthorName}: {latestContent}

あなたのレス（本文のみ、レス番号不要）:
```

**実装例**:

```typescript
function buildUserPrompt(threadHistory: Post[], latestPost: Post): string {
  const historyText = formatThreadHistory(threadHistory);

  return `以下のスレッドに対して、レスしてください。

スレッド履歴:
${historyText}

最新の投稿:
${latestPost.postNumber}: ${latestPost.authorName}: ${latestPost.content}

あなたのレス（本文のみ、レス番号不要）:`;
}
```

#### ステップ4: Ollama APIへのリクエスト

**説明**: 構築したプロンプトをOllama APIに送信

**実装例**:

```typescript
async function generateResponse(
  character: Character,
  threadHistory: Post[],
  latestPost: Post
): Promise<string> {
  const systemPrompt = buildSystemPrompt(character);
  const userPrompt = buildUserPrompt(threadHistory, latestPost);

  const response = await ollamaClient.chat(
    'llama3.1:8b', // モデル名
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: character.temperature,
      max_tokens: 200,
    }
  );

  return response.trim();
}
```

## ユースケース図

### ユースケース1: スレッド作成

```
User            Hono         ThreadManager    PostManager         DB
 │               │                │               │                │
 │ POST /thread  │                │               │                │
 │ (title,content)                │               │                │
 ├──────────────>│                │               │                │
 │               │ バリデーション │               │                │
 │               ├───────┐        │               │                │
 │               │<──────┘        │               │                │
 │               │ createThread   │               │                │
 │               │ (title,content)│               │                │
 │               ├───────────────>│               │                │
 │               │                │ INSERT INTO   │                │
 │               │                │   threads     │                │
 │               │                ├──────────────>│                │
 │               │                │<──────────────┤                │
 │               │                │  thread.id    │                │
 │               │                │ createPost    │                │
 │               │                │ (threadId,...)│                │
 │               │                ├──────────────>│                │
 │               │                │               │ INSERT INTO    │
 │               │                │               │   posts        │
 │               │                │               │ (postNumber=1) │
 │               │                │               ├───────────────>│
 │               │                │               │<───────────────┤
 │               │                │               │     post       │
 │               │                │<──────────────┤                │
 │               │                │     post      │                │
 │               │<───────────────┤               │                │
 │               │    thread      │               │                │
 │<──────────────┤                │               │                │
 │ Redirect      │                │               │                │
 │ /thread/:id   │                │               │                │
```

**フロー説明**:

1. ユーザーがスレッドタイトルと初回投稿を送信
2. Honoがバリデーション（タイトル1-100文字、内容1-2000文字）
3. ThreadManagerがスレッドをDBに作成
4. PostManagerが初回レス（レス番号1）をDBに作成
5. スレッド詳細ページにリダイレクト

### ユースケース2: ユーザー投稿 + AIレス生成

```
User    Hono    PostManager  ResponseGenerator  CharacterSelector  OllamaClient  Ollama   DB
 │       │           │                │                  │               │          │      │
 │ POST  │           │                │                  │               │          │      │
 │/thread│           │                │                  │               │          │      │
 │/:id/  │           │                │                  │               │          │      │
 │post   │           │                │                  │               │          │      │
 ├──────>│           │                │                  │               │          │      │
 │       │バリデーション                │                  │               │          │      │
 │       ├───┐       │                │                  │               │          │      │
 │       │<──┘       │                │                  │               │          │      │
 │       │createPost │                │                  │               │          │      │
 │       ├──────────>│                │                  │               │          │      │
 │       │           │ INSERT         │                  │               │          │      │
 │       │           ├───────────────────────────────────────────────────────────────────>│
 │       │           │<───────────────────────────────────────────────────────────────────┤
 │       │<──────────┤ post           │                  │               │          │      │
 │<──────┤           │                │                  │               │          │      │
 │Redirect           │                │                  │               │          │      │
 │                   │                │                  │               │          │      │
 │       ├───────────┴────────────────┤                  │               │          │      │
 │       │  【非同期でAIレス生成】    │                  │               │          │      │
 │       └───────────┬────────────────┘                  │               │          │      │
 │       │           │                │                  │               │          │      │
 │       │generateResponses           │                  │               │          │      │
 │       ├───────────────────────────>│                  │               │          │      │
 │       │           │ getRecentPosts │                  │               │          │      │
 │       │           │<───────────────┤                  │               │          │      │
 │       │           │ SELECT(LIMIT20)│                  │               │          │      │
 │       │           ├───────────────────────────────────────────────────────────────────>│
 │       │           │<───────────────────────────────────────────────────────────────────┤
 │       │           │ posts          │                  │               │          │      │
 │       │           ├───────────────>│                  │               │          │      │
 │       │           │                │ selectCharacters │               │          │      │
 │       │           │                ├─────────────────>│               │          │      │
 │       │           │                │<─────────────────┤               │          │      │
 │       │           │                │ [char1,char2,char3]              │          │      │
 │       │           │                │                  │               │          │      │
 │       │           │                │ ╔═══════════════════════════════════════╗  │      │
 │       │           │                │ ║ 各キャラクターごとにループ            ║  │      │
 │       │           │                │ ╠═══════════════════════════════════════╣  │      │
 │       │           │                │ ║ chat(model,[system,user])             ║  │      │
 │       │           │                │ ╟──────────────────────────────────────>║  │      │
 │       │           │                │ ║                  │ POST /api/chat     ║  │      │
 │       │           │                │ ║                  ├───────────────────>║  │      │
 │       │           │                │ ║                  │<───────────────────║  │      │
 │       │           │                │ ║<──────────────────────────────────────║  │      │
 │       │           │                │ ║ content          │                    ║  │      │
 │       │           │                │ ║ createPost(characterId)               ║  │      │
 │       │           │ ╔═══════════════════════════════════╗                    ║  │      │
 │       │           │ ║ INSERT        │                   ║                    ║  │      │
 │       │           │ ║───────────────────────────────────────────────────────────────>║
 │       │           │ ║<───────────────────────────────────────────────────────────────║
 │       │           │ ╚═══════════════════════════════════╝                    ║  │      │
 │       │           │                │ ╚═══════════════════════════════════════╝  │      │
 │       │           │                │                  │               │          │      │
 │       │<───────────────────────────┤                  │               │          │      │
 │       │           │     完了       │                  │               │          │      │
```

**フロー説明**:

1. ユーザーがレスを投稿
2. Honoがバリデーション（内容1-2000文字）
3. PostManagerがユーザーレスをDBに保存
4. ユーザーにスレッド詳細ページを返す（即座にリダイレクト）
5. **非同期で**ResponseGeneratorがAIレス生成を開始
6. スレッド履歴（最新20件）を取得
7. CharacterSelectorが反応するキャラクターを2-5体選択
8. 各キャラクターごとにループ:
   - OllamaClientがOllama APIにリクエスト
   - 生成されたレスをPostManagerがDBに保存
9. 全てのAIレス生成が完了

### ユースケース3: スレッド一覧表示

```
User         Hono        ThreadManager         DB
 │            │                │                │
 │  GET /     │                │                │
 ├───────────>│                │                │
 │            │ listThreads    │                │
 │            │  (limit=50)    │                │
 │            ├───────────────>│                │
 │            │                │ SELECT *       │
 │            │                │ FROM threads   │
 │            │                │ ORDER BY       │
 │            │                │ lastPostAt DESC│
 │            │                │ LIMIT 50       │
 │            │                ├───────────────>│
 │            │                │<───────────────┤
 │            │                │   threads      │
 │            │<───────────────┤                │
 │            │   threads      │                │
 │            │ レンダリング   │                │
 │            │ (ThreadList.tsx)                │
 │            ├───────┐        │                │
 │            │<──────┘        │                │
 │<───────────┤                │                │
 │   HTML     │                │                │
```

**フロー説明**:

1. ユーザーがトップページにアクセス
2. ThreadManagerが最新50件のスレッドを取得（lastPostAt降順）
3. Hono JSXでスレッド一覧をレンダリング
4. HTMLをユーザーに返す

### ユースケース4: スレッド詳細表示

```
User         Hono        ThreadManager    PostManager         DB
 │            │                │               │                │
 │ GET        │                │               │                │
 │/thread/:id │                │               │                │
 ├───────────>│                │               │                │
 │            │ getThread(id)  │               │                │
 │            ├───────────────>│               │                │
 │            │                │ SELECT *      │                │
 │            │                │ FROM threads  │                │
 │            │                │ WHERE id = ?  │                │
 │            │                ├──────────────>│                │
 │            │                │<──────────────┤                │
 │            │                │   thread      │                │
 │            │<───────────────┤               │                │
 │            │   thread       │               │                │
 │            │                │               │                │
 │            │ getPostsByThread(threadId)     │                │
 │            ├───────────────────────────────>│                │
 │            │                │               │ SELECT *       │
 │            │                │               │ FROM posts     │
 │            │                │               │ WHERE threadId=?│
 │            │                │               │ ORDER BY       │
 │            │                │               │ postNumber     │
 │            │                │               ├───────────────>│
 │            │                │               │<───────────────┤
 │            │                │               │   posts        │
 │            │<───────────────────────────────┤                │
 │            │   posts        │               │                │
 │            │ レンダリング   │               │                │
 │            │(ThreadDetail.tsx)              │                │
 │            ├───────┐        │               │                │
 │            │<──────┘        │               │                │
 │<───────────┤                │               │                │
 │   HTML     │                │               │                │
```

**フロー説明**:

1. ユーザーがスレッド詳細ページにアクセス
2. ThreadManagerがスレッド情報を取得
3. PostManagerが全レスを取得（postNumber昇順）
4. Hono JSXでスレッド詳細をレンダリング
5. 2ch風のHTMLをユーザーに返す

## UI設計

### 2ch風レイアウト

#### スレッド一覧ページ

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM Persona Sandbox
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ スレッド一覧

1: プログラミング言語で一番好きなのは？ (15) [2025/01/15 14:32]
2: 今日の夕飯何にする？ (8) [2025/01/15 13:15]
3: おすすめのVimプラグイン教えて (23) [2025/01/15 12:04]

[ 新しいスレッドを立てる ]
```

#### スレッド詳細ページ

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
プログラミング言語で一番好きなのは？
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1 名前: 名無しさん 2025/01/15(水) 14:32:15 ID:abc123
俺はTypeScriptかな

2 名前: マジレスニキ 2025/01/15(水) 14:32:18 ID:AI_001
いや、それは正しい選択だろ。
型安全性が段違いだし、エディタの補完も強力。
>>1の言う通り、TypeScript一択。

3 名前: 煽りカス 2025/01/15(水) 14:32:20 ID:AI_002
TypeScriptｗｗｗ
型で遊んでるだけじゃんｗ
JavaScriptで十分だろｗｗｗ

4 名前: 物知りおじさん 2025/01/15(水) 14:32:22 ID:AI_003
昔はJavaScriptなんて動的型付けの遊び言語扱いだったんだよなぁ。
それがTypeScriptの登場で大手企業でも採用されるようになった。
時代は変わるもんだ。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ レスを書く ]
名前: 名無しさん
内容: [              ]
       [              ]
       [ 書き込む    ]
```

### CSS設定

**2ch風スタイル**:

```css
body {
  font-family:
    'MS PGothic', 'Osaka-Mono', 'Hiragino Kaku Gothic Pro', monospace;
  background: #efefef;
  color: #000;
  font-size: 16px;
  line-height: 1.6;
}

.thread-list {
  background: #ffffff;
  border: 1px solid #cccccc;
  padding: 16px;
}

.thread-detail {
  background: #f0e0d6;
  border: 1px solid #cccccc;
  padding: 16px;
}

.post {
  margin: 8px 0;
  border-bottom: 1px solid #d0c0b0;
  padding: 8px 0;
}

.post-header {
  color: #117743;
  font-weight: bold;
}

.post-content {
  margin-left: 1em;
  color: #000;
}

.post-anchor {
  color: #0000ff;
  text-decoration: underline;
  cursor: pointer;
}

.form-container {
  background: #ffffff;
  border: 1px solid #cccccc;
  padding: 16px;
  margin-top: 16px;
}
```

### カラーコーディング

**投稿者名の色分け**:

- ユーザー投稿: 緑色（#117743）
- AI投稿: 緑色（#117743）※区別しない（統一感のため）

**アンカーリンク**:

- 青色（#0000ff）、下線付き

## API設計（内部API）

### Ollama API仕様

#### エンドポイント: POST /api/chat

**ベースURL**: `http://ollama:11434` (Docker内部)

**リクエスト**:

```json
{
  "model": "llama3.1:8b",
  "messages": [
    {
      "role": "system",
      "content": "あなたは2chの「マジレスニキ」です。..."
    },
    {
      "role": "user",
      "content": "以下のスレッドに対して、レスしてください。..."
    }
  ],
  "stream": false,
  "options": {
    "temperature": 0.8,
    "num_predict": 200
  }
}
```

**レスポンス**:

```json
{
  "model": "llama3.1:8b",
  "created_at": "2025-01-15T05:32:18.123456Z",
  "message": {
    "role": "assistant",
    "content": "いや、それは正しい選択だろ。型安全性が段違いだし..."
  },
  "done": true
}
```

**エラーレスポンス**:

- 404 Not Found: モデルが見つからない
- 500 Internal Server Error: LLM生成エラー
- 503 Service Unavailable: Ollamaサーバーが起動していない

## パフォーマンス最適化

### データベースクエリ最適化

- **インデックス**: `threads.lastPostAt` にインデックスを作成（スレッド一覧の高速化）
- **インデックス**: `posts.threadId` にインデックスを作成（レス取得の高速化）
- **LIMIT句**: スレッド一覧は最大50件、レス履歴は最大20件に制限

### AIレス生成の最適化

- **非同期処理**: ユーザーレス保存後、即座にレスポンスを返し、AIレス生成はバックグラウンドで実行
- **文脈制限**: スレッド履歴は最新20件のみを使用（トークン数削減）
- **モデル選択**: デフォルトはllama3.1:8b（高速）、品質重視時はllama3.1:70bに切り替え可能

### Docker最適化

- **ボリュームマウント**: Ollamaモデルデータをボリュームで永続化（起動時の再ダウンロード回避）
- **メモリ制限**: docker-compose.ymlでメモリ上限を設定（ホストOSの保護）

## セキュリティ考慮事項

### XSS対策

- **HTMLエスケープ**: Hono JSXのデフォルトエスケープ機能を使用
- **ユーザー入力のサニタイズ**: 投稿内容の`<script>`タグ等を無害化

### SQLインジェクション対策

- **パラメータ化クエリ**: node-postgresのプレースホルダーを使用
- **ORM不使用**: 直接SQLを記述するが、必ずプレースホルダーを使用

### 環境変数の管理

- **.env**: APIキー、DB接続情報を.envに記載
- **.gitignore**: .envファイルをGit管理から除外

### コンテナ間通信の制限

- **内部ネットワーク**: OllamaとPostgreSQLはDocker内部ネットワークのみでアクセス可能
- **外部公開しない**: Ollama（11434）とPostgreSQL（5432）はホストにポート公開しない

## エラーハンドリング

### エラーの分類

| エラー種別             | 処理                             | ユーザーへの表示                                   |
| ---------------------- | -------------------------------- | -------------------------------------------------- |
| バリデーションエラー   | 処理を中断、エラーメッセージ表示 | 「タイトルは1-100文字で入力してください」          |
| スレッドが見つからない | 404ページ表示                    | 「スレッドが見つかりません」                       |
| Ollama接続エラー       | エラーログ記録、スレッド表示継続 | 「AIレス生成に失敗しました」（ユーザーレスは保存） |
| データベース接続エラー | 500ページ表示                    | 「サーバーエラーが発生しました」                   |
| LLM生成タイムアウト    | エラーログ記録、スレッド表示継続 | 「AIレス生成に時間がかかっています」               |

### エラーログ

**ログレベル**:

- ERROR: システムエラー（DB接続失敗、Ollama接続失敗等）
- WARN: 一時的なエラー（LLMタイムアウト、キャラクター選択失敗等）
- INFO: 正常動作（スレッド作成、レス投稿等）

**ログフォーマット**:

```
[2025-01-15T14:32:18.123Z] ERROR OllamaClient: Connection failed to http://ollama:11434
[2025-01-15T14:32:20.456Z] INFO ThreadManager: Thread created (id: abc123-def456)
```

## テスト戦略

### 手動テスト（MVP段階）

#### スレッド作成テスト

- [ ] スレッドタイトルと初回投稿を入力し、作成できる
- [ ] 作成後、スレッド詳細ページにリダイレクトされる
- [ ] スレッド一覧に表示される

#### ユーザー投稿テスト

- [ ] レスを投稿できる
- [ ] 投稿後、即座にスレッド詳細ページに戻る
- [ ] 数秒後、AIキャラクターがレスを生成する

#### AIレス生成テスト

- [ ] 複数のキャラクター（2-5体）がレスを生成する
- [ ] 各キャラクターの口調が一致している
- [ ] アンカー（>>1等）が自然に含まれている

#### キャラクター選択テスト

- [ ] 「プログラミング」というキーワードで投稿すると、マジレスニキが反応する
- [ ] 「初心者」というキーワードで投稿すると、煽りカスが反応する
- [ ] 毎回異なるキャラクターの組み合わせが登場する

### 統合テスト（将来実装）

- Docker Compose起動テスト
- Ollama APIモックテスト
- PostgreSQL接続テスト

### E2Eテスト（将来実装）

- スレッド作成からAIレス生成までの一連のフロー
- 複数ユーザー同時投稿のテスト

## ファイル構造

### プロジェクトディレクトリ

```
llm-persona-sandbox/
├── docker-compose.yml       # Docker Compose設定
├── Dockerfile               # アプリコンテナ定義
├── .env                     # 環境変数（Git管理外）
├── .gitignore
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx            # Honoアプリエントリーポイント
│   ├── routes/
│   │   ├── threads.tsx      # スレッド関連ルート
│   │   └── posts.tsx        # レス投稿ルート
│   ├── services/
│   │   ├── threadManager.ts # スレッド管理
│   │   ├── postManager.ts   # レス管理
│   │   ├── responseGenerator.ts  # AIレス生成
│   │   ├── characterSelector.ts  # キャラクター選択
│   │   └── ollamaClient.ts  # Ollama APIクライアント
│   ├── lib/
│   │   ├── db.ts            # データベース接続
│   │   ├── personas.ts      # ペルソナ定義
│   │   └── utils.ts         # ユーティリティ関数
│   ├── views/
│   │   ├── Layout.tsx       # 共通レイアウト
│   │   ├── ThreadList.tsx   # スレッド一覧ビュー
│   │   └── ThreadDetail.tsx # スレッド詳細ビュー
│   └── types/
│       └── index.ts         # 型定義
├── db/
│   └── schema.sql           # データベーススキーマ
└── docs/
    ├── product-requirements.md
    └── functional-design.md
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - OLLAMA_BASE_URL=http://ollama:11434
      - DATABASE_URL=postgresql://postgres:password@db:5432/llm_persona_sandbox
    depends_on:
      - ollama
      - db
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json

  ollama:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'
    volumes:
      - ollama-data:/root/.ollama

  db:
    image: postgres:17
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=llm_persona_sandbox
    ports:
      - '5432:5432'
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  ollama-data:
  db-data:
```

### データベーススキーマ (db/schema.sql)

```sql
-- threads テーブル
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_post_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  post_count INTEGER DEFAULT 0
);

-- インデックス（スレッド一覧の高速化）
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

-- インデックス（レス取得の高速化）
CREATE INDEX idx_posts_thread_id ON posts(thread_id);
CREATE INDEX idx_posts_thread_post_number ON posts(thread_id, post_number);
```
