# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術       | バージョン |
| ---------- | ---------- |
| Node.js    | 20.x LTS   |
| TypeScript | 5.x        |
| npm        | 10.x       |

**選定理由**:

- **Node.js 20.x LTS**
  - 2026年4月までの長期サポート保証により、本番環境での安定稼働が期待できる
  - 非同期I/O処理に優れ、Ollama APIへの並列リクエスト処理に最適
  - Dockerコンテナとの親和性が高く、軽量なイメージを構築可能
  - npmエコシステムが充実しており、必要なライブラリの入手が容易

- **TypeScript 5.x**
  - 静的型付けによりコンパイル時にバグを検出でき、保守性が向上
  - IDEの補完機能が強力で、開発効率が高い
  - Honoフレームワークとの型統合により、エンドポイントの型安全性を担保
  - Zodと組み合わせることで、ランタイムバリデーションとTypeScript型定義を一元管理可能

- **npm 10.x**
  - Node.js 20.xに標準搭載されており、別途インストール不要
  - package-lock.jsonによる依存関係の厳密な管理が可能
  - npmレジストリから豊富なライブラリを利用可能

### フレームワーク・ライブラリ

| 技術              | バージョン | 用途                   | 選定理由                                                                                            |
| ----------------- | ---------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| Hono              | ^4.x       | Webフレームワーク      | 超軽量（13KB）、TypeScript完全対応、ミドルウェアによる拡張性、JSXビューサポート                     |
| @hono/node-server | ^1.x       | Node.jsアダプター      | HonoアプリをNode.jsのHTTPサーバーとして起動、開発・本番環境で同じコードを使用可能                   |
| Zod               | ^3.x       | バリデーション         | TypeScript型定義との統合、ランタイム検証、明確なエラーメッセージ、APIリクエストのスキーマ検証に最適 |
| node-postgres(pg) | ^8.x       | PostgreSQLクライアント | 軽量、パラメータ化クエリによるSQLインジェクション対策、PostgreSQL公式ドライバ、トランザクション対応 |

**Hono選定の詳細理由**:

- Express.jsと比較して起動速度が10倍以上高速
- TypeScriptファーストの設計により、型推論が強力
- Cloudflare Workers、Deno、Bunなど複数ランタイムに対応（将来的な移行の柔軟性）
- JSXによるサーバーサイドレンダリングがビルトインでサポート
- ミドルウェアによるCORS、ロガー、エラーハンドリングの統一的な実装が可能

**Zod選定の詳細理由**:

- バリデーションルールがTypeScript型定義として再利用可能（DRY原則）
- ネストされたオブジェクトや配列の複雑なバリデーションに対応
- エラーメッセージのカスタマイズが容易
- パフォーマンスが高く、ランタイムオーバーヘッドが最小限

**node-postgres選定の詳細理由**:

- ORMを使わないことで、クエリの透明性と最適化の自由度を確保
- パラメータ化クエリ（$1, $2形式）による確実なSQLインジェクション対策
- トランザクション管理が明示的で理解しやすい
- PostgreSQL特有の機能（JSONB、配列型等）を直接活用可能

### インフラストラクチャ

| 技術           | バージョン | 用途               | 選定理由                                                                                               |
| -------------- | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| PostgreSQL     | 17.x       | リレーショナルDB   | 安定性、ACID準拠、UUID型サポート、JSON型サポート、Docker公式イメージの充実、長期サポート（2029年まで） |
| Ollama         | latest     | LLMサーバー        | ローカル実行可能、コストゼロ、複数モデル切り替え対応、OpenAI互換API、GPU/CPU両対応                     |
| Docker         | 24.x       | コンテナランタイム | 環境の再現性、開発・本番環境の完全一致、依存関係の分離、シンプルなデプロイ                             |
| Docker Compose | 2.x        | マルチコンテナ管理 | 3サービス（app, ollama, db）の統一的な管理、依存関係の明示、ボリューム管理、ネットワーク分離           |

**PostgreSQL 17.x選定の詳細理由**:

