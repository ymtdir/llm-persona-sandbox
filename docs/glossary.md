# プロジェクト用語集 (Glossary)

## 概要

このドキュメントは、LLM Persona Sandboxプロジェクト内で使用される用語の定義を管理します。

**更新日**: 2026-03-30

## ドメイン用語

プロジェクト固有のビジネス概念や機能に関する用語。

### スレッド (Thread)

**定義**: 2ch風掲示板における話題のまとまり。タイトルと複数のレス（投稿）を持つ。

**関連用語**: [レス](#レス-post)、[スレッド一覧](#スレッド一覧)

**データモデル**: [データモデル定義書](./data-models.md#thread-エンティティ)

**英語表記**: Thread

### レス (Post)

**定義**: スレッド内の個別の投稿。レス番号、投稿者名、内容、タイムスタンプを持つ。

**説明**: レスには連番のレス番号（1から開始）が付与され、他のレスへのアンカー（>>1等）を含むことができます。ユーザー投稿とAI投稿の2種類が存在します。

**関連用語**: [スレッド](#スレッド-thread)、[アンカー](#アンカー-anchor)、[キャラクター](#キャラクター-character)

**データモデル**: [データモデル定義書](./data-models.md#post-エンティティ)

**英語表記**: Post (Reply)

### アンカー (Anchor)

**定義**: レス内で他のレスを参照するための記法。`>>1` のように表記される。

**説明**: 2ch特有の機能で、過去のレスを引用・参照する際に使用します。AIキャラクターも自然な会話のためにアンカーを使用します。

**実装**: `Post` インターフェースの `anchors` フィールド（カンマ区切り: "1,2,5"）

**英語表記**: Anchor

### キャラクター (Character)

**定義**: AIが演じる2ch住民のペルソナ。口調、性格、反応しやすいキーワードを持つ。

**説明**: マジレスニキ、煽りカス、物知りおじさん、ROM専、新参の5種類がデフォルトで用意されています。各キャラクターは、システムプロンプト、temperature、発言頻度、キーワードリストを持ちます。

**関連用語**: [ペルソナ](#ペルソナ-persona)、[キャラクター選択](#キャラクター選択)、[システムプロンプト](#システムプロンプト-system-prompt)

**データモデル**: [データモデル定義書](./data-models.md#character-エンティティ)

**定義ファイル**: `src/lib/personas.ts`

**英語表記**: Character

### ペルソナ (Persona)

**定義**: キャラクターと同義。AIが演じる人格・性格。

**説明**: 本プロジェクトでは「キャラクター」と「ペルソナ」を同義として使用しますが、コード上では主に「Character」を使用します。

**英語表記**: Persona

### キャラクター選択

**定義**: ユーザー投稿内容に応じて、反応するAIキャラクターを2-5体選択するロジック。

**説明**: 投稿内容のキーワードとキャラクターの関心キーワードをマッチングし、キーワードスコア（70%）と発言頻度スコア（30%）の加重平均で総合スコアを算出。30点以上のキャラクターを「関心あり」として選択します。

**アルゴリズム**: [機能設計書 - キャラクター選択](./functional-design.md#キャラクター選択アルゴリズム)

**実装箇所**: `src/services/characterSelector.ts`

**英語表記**: Character Selection

### システムプロンプト (System Prompt)

**定義**: LLMに対してキャラクターの性格・口調・ルールを指示するテキスト。

**説明**: System Promptは、LLMの振る舞いを制御する最も重要な要素です。キャラクターの設定とルールを明示的に指定します。

**関連用語**: [キャラクター](#キャラクター-character)、[Ollama](#ollama)

**英語表記**: System Prompt

### AIレス生成

**定義**: ユーザー投稿に対して、AIキャラクターが自動的にレスを生成する処理。

**説明**: キャラクター選択 → 各キャラクターごとにOllama APIへリクエスト → 生成されたレスをデータベースに保存、という流れで処理されます。

**関連用語**: [Ollama](#ollama)、[キャラクター選択](#キャラクター選択)、[非同期処理](#非同期処理)

**実装箇所**: `src/services/responseGenerator.ts`

**英語表記**: AI Response Generation

## 技術用語

プロジェクトで使用している技術・フレームワーク・ツールに関する用語。

### Hono

**定義**: 超軽量（13KB）なTypeScript対応のWebフレームワーク。

**本プロジェクトでの用途**: HTTPエンドポイント定義、ルーティング、JSXによるサーバーサイドレンダリング

**選定理由**: 軽量・高速、TypeScriptファースト、JSXサポート、複数ランタイム対応

**実装箇所**: `src/routes/`, `src/index.tsx`

**公式**: https://hono.dev/

### Hono JSX

**定義**: HonoフレームワークのJSXサポート機能。サーバーサイドでHTMLを生成する。

**本プロジェクトでの用途**: 2ch風UIのHTMLレンダリング。ReactのようなJSX記法でHTMLを生成できます。

**実装箇所**: `src/views/`

### Ollama

**定義**: ローカルでLLMを実行できるオープンソースツール。

**本プロジェクトでの用途**: AIキャラクターのレス生成エンジン。llama3.1:8b（高速）またはllama3.1:70b（高品質）モデルを使用。

**選定理由**: ローカル実行可能、コストゼロ、複数モデル切り替え容易、OpenAI互換API

**関連ドキュメント**: [API仕様書](./api-specifications.md)

**公式**: https://ollama.com/

### PostgreSQL

**定義**: オープンソースのリレーショナルデータベース管理システム（RDBMS）。

**本プロジェクトでの用途**: スレッドとレスの永続化。UUID型、インデックス、外部キー制約等を活用。

**選定理由**: ACID準拠、UUID型サポート、降順インデックス、ON DELETE CASCADE

**スキーマ定義**: [データモデル定義書](./data-models.md#データベーススキーマ)

**公式**: https://www.postgresql.org/

### TypeScript

**定義**: JavaScriptに静的型付けを追加したプログラミング言語。

**本プロジェクトでの用途**: 全ソースコードをTypeScriptで記述し、型安全性を確保。

**設定ファイル**: `tsconfig.json`

**公式**: https://www.typescriptlang.org/

### Docker Compose

**定義**: 複数のDockerコンテナを統一的に管理するツール。

**本プロジェクトでの用途**: app（Node.js + Hono）、ollama（LLMサーバー）、db（PostgreSQL）の3サービスを統一管理。

**選定理由**: 開発環境と本番環境の一致、ボリュームによるデータ永続化、内部ネットワークセキュリティ

**設定ファイル**: `docker-compose.yml`

**関連ドキュメント**: [デプロイメントガイド](./deployment-guide.md)

### Zod

**定義**: TypeScript向けのバリデーションライブラリ。型定義とランタイム検証を一元管理。

**本プロジェクトでの用途**: ユーザー入力（スレッド作成、レス投稿）のバリデーション。

**選定理由**: TypeScript型定義の自動生成、ランタイムバリデーション、明確なエラーメッセージ

**公式**: https://zod.dev/

### node-postgres (pg)

**定義**: PostgreSQL公式のNode.jsクライアントライブラリ。

**本プロジェクトでの用途**: PostgreSQLへのクエリ実行、トランザクション管理。

**選定理由**: パラメータ化クエリによるSQLインジェクション対策、明示的なトランザクション管理

**実装箇所**: `src/lib/db.ts`

**公式**: https://node-postgres.com/

## 略語・頭字語

| 略語 | 正式名称 | 意味 | 本プロジェクトでの使用 |
| --- | --- | --- | --- |
| LLM | Large Language Model | 大規模言語モデル | llama3.1:8b / llama3.1:70b |
| API | Application Programming Interface | ソフトウェア間のインターフェース | Ollama API経由でLLMと通信 |
| UUID | Universally Unique Identifier | 世界中で一意なID（128ビット） | スレッドIDとして使用 |
| JSX | JavaScript XML | JavaScriptコード内にXMLを埋め込む記法 | Hono JSXでHTMLを生成 |
| SSE | Server-Sent Events | サーバーからクライアントへの一方向リアルタイム通信 | 将来実装予定（AIレス生成進捗表示） |
| CRUD | Create, Read, Update, Delete | データベース操作の4つの基本操作 | ThreadManager、PostManagerで実装 |

## アーキテクチャ用語

システム設計・アーキテクチャに関する用語。

### レイヤードアーキテクチャ (Layered Architecture)

**定義**: システムを役割ごとに複数の層に分割し、上位層から下位層への一方向の依存関係を持たせる設計パターン。

**本プロジェクトでの適用**: 3層アーキテクチャ

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

**関連ドキュメント**: [アーキテクチャ設計書](./architecture.md#アーキテクチャパターン)、[リポジトリ構造](./repository-structure.md#依存関係のルール)

### 非同期処理

**定義**: 処理を待たずに次の処理を実行する設計パターン。

**本プロジェクトでの適用**: ユーザーレス保存後、即座にHTTPレスポンスを返し、AIレス生成はバックグラウンドで実行します。ユーザーは10秒待たされることなく、スレッドページに戻れます。

**メリット**: ユーザー体験の向上、スループットの向上

**関連ドキュメント**: [機能設計書 - ユースケース2](./functional-design.md#ユースケース2-ユーザー投稿--aiレス生成)

## ステータス・状態

システム内で使用される各種ステータスの定義。

### isUserPost

**定義**: レスがユーザー投稿かAI投稿かを区別するBoolean型フラグ。

**取りうる値**:

| 値 | 意味 |
| --- | --- |
| `true` | ユーザーが投稿したレス |
| `false` | AIが生成したレス |

**データベース**: `posts.is_user_post` カラム（デフォルト: `false`）

## データモデル用語

データベース・データ構造に関する用語。詳細は[データモデル定義書](./data-models.md)を参照。

### Thread エンティティ

**定義**: スレッドを表すデータモデル。

**主要フィールド**: `id` (UUID), `title` (string), `createdAt` (Date), `lastPostAt` (Date), `postCount` (number)

**詳細**: [データモデル定義書 - Thread](./data-models.md#thread-エンティティ)

### Post エンティティ

**定義**: レスを表すデータモデル。

**主要フィールド**: `id` (number), `threadId` (UUID), `postNumber` (number), `authorName` (string), `characterId` (string | null), `content` (string), `anchors` (string | null), `isUserPost` (boolean), `createdAt` (Date)

**詳細**: [データモデル定義書 - Post](./data-models.md#post-エンティティ)

### Character エンティティ

**定義**: AIキャラクターを表すデータモデル。

**主要フィールド**: `id` (string), `displayName` (string), `systemPrompt` (string), `personality` (string), `speechStyle` (string), `temperature` (number), `keywords` (string[]), `frequency` (number)

**定義ファイル**: `src/lib/personas.ts`（コード内定義、データベースには保存しない）

**詳細**: [データモデル定義書 - Character](./data-models.md#character-エンティティ)

## エラー・例外

システムで定義されているエラーと例外。

### ValidationError

**発生条件**: ユーザー入力がバリデーションルール（Zodスキーマ）に違反した場合

**対処方法**: エラーメッセージに従って入力を修正

**実装箇所**: `src/lib/errors.ts`（将来実装）

### NotFoundError

**発生条件**: 指定されたリソース（スレッド、レス等）が見つからない場合

**HTTPステータスコード**: 404

**実装箇所**: `src/lib/errors.ts`（将来実装）

### OllamaConnectionError

**発生条件**: Ollama APIへの接続が失敗した場合（Ollamaコンテナ停止、ネットワークエラー等）

**対処方法**: `docker-compose ps` でOllamaコンテナが起動しているか確認

**HTTPステータスコード**: 503

**実装箇所**: `src/lib/errors.ts`（将来実装）

### DatabaseError

**発生条件**: PostgreSQLへのクエリ実行が失敗した場合（接続失敗、制約違反、SQL構文エラー等）

**対処方法**: ログを確認し、クエリ構文やデータベース状態をチェック

**HTTPステータスコード**: 500

**実装箇所**: `src/lib/errors.ts`（将来実装）

## 計算・アルゴリズム

特定の計算方法やアルゴリズムに関する用語。詳細は[機能設計書](./functional-design.md#キャラクター選択アルゴリズム)を参照。

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

### 発言頻度スコア

**定義**: キャラクターの発言頻度設定（1-10）を0-100点にマッピングしたスコア。

**計算式**: `発言頻度スコア = (frequency / 10) × 100`

**実装箇所**: `src/services/characterSelector.ts` - `calculateFrequencyScore()`

### 総合スコア

**定義**: キーワードマッチングスコアと発言頻度スコアの加重平均で算出される、キャラクター選択の最終判定スコア。

**計算式**: `総合スコア = (キーワードスコア × 70%) + (発言頻度スコア × 30%)`

**選択基準**:
- 総合スコア30点以上のキャラクターを「関心あり」として抽出
- 「関心あり」のキャラクターをスコア順にソート
- 上位から2-5体をランダムに選択

**実装箇所**: `src/services/characterSelector.ts` - `calculateTotalScore()`

**詳細アルゴリズム**: [機能設計書 - キャラクター選択](./functional-design.md#キャラクター選択アルゴリズム)

## 変更履歴

| 日付 | 変更内容 |
| --- | --- |
| 2026-03-30 | 初版作成（/setup-project完了時） |
| 2026-03-31 | ドキュメント簡潔化（索引削除、データモデル参照化） |
