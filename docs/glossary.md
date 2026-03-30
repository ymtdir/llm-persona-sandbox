# プロジェクト用語集 (Glossary)

## 概要

このドキュメントは、LLM Persona Sandboxプロジェクト内で使用される用語の定義を管理します。

**更新日**: 2026-03-30

## ドメイン用語

プロジェクト固有のビジネス概念や機能に関する用語。

### スレッド (Thread)

**定義**: 2ch風掲示板における話題のまとまり。タイトルと複数のレス（投稿）を持つ。

**説明**:
スレッドは、特定の話題について議論するための場所です。ユーザーが作成し、複数のユーザー（およびAI）がレスを投稿できます。スレッドには一意のUUID、タイトル、作成日時、最終レス日時、レス数が含まれます。

**関連用語**:

- [レス](#レス-post): スレッド内の個別の投稿
- [スレッド一覧](#スレッド一覧): 全スレッドのリスト

**使用例**:

- 「新しいスレッドを立てる」: 新規スレッドを作成する
- 「スレッドが盛り上がる」: 多くのレスが投稿される

**データモデル**: `src/types/index.ts` - `Thread` インターフェース

**英語表記**: Thread

### レス (Post)

**定義**: スレッド内の個別の投稿。レス番号、投稿者名、内容、タイムスタンプを持つ。

**説明**:
レスは、スレッドに対する個別の発言です。ユーザーが投稿するレスとAIキャラクターが生成するレスがあります。レスには連番のレス番号（1から開始）が付与され、他のレスへのアンカー（>>1等）を含むことができます。

**関連用語**:

- [スレッド](#スレッド-thread): レスが属する親エンティティ
- [アンカー](#アンカー-anchor): 他のレスへの参照
- [キャラクター](#キャラクター-character): AIレスを生成する主体

**使用例**:

- 「レスを投稿する」: スレッドに新しい投稿を追加する
- 「レス番号5」: 5番目のレス

**データモデル**: `src/types/index.ts` - `Post` インターフェース

**英語表記**: Post (Reply)

### アンカー (Anchor)

**定義**: レス内で他のレスを参照するための記法。`>>1` のように表記される。

**説明**:
2ch特有の機能で、過去のレスを引用・参照する際に使用します。`>>1`は「レス番号1を参照」の意味です。AIキャラクターも自然な会話のためにアンカーを使用します。

**関連用語**:

- [レス](#レス-post): アンカーが含まれるエンティティ

**使用例**:

- 「>>1の言う通り」: レス番号1の意見に同意する
- 「>>3 それは違う」: レス番号3に反論する

**実装**: `Post` インターフェースの `anchors` フィールド（カンマ区切り: "1,2,5"）

**英語表記**: Anchor

### キャラクター (Character)

**定義**: AIが演じる2ch住民のペルソナ。口調、性格、反応しやすいキーワードを持つ。

**説明**:
キャラクターは、AIレス生成の個性を定義します。マジレスニキ、煽りカス、物知りおじさん、ROM専、新参の5種類がデフォルトで用意されています。各キャラクターは、システムプロンプト、温度（temperature）、発言頻度、キーワードリストを持ちます。

**関連用語**:

- [ペルソナ](#ペルソナ-persona): キャラクターの別名
- [キャラクター選択](#キャラクター選択): 投稿内容に応じたキャラクター選択ロジック
- [システムプロンプト](#システムプロンプト-system-prompt): キャラクターの振る舞いを定義する指示

**使用例**:

- 「マジレスニキが反応する」: 真面目なレスを生成する
- 「煽りカスが登場する」: 挑発的なレスを生成する

**データモデル**: `src/types/index.ts` - `Character` インターフェース

**定義ファイル**: `src/lib/personas.ts`

**英語表記**: Character

### ペルソナ (Persona)

**定義**: キャラクターと同義。AIが演じる人格・性格。

**説明**:
複数のAIキャラクターを「ペルソナ」と呼ぶこともあります。本プロジェクトでは「キャラクター」と「ペルソナ」を同義として使用しますが、コード上では主に「Character」を使用します。

**関連用語**:

- [キャラクター](#キャラクター-character): 同義語

**使用例**:

- 「ペルソナを定義する」: 新しいキャラクターを作成する
- 「ペルソナファイル」: `personas.ts` のこと

**定義ファイル**: `src/lib/personas.ts`

**英語表記**: Persona

### キャラクター選択

**定義**: ユーザー投稿内容に応じて、反応するAIキャラクターを2-5体選択するロジック。

**説明**:
投稿内容のキーワードとキャラクターの関心キーワードをマッチングし、スコアを計算します。キーワードスコア（70%）と発言頻度スコア（30%）の加重平均で総合スコアを算出し、30点以上のキャラクターを「関心あり」として上位から選択します。

**関連用語**:

- [キーワードマッチングスコア](#キーワードマッチングスコア): キャラクター選択の計算要素
- [発言頻度スコア](#発言頻度スコア): キャラクター選択の計算要素

**アルゴリズム**: [機能設計書 - キャラクター選択アルゴリズム](./functional-design.md#キャラクター選択アルゴリズム)

**実装箇所**: `src/services/characterSelector.ts`

**英語表記**: Character Selection

### システムプロンプト (System Prompt)

**定義**: LLMに対してキャラクターの性格・口調・ルールを指示するテキスト。

**説明**:
System Promptは、LLMの振る舞いを制御する最も重要な要素です。「あなたは2chの『マジレスニキ』です。性格: 真面目で論理的...」のように、キャラクターの設定とルールを明示します。

**関連用語**:

- [キャラクター](#キャラクター-character): System Promptを持つエンティティ
- [Ollama API](#ollama): System Promptを送信する先

**使用例**:

```typescript
const systemPrompt = `あなたは2chの「マジレスニキ」です。
性格: 真面目で論理的、煽りに対しても冷静に反論する
口調: 「〜だろ」「いや、それは違う」など断定的な口調
ルール:
- 必ず上記の性格・口調を守ってレスしてください
- レス番号のアンカー（>>1, >>3等）を自然に使ってください
- 簡潔に2-3行程度でレスしてください`;
```

**英語表記**: System Prompt

### AIレス生成

**定義**: ユーザー投稿に対して、AIキャラクターが自動的にレスを生成する処理。

**説明**:
ユーザーがレスを投稿すると、非同期でAIレス生成が開始されます。キャラクター選択 → 各キャラクターごとにOllama APIへリクエスト → 生成されたレスをデータベースに保存、という流れで処理されます。

**関連用語**:

- [Ollama API](#ollama): LLMへのリクエスト送信先
- [キャラクター選択](#キャラクター選択): 反応するキャラクターの決定
- [非同期処理](#非同期処理): ユーザー体験を損なわないための設計

**実装箇所**: `src/services/responseGenerator.ts`

**英語表記**: AI Response Generation

## 技術用語

プロジェクトで使用している技術・フレームワーク・ツールに関する用語。

### Hono

**定義**: 超軽量（13KB）なTypeScript対応のWebフレームワーク。

**公式サイト**: https://hono.dev/

**本プロジェクトでの用途**:
HTTPエンドポイントの定義、ルーティング、JSXによるサーバーサイドレンダリングに使用しています。

**バージョン**: ^4.x

**選定理由**:

- 軽量・高速（Express.jsより10倍以上高速）
- TypeScriptファーストの設計
- JSXビルトインサポート
- 複数ランタイム対応（Node.js、Deno、Bun等）

**関連ドキュメント**:

- [アーキテクチャ設計書](./architecture.md#フレームワーク・ライブラリ)

**実装箇所**: `src/routes/`, `src/index.tsx`

### Hono JSX

**定義**: HonoフレームワークのJSXサポート機能。サーバーサイドでHTMLを生成する。

**本プロジェクトでの用途**:
2ch風UIのHTMLレンダリングに使用。ReactのようなJSX記法でHTMLを生成できます。

**使用例**:

```tsx
import { FC } from 'hono/jsx';

export const ThreadList: FC<{ threads: Thread[] }> = ({ threads }) => {
  return (
    <div class="thread-list">
      {threads.map((thread) => (
        <div key={thread.id}>{thread.title}</div>
      ))}
    </div>
  );
};
```

**実装箇所**: `src/views/`

### Ollama

**定義**: ローカルでLLMを実行できるオープンソースツール。

**公式サイト**: https://ollama.com/

**本プロジェクトでの用途**:
AIキャラクターのレス生成エンジンとして使用。llama3.1:8b（高速）またはllama3.1:70b（高品質）モデルを使用します。

**バージョン**: latest

**選定理由**:

- ローカル実行可能（ネットワークレイテンシゼロ）
- コストゼロ（クラウドLLM APIと比較）
- 複数モデルの切り替えが容易
- OpenAI互換API

**関連ドキュメント**:

- [アーキテクチャ設計書](./architecture.md#インフラストラクチャ)
- [機能設計書](./functional-design.md#ollama-api連携)

**Docker構成**: `docker-compose.yml` - `ollama` サービス

### PostgreSQL

**定義**: オープンソースのリレーショナルデータベース管理システム（RDBMS）。

**公式サイト**: https://www.postgresql.org/

**本プロジェクトでの用途**:
スレッドとレスの永続化に使用。UUID型、インデックス、外部キー制約等の高度な機能を活用しています。

**バージョン**: 17.x

**選定理由**:

- ACID準拠による信頼性
- UUID型のネイティブサポート
- 降順インデックス（`CREATE INDEX ... DESC`）
- ON DELETE CASCADEによる参照整合性の自動管理

**関連ドキュメント**:

- [アーキテクチャ設計書](./architecture.md#インフラストラクチャ)
- [機能設計書](./functional-design.md#データモデル定義)

**スキーマ定義**: `db/schema.sql`

**Docker構成**: `docker-compose.yml` - `db` サービス

### TypeScript

**定義**: JavaScriptに静的型付けを追加したプログラミング言語。

**公式サイト**: https://www.typescriptlang.org/

**本プロジェクトでの用途**:
全てのソースコードをTypeScriptで記述し、型安全性を確保しています。

**バージョン**: 5.x

**選定理由**:

- コンパイル時のエラー検出
- IDEの補完機能による開発効率向上
- Honoとの型統合

**関連ドキュメント**:

- [開発ガイドライン](./development-guidelines.md#コーディング規約)

**設定ファイル**: `tsconfig.json`

### Docker Compose

**定義**: 複数のDockerコンテナを統一的に管理するツール。

**公式サイト**: https://docs.docker.com/compose/

**本プロジェクトでの用途**:
app（Node.js + Hono）、ollama（LLMサーバー）、db（PostgreSQL）の3サービスを統一管理しています。

**バージョン**: 2.x

**選定理由**:

- 開発環境と本番環境の完全一致
- `docker-compose up -d` 一発でサービス全体が起動
- ボリュームによるデータ永続化
- 内部ネットワークによるセキュリティ向上

**関連ドキュメント**:

- [アーキテクチャ設計書](./architecture.md#インフラストラクチャ)

**設定ファイル**: `docker-compose.yml`

### Zod

**定義**: TypeScript向けのバリデーションライブラリ。型定義とランタイム検証を一元管理。

**公式サイト**: https://zod.dev/

**本プロジェクトでの用途**:
ユーザー入力（スレッド作成、レス投稿）のバリデーションに使用しています。

**バージョン**: ^3.x

**選定理由**:

- TypeScript型定義の自動生成
- ランタイムバリデーション
- 明確なエラーメッセージ

**使用例**:

```typescript
const threadSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
});

const validated = threadSchema.parse(body); // バリデーション実行
```

**関連ドキュメント**:

- [アーキテクチャ設計書](./architecture.md#フレームワーク・ライブラリ)

### node-postgres (pg)

**定義**: PostgreSQL公式のNode.jsクライアントライブラリ。

**公式サイト**: https://node-postgres.com/

**本プロジェクトでの用途**:
PostgreSQLへのクエリ実行、トランザクション管理に使用しています。

**バージョン**: ^8.x

**選定理由**:

- パラメータ化クエリによるSQLインジェクション対策
- トランザクション管理が明示的で理解しやすい
- ORMを使わないことでクエリの透明性を確保

**使用例**:

```typescript
await db.query('SELECT * FROM threads WHERE id = $1', [threadId]);
```

**実装箇所**: `src/lib/db.ts`

## 略語・頭字語

### LLM

**正式名称**: Large Language Model

**意味**: 大規模言語モデル。膨大なテキストデータで学習されたAIモデル。

**本プロジェクトでの使用**:
Ollamaを通じて、llama3.1:8b または llama3.1:70b モデルを使用しています。

### API

**正式名称**: Application Programming Interface

**意味**: ソフトウェア間のインターフェース。

**本プロジェクトでの使用**:
Ollama APIを通じてLLMにリクエストを送信し、レスポンスを受信します。

**関連**: `src/services/ollamaClient.ts`

### UUID

**正式名称**: Universally Unique Identifier

**意味**: 世界中で一意に識別可能なID。128ビットの値。

**本プロジェクトでの使用**:
スレッドIDとして使用。PostgreSQLの`gen_random_uuid()`で生成されます。

**例**: `550e8400-e29b-41d4-a716-446655440000`

### JSX

**正式名称**: JavaScript XML

**意味**: JavaScriptコード内にXML（HTML）を埋め込む記法。

**本プロジェクトでの使用**:
Hono JSXを使用してサーバーサイドでHTMLを生成します。

**実装箇所**: `src/views/`

### SSE

**正式名称**: Server-Sent Events

**意味**: サーバーからクライアントへの一方向リアルタイム通信。

**本プロジェクトでの使用**:
将来実装予定。AIレス生成の進捗をリアルタイムで表示するために使用する予定です。

**関連**: [機能設計書 - リアルタイムレス表示](./functional-design.md#リアルタイムレス表示sse)

### CRUD

**正式名称**: Create, Read, Update, Delete

**意味**: データベース操作の4つの基本操作。

**本プロジェクトでの使用**:
ThreadManager、PostManagerがスレッド・レスのCRUD操作を提供します。

**実装箇所**: `src/services/threadManager.ts`, `src/services/postManager.ts`

## アーキテクチャ用語

システム設計・アーキテクチャに関する用語。

### レイヤードアーキテクチャ (Layered Architecture)

**定義**: システムを役割ごとに複数の層に分割し、上位層から下位層への一方向の依存関係を持たせる設計パターン。

**本プロジェクトでの適用**:
3層アーキテクチャを採用しています:

```
routes/ (Webレイヤー)
    ↓
services/ (サービスレイヤー)
    ↓
lib/ (データレイヤー)
```

**各層の責務**:

- **Webレイヤー**: HTTPリクエストの受付、バリデーション、レスポンス生成
- **サービスレイヤー**: ビジネスロジック、データ変換、トランザクション制御
- **データレイヤー**: データ永続化、外部API呼び出し

**依存関係のルール**:

- ✅ routes → services, views, types
- ✅ services → lib, types
- ✅ lib → types
- ❌ lib → services（禁止）
- ❌ services → routes（禁止）

**関連ドキュメント**:

- [アーキテクチャ設計書](./architecture.md#アーキテクチャパターン)
- [リポジトリ構造定義書](./repository-structure.md#依存関係のルール)

### 非同期処理

**定義**: 処理を待たずに次の処理を実行する設計パターン。

**本プロジェクトでの適用**:
ユーザーレス保存後、即座にHTTPレスポンスを返し、AIレス生成はバックグラウンドで実行します。これにより、ユーザーは10秒待たされることなく、スレッドページに戻れます。

**実装例**:

```typescript
// ユーザーレス保存（同期）
const userPost = await postManager.createPost({...});

// AIレス生成（非同期、awaitしない）
responseGenerator.generateResponses(threadId, userPost, history);

// 即座にレスポンス
return c.redirect(`/thread/${threadId}`);
```

**メリット**:

- ユーザー体験の向上（待ち時間の削減）
- スループットの向上

**関連ドキュメント**:

- [機能設計書 - ユースケース2](./functional-design.md#ユースケース2-ユーザー投稿--aiレス生成)

## ステータス・状態

システム内で使用される各種ステータスの定義。

### isUserPost

**定義**: レスがユーザー投稿かAI投稿かを区別するBoolean型フラグ。

**取りうる値**:

| 値      | 意味                   |
| ------- | ---------------------- |
| `true`  | ユーザーが投稿したレス |
| `false` | AIが生成したレス       |

**使用例**:

```typescript
// ユーザーレス
await postManager.createPost({
  threadId,
  content: 'ユーザーの投稿',
  isUserPost: true, // ユーザー投稿
});

// AIレス
await postManager.createPost({
  threadId,
  content: 'AIの返答',
  characterId: 'majiresu',
  isUserPost: false, // AI投稿
});
```

**データベース**: `posts.is_user_post` カラム（デフォルト: `false`）

## データモデル用語

データベース・データ構造に関する用語。

### Thread エンティティ

**定義**: スレッドを表すデータモデル。

**主要フィールド**:

- `id` (UUID): スレッドの一意識別子
- `title` (string): スレッドタイトル（1-100文字）
- `createdAt` (Date): 作成日時
- `lastPostAt` (Date): 最終レス日時
- `postCount` (number): レス数

**関連エンティティ**: [Post](#post-エンティティ)（1:N関係）

**制約**:

- `id`: UUID v4形式、主キー
- `title`: 1-100文字、必須
- `postCount`: 0以上、デフォルト0

**インデックス**: `idx_threads_last_post_at` (last_post_at DESC)

**データベーステーブル**: `threads`

### Post エンティティ

**定義**: レスを表すデータモデル。

**主要フィールド**:

- `id` (number): レスの一意識別子（自動採番）
- `threadId` (UUID): 所属するスレッドID（外部キー）
- `postNumber` (number): スレッド内のレス番号（1から開始）
- `authorName` (string): 投稿者名（デフォルト: "名無しさん"）
- `characterId` (string | null): キャラクターID（ユーザー投稿の場合はnull）
- `content` (string): 投稿内容（1-2000文字）
- `anchors` (string | null): アンカー情報（カンマ区切り: "1,2,5"）
- `isUserPost` (boolean): ユーザー投稿フラグ
- `createdAt` (Date): 作成日時

**関連エンティティ**: [Thread](#thread-エンティティ)（N:1関係）

**制約**:

- `id`: 自動採番、主キー
- `threadId`: threads.idへの外部キー（ON DELETE CASCADE）
- `content`: 1-2000文字、必須
- `(threadId, postNumber)`: UNIQUE制約

**インデックス**:

- `idx_posts_thread_id` (thread_id)
- `idx_posts_thread_post_number` (thread_id, post_number)

**データベーステーブル**: `posts`

### Character エンティティ

**定義**: AIキャラクターを表すデータモデル。

**主要フィールド**:

- `id` (string): キャラクターID（例: "majiresu"）
- `displayName` (string): 表示名（例: "マジレスニキ"）
- `systemPrompt` (string): LLMに渡すSystem Prompt
- `personality` (string): 性格説明
- `speechStyle` (string): 口調の特徴
- `temperature` (number): LLM temperature（0.0-1.0）
- `keywords` (string[]): 反応しやすいキーワード
- `frequency` (number): 発言頻度（1-10、高いほど頻繁）

**制約**:

- `id`: 英数字、主キー
- `temperature`: 0.0-1.0の範囲
- `frequency`: 1-10の範囲

**定義ファイル**: `src/lib/personas.ts`（コード内定義、データベースには保存しない）

## エラー・例外

システムで定義されているエラーと例外。

### ValidationError

**クラス名**: `ValidationError`

**発生条件**:
ユーザー入力がバリデーションルール（Zodスキーマ）に違反した場合に発生します。

**対処方法**:

- ユーザー: エラーメッセージに従って入力を修正
- 開発者: Zodスキーマが正しいか確認

**例**:

```typescript
// エラーのスロー
if (title.length === 0) {
  throw new ValidationError(
    'タイトルは1-100文字で入力してください',
    'title',
    title
  );
}

// エラーのハンドリング
try {
  const validated = threadSchema.parse(body);
} catch (error) {
  if (error instanceof ValidationError) {
    return c.text(`バリデーションエラー: ${error.message}`, 400);
  }
}
```

**実装箇所**: `src/lib/errors.ts`（将来実装）

### NotFoundError

**クラス名**: `NotFoundError`

**発生条件**:
指定されたリソース（スレッド、レス等）が見つからない場合に発生します。

**対処方法**:

- ユーザー: URLを確認、または存在するリソースにアクセス
- 開発者: IDの受け渡しが正しいか確認

**例**:

```typescript
const thread = await threadManager.getThread(id);
if (!thread) {
  throw new NotFoundError('Thread', id);
}
```

**HTTPステータスコード**: 404

**実装箇所**: `src/lib/errors.ts`（将来実装）

### OllamaConnectionError

**クラス名**: `OllamaConnectionError`

**発生条件**:
Ollama APIへの接続が失敗した場合に発生します（Ollamaコンテナ停止、ネットワークエラー等）。

**対処方法**:

- ユーザー: 管理者に連絡、またはしばらく待ってから再試行
- 開発者: `docker-compose ps` でOllamaコンテナが起動しているか確認

**例**:

```typescript
try {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {...});
} catch (error) {
  throw new OllamaConnectionError(
    'Ollama APIへの接続に失敗しました',
    OLLAMA_BASE_URL,
    error
  );
}
```

**HTTPステータスコード**: 503

**実装箇所**: `src/lib/errors.ts`（将来実装）

### DatabaseError

**クラス名**: `DatabaseError`

**発生条件**:
PostgreSQLへのクエリ実行が失敗した場合に発生します（接続失敗、制約違反、SQL構文エラー等）。

**対処方法**:

- ユーザー: 管理者に連絡
- 開発者: ログを確認し、クエリ構文やデータベース状態をチェック

**例**:

```typescript
try {
  await db.query('INSERT INTO threads ...', [params]);
} catch (error) {
  throw new DatabaseError(
    'スレッドの作成に失敗しました',
    'INSERT INTO threads ...',
    error
  );
}
```

**HTTPステータスコード**: 500

**実装箇所**: `src/lib/errors.ts`（将来実装）

## 計算・アルゴリズム

特定の計算方法やアルゴリズムに関する用語。

### キーワードマッチングスコア

**定義**: ユーザー投稿内容に含まれるキャラクターのキーワード数に応じて算出される0-100点のスコア。

**計算式**:

```
マッチ数が0個 → 0点
マッチ数が1個 → 50点
マッチ数が2個 → 75点
マッチ数が3個以上 → 100点
```

**実装箇所**: `src/services/characterSelector.ts` - `calculateKeywordScore()`

**使用例**:

```
投稿内容: "プログラミング言語の型安全性について"
マジレスニキのキーワード: ["プログラミング", "技術", "正論", "理由"]
→ マッチ数: 1個（"プログラミング"）
→ キーワードスコア: 50点
```

**関連**: [総合スコア](#総合スコア)

### 発言頻度スコア

**定義**: キャラクターの発言頻度設定（1-10）を0-100点にマッピングしたスコア。

**計算式**:

```
発言頻度スコア = (frequency / 10) × 100
```

**実装箇所**: `src/services/characterSelector.ts` - `calculateFrequencyScore()`

**使用例**:

```
マジレスニキのfrequency: 8
→ 発言頻度スコア: (8 / 10) × 100 = 80点
```

**関連**: [総合スコア](#総合スコア)

### 総合スコア

**定義**: キーワードマッチングスコアと発言頻度スコアの加重平均で算出される、キャラクター選択の最終判定スコア。

**計算式**:

```
総合スコア = (キーワードスコア × 70%) + (発言頻度スコア × 30%)
```

**選択基準**:

- 総合スコア30点以上のキャラクターを「関心あり」として抽出
- 「関心あり」のキャラクターをスコア順にソート
- 上位から2-5体をランダムに選択

**実装箇所**: `src/services/characterSelector.ts` - `calculateTotalScore()`

**使用例**:

```
キーワードスコア: 50点
発言頻度スコア: 80点
→ 総合スコア = (50 × 0.7) + (80 × 0.3) = 35 + 24 = 59点
→ 30点以上なので「関心あり」として選択候補に
```

**関連ドキュメント**:

- [機能設計書 - キャラクター選択アルゴリズム](./functional-design.md#キャラクター選択アルゴリズム)

## 索引

### あ行

- [アンカー](#アンカー-anchor) - ドメイン用語
- [AIレス生成](#aiレス生成) - ドメイン用語

### か行

- [キーワードマッチングスコア](#キーワードマッチングスコア) - 計算・アルゴリズム
- [キャラクター](#キャラクター-character) - ドメイン用語
- [キャラクター選択](#キャラクター選択) - ドメイン用語

### さ行

- [システムプロンプト](#システムプロンプト-system-prompt) - ドメイン用語
- [スレッド](#スレッド-thread) - ドメイン用語
- [総合スコア](#総合スコア) - 計算・アルゴリズム

### た行

- [ThreadManager](#thread-エンティティ) - データモデル用語

### は行

- [発言頻度スコア](#発言頻度スコア) - 計算・アルゴリズム
- [非同期処理](#非同期処理) - アーキテクチャ用語
- [ペルソナ](#ペルソナ-persona) - ドメイン用語

### ら行

- [レイヤードアーキテクチャ](#レイヤードアーキテクチャ-layered-architecture) - アーキテクチャ用語
- [レス](#レス-post) - ドメイン用語

### A-Z

- [API](#api) - 略語
- [Character](#character-エンティティ) - データモデル用語
- [CRUD](#crud) - 略語
- [DatabaseError](#databaseerror) - エラー・例外
- [Docker Compose](#docker-compose) - 技術用語
- [Hono](#hono) - 技術用語
- [Hono JSX](#hono-jsx) - 技術用語
- [isUserPost](#isuserpost) - ステータス・状態
- [JSX](#jsx) - 略語
- [LLM](#llm) - 略語
- [node-postgres](#node-postgres-pg) - 技術用語
- [NotFoundError](#notfounderror) - エラー・例外
- [Ollama](#ollama) - 技術用語
- [OllamaConnectionError](#ollamaconnectionerror) - エラー・例外
- [Post](#post-エンティティ) - データモデル用語
- [PostgreSQL](#postgresql) - 技術用語
- [SSE](#sse) - 略語
- [Thread](#thread-エンティティ) - データモデル用語
- [TypeScript](#typescript) - 技術用語
- [UUID](#uuid) - 略語
- [ValidationError](#validationerror) - エラー・例外
- [Zod](#zod) - 技術用語

## 変更履歴

| 日付       | 変更内容                         |
| ---------- | -------------------------------- |
| 2026-03-30 | 初版作成（/setup-project完了時） |