- UUID型のネイティブサポートにより、スレッドIDの生成が効率的
- CREATE INDEX ... DESC構文により、lastPostAtの降順インデックスが最適化可能
- ON DELETE CASCADEによる参照整合性の自動管理
- CHECK制約によるデータレベルのバリデーション（content長さ制限等）
- Docker公式イメージが定期的に更新され、セキュリティパッチが迅速に提供される
- 長期サポート期間（2029年まで）により、本番運用での安定性が保証される
- VACUUM処理の最適化によるパフォーマンス改善

**Ollama選定の詳細理由**:

- クラウドLLM API（OpenAI、Claude等）と比較してコストゼロ（レンタルサーバー代除く）
- ネットワークレイテンシがゼロ（Docker内部通信）のため、レスポンス速度が安定
- llama3.1:8b（高速）とllama3.1:70b（高品質）の切り替えが環境変数のみで可能
- モデルデータがDockerボリュームで永続化されるため、再ダウンロード不要
- OpenAI互換APIのため、将来的にクラウドLLMへの切り替えが容易

**Docker Compose選定の詳細理由**:

- docker-compose.yml一つで開発環境と本番環境が完全一致
- depends_onによるサービス起動順序の制御（db → ollama → app）
- 内部ネットワークによるセキュリティ向上（OllamaとDBは外部公開しない）
- ボリュームによるデータ永続化（ollama-data、db-data）
- docker-compose up -d一発でサービス全体が起動

### 開発ツール

| 技術     | バージョン | 用途                     | 選定理由                                                                                     |
| -------- | ---------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| tsx      | ^4.x       | TypeScript実行           | ts-nodeより高速、Node.jsのESM対応、開発時のホットリロード                                    |
| ESLint   | ^9.x       | 静的解析                 | TypeScript対応、コードスタイルの統一、潜在的なバグの検出                                     |
| Prettier | ^3.x       | コードフォーマッター     | 自動整形による可読性向上、チーム開発での一貫性                                               |
| Nodemon  | ^3.x       | ファイル監視・自動再起動 | 開発時の生産性向上、ファイル変更検知、Dockerボリュームマウントとの併用で快適な開発環境を実現 |

**tsx選定の詳細理由**:

- ts-nodeと比較して起動速度が3-5倍高速（esbuildベース）
- Node.js 20.xのESMモジュールに完全対応
- tsconfig.jsonの設定を自動的に尊重
- 開発時のストレスが大幅に軽減

## アーキテクチャパターン

### レイヤードアーキテクチャ

```
┌─────────────────────────────────────────┐
│   Webレイヤー (routes/)                 │
│   - ThreadRoutes                         │
│   - ユーザー入力の受付とバリデーション   │
│   - HTTPレスポンスの生成                 │
├─────────────────────────────────────────┤
│   サービスレイヤー (services/)           │
│   - ThreadManager, PostManager           │
│   - ResponseGenerator                    │
│   - CharacterSelector                    │
│   - ビジネスロジック                     │
├─────────────────────────────────────────┤
│   データレイヤー (lib/)                  │
│   - DatabaseClient                       │
│   - OllamaClient                         │
│   - データ永続化・外部API呼び出し        │
└─────────────────────────────────────────┘
```

#### Webレイヤー

- **責務**: HTTPリクエストの受付、バリデーション、レスポンスの生成
- **許可される操作**: サービスレイヤーの呼び出し、Hono JSXによるビュー生成
- **禁止される操作**: データレイヤーへの直接アクセス、ビジネスロジックの実装

**実装例**:

```typescript
// routes/threads.tsx
app.post('/thread/:id/post', async (c) => {
  // バリデーション（Webレイヤーの責務）
  const body = await c.req.json();
  const validated = postSchema.parse(body); // Zodによる検証

  // サービスレイヤーの呼び出し（OK）
  const post = await postManager.createPost({
    threadId: c.req.param('id'),
    content: validated.content,
    isUserPost: true,
  });

  // ビジネスロジック呼び出し（OK）
  responseGenerator.generateResponses(post.threadId, post);

  return c.redirect(`/thread/${post.threadId}`);
});
```

#### サービスレイヤー

- **責務**: ビジネスロジックの実装、データ変換、トランザクション制御
- **許可される操作**: データレイヤーの呼び出し、他のサービスレイヤーの呼び出し
- **禁止される操作**: Webレイヤーへの依存、HTTPレスポンスの生成

**実装例**:

