# 機能設計書 (Functional Design Document)

## 概要

LLM Persona Sandboxのシステム機能とコンポーネント設計。

**関連ドキュメント**:
- [プロダクト要求定義書](./product-requirements.md) - 実現する要件
- [アーキテクチャ設計書](./architecture.md) - 技術的実現方法
- [データモデル定義書](./data-models.md) - データ構造詳細
- [API仕様書](./api-specifications.md) - API詳細

## システム構成概要

```
┌──────────────┐
│  ユーザー    │ HTTP Request
└──────┬───────┘
       ▼
┌────────────────────────────┐
│  Honoアプリケーション      │
│  (routes + views)          │
└─┬──────┬──────────────────┬┘
  │      │                  │
  ▼      ▼                  ▼
ThreadMgr PostMgr    ResponseGenerator
  │      │                  │
  │      │         ┌────────┴────────┐
  │      │         ▼                 ▼
  │      │   CharacterSelector  OllamaClient
  │      │         │                 │
  └──────┴─────────┴─────────────────┤
                   ▼                 ▼
              PostgreSQL          Ollama
```

**詳細構成**: [アーキテクチャ設計書](./architecture.md#レイヤードアーキテクチャ)、[デプロイメントガイド](./deployment-guide.md#docker構成)

## コンポーネント設計

### Webレイヤー

#### ThreadRoutes

**責務**: スレッド関連のHTTPエンドポイント処理

**主要エンドポイント**:
- `GET /`: スレッド一覧表示
- `GET /thread/:id`: スレッド詳細表示
- `POST /thread`: スレッド作成
- `POST /thread/:id/post`: レス投稿

**依存関係**: ThreadManager, PostManager, ResponseGenerator

### サービスレイヤー

#### ThreadManager

**責務**: スレッドのCRUD操作

**主要メソッド**:
- `createThread(title, firstPost)`: スレッド作成と初回レス保存
- `listThreads(limit)`: スレッド一覧取得（最新レス順）
- `getThread(id)`: スレッド取得
- `updateLastPostAt(id)`: 最終レス日時更新

**依存関係**: DatabaseClient

#### PostManager

**責務**: レスのCRUD操作

**主要メソッド**:
- `createPost(data)`: レス作成
- `getPostsByThread(threadId)`: スレッドの全レス取得
- `getRecentPosts(threadId, limit)`: 最新N件のレス取得（スレッド履歴用）
- `getNextPostNumber(threadId)`: 次のレス番号を取得

**依存関係**: DatabaseClient

#### ResponseGenerator

**責務**: AIキャラクターによるレス生成の統括

**主要メソッド**:
- `generateResponses(threadId, userPost, threadHistory)`: ユーザー投稿に対してAIレス生成
- `generateIndividual(character, history, userPost)`: 個別キャラクターのレス生成（内部）

**依存関係**: CharacterSelector, OllamaClient, PostManager

**処理フロー**:
1. キャラクター選択（CharacterSelector）
2. 各キャラクターごとにループ:
   - System Prompt構築
   - User Prompt構築（スレッド履歴 + 最新投稿）
   - Ollama APIへリクエスト
   - 生成されたレスをDBに保存（PostManager）

#### CharacterSelector

**責務**: 投稿内容に応じて反応するキャラクターを選択

**主要メソッド**:
- `selectCharacters(userPost, history, minCount, maxCount)`: キャラクター選択（2-5体）
- `selectByKeywords(userPost, min, max)`: キーワードマッチング方式（現行）
- `selectByLLM(userPost, history, min, max)`: LLM判定方式（将来実装）

**依存関係**: キャラクター定義（personas.ts）

**詳細アルゴリズム**: [キャラクター選択アルゴリズム](#キャラクター選択アルゴリズム)

#### OllamaClient

**責務**: Ollama APIへのHTTPリクエスト送信

**主要メソッド**:
- `chat(model, messages, options)`: チャット補完リクエスト
- `chatStream(model, messages, options)`: ストリーミングチャット（将来実装）

**依存関係**: fetch API、環境変数（OLLAMA_BASE_URL）

**API仕様**: [API仕様書](./api-specifications.md#ollama-api)

### データレイヤー

#### DatabaseClient

**責務**: PostgreSQLへの接続とクエリ実行

**主要メソッド**:
- `query(sql, params)`: パラメータ化クエリ実行
- `beginTransaction()`: トランザクション開始
- `commit()`: コミット
- `rollback()`: ロールバック

**依存関係**: node-postgres (pg)

**スキーマ詳細**: [データモデル定義書](./data-models.md#データベーススキーマ)

## キャラクター選択アルゴリズム

### 目的

投稿内容に応じて、適切なキャラクターを2-5体選択する。

### キーワードマッチング方式（現行実装）

#### ステップ1: キーワードマッチングスコア計算（0-100点）

投稿内容に含まれるキャラクターのキーワードの数に応じてスコアを算出：

```
マッチ数が0個 → 0点
マッチ数が1個 → 50点
マッチ数が2個 → 75点
マッチ数が3個以上 → 100点
```

#### ステップ2: 発言頻度スコア計算（0-100点）

キャラクターの発言頻度設定（1-10）を0-100点にマッピング：

```
発言頻度スコア = (frequency / 10) × 100
```

#### ステップ3: 総合スコア計算

キーワードスコアと発言頻度スコアの加重平均：

```
総合スコア = (キーワードスコア × 70%) + (発言頻度スコア × 30%)
```

**例**:
```
キーワードスコア: 50点（1個マッチ）
発言頻度スコア: 80点（frequency = 8）
→ 総合スコア = (50 × 0.7) + (80 × 0.3) = 59点
```

#### ステップ4: キャラクター選択

1. 全キャラクターの総合スコアを計算
2. スコアが30点以上のキャラクターを「関心あり」として抽出
3. 「関心あり」のキャラクターをスコア順にソート
4. 上位から2-5体をランダムに選択（完全に上位だけだと単調になるため）
5. 「関心あり」が最小数未満の場合、ランダムに補充

### LLM判定方式（将来実装）

LLMに投稿内容を分析させ、各キャラクターが反応すべきか判定する方式。
詳細は実装時に設計。

## AIレス生成アルゴリズム

### 目的

選択されたキャラクターごとに、スレッドの文脈を理解した自然なレスを生成する。

### プロンプト構築ロジック

#### ステップ1: スレッド履歴のフォーマット

過去のレス（最大20件）を2ch風テキスト形式に変換：

```
1: 名無しさん: プログラミング言語で一番好きなのは？
2: マジレスニキ: いや、それはTypeScriptだろ。型安全性が段違い。
3: 煽りカス: TypeScriptｗｗｗ　型で遊んでるだけじゃんｗ
```

#### ステップ2: System Promptの構築

キャラクターの設定とルールをSystem Promptとして設定：

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

#### ステップ3: User Promptの構築

スレッド履歴と最新の投稿を組み合わせる：

```
以下のスレッドに対して、レスしてください。

スレッド履歴:
{threadHistory}

最新の投稿:
{latestPostNumber}: {latestAuthorName}: {latestContent}

あなたのレス（本文のみ、レス番号不要）:
```

#### ステップ4: Ollama APIへのリクエスト

構築したプロンプトをOllama APIに送信し、レスを生成。

**API詳細**: [API仕様書](./api-specifications.md#post-apichat)

## ユースケースフロー

### ユースケース1: スレッド作成

1. ユーザーがスレッドタイトルと初回投稿を送信
2. Honoがバリデーション（タイトル1-100文字、内容1-2000文字）
3. ThreadManagerがスレッドをDBに作成
4. PostManagerが初回レス（レス番号1）をDBに作成
5. スレッド詳細ページにリダイレクト

### ユースケース2: ユーザー投稿 + AIレス生成

1. ユーザーがレスを投稿
2. Honoがバリデーション（内容1-2000文字）
3. PostManagerがユーザーレスをDBに保存
4. ユーザーにスレッド詳細ページを返す（即座にリダイレクト）
5. **非同期で**ResponseGeneratorがAIレス生成を開始:
   - スレッド履歴（最新20件）を取得
   - CharacterSelectorが反応するキャラクターを2-5体選択
   - 各キャラクターごとにループ:
     - OllamaClientがOllama APIにリクエスト
     - 生成されたレスをPostManagerがDBに保存
6. 全てのAIレス生成が完了

### ユースケース3: スレッド一覧表示

1. ユーザーがトップページにアクセス
2. ThreadManagerが最新50件のスレッドを取得（lastPostAt降順）
3. Hono JSXでスレッド一覧をレンダリング
4. HTMLをユーザーに返す

### ユースケース4: スレッド詳細表示

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ レスを書く ]
名前: 名無しさん
内容: [              ]
       [ 書き込む    ]
```

### カラーコーディング

- **投稿者名**: 緑色（#117743）- ユーザー・AI共通
- **アンカーリンク**: 青色（#0000ff）、下線付き
- **背景色**: スレッド詳細（#f0e0d6）、一覧（#ffffff）

**CSS詳細**: `src/views/Layout.tsx`に実装

## パフォーマンス最適化

### データベースクエリ最適化

- **インデックス**: `threads.lastPostAt`、`posts.threadId` にインデックス作成
- **LIMIT句**: スレッド一覧は最大50件、レス履歴は最大20件に制限

### AIレス生成の最適化

- **非同期処理**: ユーザーレス保存後、即座にレスポンス返す
- **文脈制限**: スレッド履歴は最新20件のみ使用（トークン数削減）
- **モデル選択**: デフォルトはllama3.1:8b（高速）

### Docker最適化

- **ボリュームマウント**: Ollamaモデルデータをボリュームで永続化
- **メモリ制限**: docker-compose.ymlでメモリ上限を設定

## セキュリティ考慮事項

### XSS対策

- **HTMLエスケープ**: Hono JSXのデフォルトエスケープ機能を使用

### SQLインジェクション対策

- **パラメータ化クエリ**: node-postgresのプレースホルダーを使用
- **例**: `SELECT * FROM threads WHERE id = $1` （$1がパラメータ）

### 環境変数の管理

- **.env**: APIキー、DB接続情報を.envに記載
- **.gitignore**: .envファイルをGit管理から除外

### コンテナ間通信の制限

- **内部ネットワーク**: OllamaとPostgreSQLはDocker内部ネットワークのみでアクセス可能
- **外部公開しない**: Ollama（11434）とPostgreSQL（5432）はホストにポート公開しない

## エラーハンドリング

| エラー種別             | 処理                             | ユーザーへの表示                                   |
| ---------------------- | -------------------------------- | -------------------------------------------------- |
| バリデーションエラー   | 処理を中断、エラーメッセージ表示 | 「タイトルは1-100文字で入力してください」          |
| スレッドが見つからない | 404ページ表示                    | 「スレッドが見つかりません」                       |
| Ollama接続エラー       | エラーログ記録、スレッド表示継続 | 「AIレス生成に失敗しました」（ユーザーレスは保存） |
| データベース接続エラー | 500ページ表示                    | 「サーバーエラーが発生しました」                   |

**エラーログフォーマット**:
```
[2025-01-15T14:32:18.123Z] ERROR OllamaClient: Connection failed to http://ollama:11434
```

## テスト戦略

### 手動テスト（MVP段階）

**テストケース**:
- [ ] スレッド作成（タイトル・本文入力、作成後リダイレクト）
- [ ] ユーザーレス投稿（投稿後即座にページ表示、AIレス生成開始）
- [ ] AIレス生成（3-5体のキャラクター、口調の一致、アンカーの自然さ）
- [ ] キャラクター選択（キーワードに応じた反応、ランダム性）
- [ ] エラーハンドリング（Ollama停止時、DB接続失敗時）

### 統合テスト（将来実装）

- フレームワーク: Vitest
- 対象: OllamaClient, DatabaseClient, CharacterSelector

### E2Eテスト（将来実装）

- ツール: Playwright
- シナリオ: スレッド作成からAIレス生成までの一連フロー

## 関連ドキュメント

- [プロダクト要求定義書](./product-requirements.md) - 実現する要件
- [アーキテクチャ設計書](./architecture.md) - 技術的実現方法
- [データモデル定義書](./data-models.md) - データ構造詳細
- [API仕様書](./api-specifications.md) - Ollama API詳細
- [デプロイメントガイド](./deployment-guide.md) - 環境構築手順
- [リポジトリ構造定義書](./repository-structure.md) - ファイル構造
- [開発ガイドライン](./development-guidelines.md) - 開発規約