```typescript
// services/responseGenerator.ts
class ResponseGenerator {
  async generateResponses(
    threadId: string,
    userPost: Post,
    threadHistory: Post[]
  ): Promise<Post[]> {
    // キャラクター選択（ビジネスロジック）
    const characters = await this.characterSelector.selectCharacters(
      userPost.content,
      threadHistory,
      2,
      5
    );

    const generatedPosts: Post[] = [];

    // 各キャラクターごとにレス生成
    for (const character of characters) {
      const content = await this.generateIndividual(
        character,
        threadHistory,
        userPost
      );

      // データレイヤー経由で保存（OK）
      const post = await this.postManager.createPost({
        threadId,
        content,
        characterId: character.id,
        isUserPost: false,
      });

      generatedPosts.push(post);
    }

    return generatedPosts;
  }
}
```

#### データレイヤー

- **責務**: データの永続化、外部APIへのアクセス
- **許可される操作**: PostgreSQL、Ollama APIへのアクセス
- **禁止される操作**: ビジネスロジックの実装、Webレイヤーへの依存

**実装例**:

```typescript
// lib/db.ts
class DatabaseClient {
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    // パラメータ化クエリによるSQLインジェクション対策
    return this.pool.query(sql, params);
  }
}

// services/postManager.ts
class PostManager {
  async createPost(data: CreatePostData): Promise<Post> {
    const nextPostNumber = await this.getNextPostNumber(data.threadId);

    // データレイヤー経由でクエリ実行（OK）
    const result = await this.db.query(
      `INSERT INTO posts (thread_id, post_number, author_name, character_id, content, is_user_post)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.threadId,
        nextPostNumber,
        data.authorName || '名無しさん',
        data.characterId || null,
        data.content,
        data.isUserPost,
      ]
    );

    return this.mapRowToPost(result.rows[0]);
  }
}
```

## データ永続化戦略

### ストレージ方式

| データ種別         | ストレージ         | フォーマット           | 理由                                                                                     |
| ------------------ | ------------------ | ---------------------- | ---------------------------------------------------------------------------------------- |
| スレッド・レス     | PostgreSQL         | リレーショナルテーブル | ACID準拠による整合性保証、外部キー制約、インデックスによる高速検索、トランザクション対応 |
| ペルソナ定義       | TypeScriptファイル | TypeScriptオブジェクト | コード内定義により型安全性確保、デプロイ時にビルド済み、実行時の読み込みが高速           |
| Ollamaモデルデータ | Dockerボリューム   | バイナリ               | モデルファイル（数GB）の永続化、コンテナ再起動時の再ダウンロード回避、ディスク効率化     |
| 環境設定           | .envファイル       | KEY=VALUE形式          | 機密情報の分離、環境ごとの設定切り替え、Gitコミット対象外                                |

### データベーススキーマ設計

**threads テーブル**:

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

**posts テーブル**:

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

**設計の意図**:

- **UUID型の使用**: 分散システムでもIDの衝突が発生しない、URLに埋め込み可能
- **ON DELETE CASCADE**: スレッド削除時に関連レスも自動削除（参照整合性の保証）
- **CHECK制約**: データベースレベルでバリデーション（content長さ制限）
- **UNIQUE制約**: (thread_id, post_number)の組み合わせで重複防止
- **インデックス設計**: 頻出クエリパターン（スレッド一覧、レス取得）を最適化

### バックアップ戦略

- **頻度**: 1日1回（深夜バッチ、将来実装）
- **保存先**: ホストマシンの`.backup/`ディレクトリ（Dockerボリュームの外部）
- **方法**: `pg_dump`によるSQLダンプ（全データベース）
- **世代管理**: 最新7日分を保持（8日目以降は自動削除）
- **復元方法**:
  1. `docker-compose down`でサービス停止
  2. `docker volume rm llm-persona-sandbox_db-data`でボリューム削除
  3. `docker-compose up -d db`でDB起動
  4. `docker exec -i db psql -U postgres llm_persona_sandbox < backup.sql`で復元
  5. `docker-compose up -d`で全サービス起動

**バックアップコマンド例**:

```bash
# ホストマシンで実行
docker exec db pg_dump -U postgres llm_persona_sandbox > .backup/backup_$(date +%Y%m%d).sql

# 7日以前のバックアップを削除
find .backup/ -name "backup_*.sql" -mtime +7 -delete
```

## パフォーマンス要件

### レスポンスタイム

| 操作                | 目標時間  | 測定環境                                    | 測定方法                         |
| ------------------- | --------- | ------------------------------------------- | -------------------------------- |
| ユーザーレス投稿    | 200ms以内 | CPU: 4コア、メモリ: 8GB、SSD                | console.timeでDB保存まで計測     |
| AIレス生成（3-5体） | 10秒以内  | llama3.1:8b、CPU推論                        | 全キャラクターのレス生成完了まで |
| AIレス生成（3-5体） | 3秒以内   | llama3.1:8b、GPU推論（NVIDIA GTX 1660以上） | 全キャラクターのレス生成完了まで |
| スレッド一覧表示    | 500ms以内 | 100スレッド、CPU: 4コア                     | HTTPリクエスト〜HTMLレスポンス   |
| スレッド詳細表示    | 1秒以内   | 1000レス、CPU: 4コア                        | HTTPリクエスト〜HTMLレスポンス   |
| データベースクエリ  | 50ms以内  | PostgreSQL、1000レスまで                    | pg.query()のログ出力             |
| Ollama API呼び出し  | 5秒以内   | llama3.1:8b、CPU推論、200トークン生成       | fetch()のログ出力                |

**測定基準の詳細**:

- **測定環境**: 標準的な開発環境（CPU: Intel Core i5/AMD Ryzen 5相当、メモリ: 8GB、SSD）
- **目標値の根拠**:
  - ユーザーレス投稿: 体感的に「即座」と感じられる200ms
  - AIレス生成: YouTubeの2chまとめ動画制作で許容される実用範囲（10秒）
  - ページ表示: Webサイトの標準的なUX指標（Core Web Vitals参考）
- **GPU推論**: 本番環境でGPU搭載VPSを使用する場合、3秒以内が目標

### リソース使用量

| リソース                | 上限  | 理由                                                                             |
| ----------------------- | ----- | -------------------------------------------------------------------------------- |
| アプリメモリ（app）     | 512MB | Node.jsアプリケーションの平均的な使用量、HonoとJSXは軽量                         |
| DBメモリ（db）          | 256MB | PostgreSQL、1000スレッド・10000レスまでは256MBで十分                             |
| Ollamaメモリ（ollama）  | 8GB   | llama3.1:8bモデルのロード（5GB）+ 推論時のメモリ（3GB）                          |
| ディスク（ollama-data） | 10GB  | llama3.1:8bモデルファイル（4.7GB）+ llama3.1:70bモデルファイル（40GB）の予備領域 |
| ディスク（db-data）     | 1GB   | 1000スレッド・10000レスで約100MB、余裕を持って1GB                                |

**docker-compose.ymlでのリソース制限例**:

```yaml
services:
  app:
    mem_limit: 512m
  db:
    mem_limit: 256m
  ollama:
    mem_limit: 8g
```

### パフォーマンス最適化戦略

1. **データベースクエリ最適化**
   - スレッド一覧: `LIMIT 50` + `ORDER BY last_post_at DESC` + インデックス
   - レス取得: `WHERE thread_id = $1 ORDER BY post_number` + インデックス
   - 事前に測定: `EXPLAIN ANALYZE`でクエリプランを確認

2. **AIレス生成の非同期処理**
   - ユーザーレス保存後、即座にHTTPレスポンスを返す
   - AIレス生成はバックグラウンドで実行（`Promise.all()`による並列実行）
   - ユーザー体験を損なわない設計

3. **スレッド履歴の制限**
   - LLMに送信する履歴を最新20件に制限（トークン数削減）
   - 古いレスは要約または省略（将来実装）

4. **Ollamaモデルのプリロード**
   - `docker-compose up`時に`ollama run llama3.1:8b`を自動実行
   - 初回リクエスト時のモデルロード時間（10-30秒）を回避

## セキュリティアーキテクチャ

### データ保護

- **環境変数の管理**:
  - `.env`ファイルに機密情報（DATABASE_URL、OLLAMA_BASE_URL等）を記載
  - `.gitignore`で`.env`を除外し、Gitコミット対象外とする
  - `.env.example`をリポジトリに含め、必要な環境変数を明示

- **コンテナ間通信の制限**:
  - OllamaとPostgreSQLはDocker内部ネットワークのみでアクセス可能
  - ホストにポート公開しない（外部からの直接アクセス不可）
  - appコンテナのみポート3000を公開

- **ファイルパーミッション**:
  - `.env`ファイル: `chmod 600`（所有者のみ読み書き可能）
  - Dockerボリューム: Dockerデーモンのみアクセス可能

### 入力検証

- **バリデーション**: Zodによる厳格なスキーマ検証

  ```typescript
  const threadSchema = z.object({
    title: z.string().min(1).max(100),
    content: z.string().min(1).max(2000),
  });

  const postSchema = z.object({
    content: z.string().min(1).max(2000),
  });
  ```

- **サニタイゼーション**: Hono JSXのデフォルトエスケープ機能
  - `<div>{userContent}</div>` → 自動的にHTMLエスケープ
  - `<script>`タグ、`<img onerror=...>`等のXSS攻撃を無効化

- **SQLインジェクション対策**: パラメータ化クエリ

  ```typescript
  // 安全な実装（OK）
  await db.query('SELECT * FROM posts WHERE thread_id = $1', [threadId]);

  // 危険な実装（NG）- 決して使用しない
  await db.query(`SELECT * FROM posts WHERE thread_id = '${threadId}'`);
  ```

### エラーハンドリング

- **セキュアなエラー表示**:
  - ユーザー向け: 「サーバーエラーが発生しました」（詳細を隠蔽）
  - ログ: 詳細なエラー情報（スタックトレース、SQL文等）を記録
  - 本番環境: スタックトレースをユーザーに表示しない

- **エラーログの管理**:
  ```typescript
  app.onError((err, c) => {
    console.error('[ERROR]', err.message, err.stack); // ログ記録
    return c.text('サーバーエラーが発生しました', 500); // ユーザー向けメッセージ
  });
  ```

## スケーラビリティ設計

### データ増加への対応

- **想定データ量**:
  - スレッド数: 1000件（検証段階）
  - レス数: 10000件（1スレッドあたり平均10レス）
  - データベースサイズ: 約100MB

- **パフォーマンス劣化対策**:
  - インデックスによる検索速度維持（スレッド一覧、レス取得）
  - LIMITによるページネーション（スレッド一覧は最大50件表示）
  - 古いスレッドのアーカイブ（将来実装）

- **アーカイブ戦略**:
  - 最終レス日時が6ヶ月以上前のスレッドを別テーブル（archived_threads）に移動
  - 通常検索から除外し、「アーカイブから検索」機能で閲覧可能（将来実装）

### 機能拡張性

- **プラグインシステム**:
  - 現時点では実装しない
  - 将来的にペルソナ定義をプラグインとして追加可能な設計を検討

- **設定のカスタマイズ**:
  - 環境変数による設定切り替え
    - `OLLAMA_MODEL`: llama3.1:8b（デフォルト）/ llama3.1:70b
    - `USE_BATCH_GENERATION`: true（バッチ生成）/ false（個別生成）
    - `USE_SMART_SELECTION`: true（LLM判定）/ false（キーワードマッチング）
  - ペルソナ定義ファイル（personas.ts）の編集による新キャラクター追加

- **API拡張性**:
  - 現時点ではREST APIのみ実装
  - 将来的にWebSocket（リアルタイムレス表示）やGraphQL（複雑なクエリ）の追加を検討

### スケールアウト戦略（将来実装）

- **Ollamaサーバーの水平スケール**:
  - Nginx等のリバースプロキシでOllamaサーバーを負荷分散
  - 複数のOllamaコンテナを起動し、ラウンドロビンでリクエスト振り分け

- **データベースのレプリケーション**:
  - PostgreSQLのストリーミングレプリケーション
  - マスター（書き込み）+ スレーブ（読み込み専用）構成

## テスト戦略

### 手動テスト（MVP段階）

- **対象**: コア機能のエンドツーエンドテスト
- **方法**:
  1. `docker-compose up -d`で環境起動
  2. ブラウザで`http://localhost:3000`にアクセス
  3. スレッド作成 → ユーザー投稿 → AIレス生成の一連フローを確認
  4. データベースの内容を`docker exec -it db psql`で確認

- **テストケース**:
  - スレッド作成（タイトル・本文入力、作成後リダイレクト）
  - ユーザーレス投稿（投稿後即座にページ表示、AIレス生成開始）
  - AIレス生成（3-5体のキャラクター、口調の一致、アンカーの自然さ）
  - キャラクター選択（キーワードに応じた反応、ランダム性）
  - エラーハンドリング（Ollama停止時、DB接続失敗時）

### 統合テスト（将来実装）

- **フレームワーク**: Vitest（高速、TypeScript対応）
- **対象**:
  - OllamaClient: Ollama APIへのリクエスト・レスポンス処理
  - DatabaseClient: PostgreSQLへのクエリ実行
  - CharacterSelector: キーワードマッチングロジック

- **モック戦略**:
  - Ollama APIをモック化（MSW等）し、ネットワーク依存を排除
  - PostgreSQLはTestcontainersで実際のDBを起動（インテグレーションテスト）

### E2Eテスト（将来実装）

- **ツール**: Playwright（ブラウザ自動化）
- **シナリオ**:
  1. スレッド作成フォームに入力 → 送信
  2. スレッド詳細ページにリダイレクト
  3. 10秒待機（AIレス生成完了まで）
  4. ページに3-5件のAIレスが表示されることを確認
  5. 各レスの投稿者名が「マジレスニキ」「煽りカス」等であることを確認

## 技術的制約

### 環境要件

- **OS**: Linux（Ubuntu 22.04推奨）、macOS（Docker Desktop）、Windows（WSL2 + Docker Desktop）
- **最小メモリ**:
  - CPU推論: 16GB（Ollama 8GB + PostgreSQL 256MB + Node.js 512MB + OS 7GB）
  - GPU推論: 12GB（GPU VRAMは別途8GB以上）
- **必要ディスク容量**: 20GB（Ollamaモデル 10GB + PostgreSQL 1GB + Docker イメージ 5GB + その他 4GB）
- **必要な外部依存**:
  - Docker Engine 24.x以上
  - Docker Compose 2.x以上
  - （GPU推論の場合）NVIDIA Docker Runtime

### パフォーマンス制約

- **CPU推論時のレスポンスタイム**: llama3.1:8bで1キャラクターあたり2-3秒、3-5キャラクターで10秒程度
- **GPU推論時のレスポンスタイム**: llama3.1:8bで1キャラクターあたり0.5-1秒、3-5キャラクターで3秒程度
- **モデル切り替えのオーバーヘッド**: llama3.1:8bからllama3.1:70bへの切り替えで10-30秒のロード時間
- **同時接続数の制限**: 検証段階では1-5ユーザー、Node.jsの非同期処理で理論上は数百並行可能

### セキュリティ制約

- **認証機能なし**: 誰でもアクセス可能（検証段階のため）
- **HTTPS非対応**: HTTP通信のみ（本番環境ではNginx等でHTTPS終端を推奨）
- **レート制限なし**: DDoS攻撃への対策なし（将来実装予定）

## 依存関係管理

| ライブラリ        | 用途                   | バージョン管理方針 | 理由                                                       |
| ----------------- | ---------------------- | ------------------ | ---------------------------------------------------------- |
| hono              | Webフレームワーク      | ^4.x               | マイナーバージョンアップは互換性維持、破壊的変更は少ない   |
| @hono/node-server | Node.jsアダプター      | ^1.x               | Honoのバージョンと連動、マイナーバージョンアップで自動更新 |
| zod               | バリデーション         | ^3.x               | 安定版、破壊的変更のリスク低い                             |
| pg                | PostgreSQLクライアント | ^8.x               | 長期安定版、PostgreSQL 17.xとの互換性維持                  |
| typescript        | 言語                   | ~5.3.0             | パッチバージョンのみ自動更新、メジャー・マイナーは手動更新 |
| tsx               | TypeScript実行         | ^4.x               | 開発用ツール、破壊的変更の影響少ない                       |
| eslint            | 静的解析               | ^9.x               | 開発用ツール、最新版を追従                                 |
| prettier          | フォーマッター         | ^3.x               | 開発用ツール、最新版を追従                                 |

**バージョン管理方針の詳細**:

- **^（キャレット）**: マイナーバージョンとパッチバージョンを自動更新
  - 例: `^4.0.0` → 4.0.1, 4.1.0は自動、5.0.0は手動
- **~（チルダ）**: パッチバージョンのみ自動更新
  - 例: `~5.3.0` → 5.3.1は自動、5.4.0は手動
- **固定バージョン**: 破壊的変更のリスクが高い場合は完全固定

**依存関係の更新戦略**:

1. `npm outdated`で更新可能なパッケージを確認
2. マイナーバージョンアップは`npm update`で自動更新
3. メジャーバージョンアップは手動で`package.json`を編集し、`npm install`
4. 更新後は手動テストで動作確認（自動テストがない場合）

## デプロイメント戦略

### 開発環境

```bash
# 環境構築
git clone <repository>
cd llm-persona-sandbox
cp .env.example .env
docker-compose up -d

# データベース初期化
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql

# Ollamaモデルプリロード
docker exec ollama ollama run llama3.1:8b

# アプリケーション起動確認
curl http://localhost:3000
```

### 本番環境（VPS）

```bash
# サーバー構築
ssh user@vps-server
sudo apt update && sudo apt install docker.io docker-compose

# リポジトリクローン
git clone <repository>
cd llm-persona-sandbox

# 本番用環境変数設定
cp .env.example .env
nano .env  # DATABASE_URLやOLLAMA_BASE_URLを設定

# デプロイ
docker-compose up -d

# データベース初期化
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql

# Ollamaモデルプリロード
docker exec ollama ollama run llama3.1:8b

# Nginxリバースプロキシ設定（オプション）
sudo nano /etc/nginx/sites-available/llm-persona-sandbox
# proxy_pass http://localhost:3000;
sudo systemctl reload nginx
```

### CI/CD（将来実装）

- **GitHub Actions**: `git push`時に自動でESLint、Prettier、Vitestを実行
- **自動デプロイ**: mainブランチへのマージで本番サーバーに自動デプロイ
- **ロールバック**: 直前のDockerイメージタグに戻す

## 監視・ログ戦略

### ログ出力

- **フォーマット**:

  ```
  [2025-01-15T14:32:18.123Z] [INFO] ThreadManager: Thread created (id: abc123-def456)
  [2025-01-15T14:32:20.456Z] [ERROR] OllamaClient: Connection failed to http://ollama:11434
  ```

- **ログレベル**:
  - ERROR: システムエラー（DB接続失敗、Ollama接続失敗等）
  - WARN: 一時的なエラー（LLMタイムアウト、キャラクター選択失敗等）
  - INFO: 正常動作（スレッド作成、レス投稿等）

- **ログ確認方法**:
  ```bash
  docker-compose logs -f app      # アプリケーションログ
  docker-compose logs -f db       # PostgreSQLログ
  docker-compose logs -f ollama   # Ollamaログ
  ```

### 監視項目（将来実装）

- **サーバーメトリクス**: CPU使用率、メモリ使用率、ディスク使用率
- **アプリケーションメトリクス**: リクエスト数、レスポンスタイム、エラー率
- **データベースメトリクス**: クエリ実行時間、コネクション数、デッドロック
- **Ollamaメトリクス**: API呼び出し回数、トークン数、生成時間

## まとめ

本アーキテクチャ設計書では、LLM Persona Sandboxの技術的な実現方法を詳述しました。

**主要な設計判断**:

1. **Hono + TypeScript**: 軽量・高速・型安全なWebアプリケーション基盤
2. **Ollama + Docker Compose**: コストゼロのローカルLLM運用、開発・本番環境の完全一致
3. **PostgreSQL**: ACID準拠の信頼性、UUID・インデックスによる最適化
4. **レイヤードアーキテクチャ**: 責務の明確化、保守性の向上、テストの容易性

**次のステップ**:

1. リポジトリ構造の定義（`docs/repository-structure.md`）
2. 開発ガイドラインの作成（`docs/development-guidelines.md`）
3. 実装開始（Docker環境構築、データベーススキーマ作成、コア機能実装）
