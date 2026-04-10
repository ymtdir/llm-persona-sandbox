# LLM Persona Sandbox

2ch風掲示板で複数のAIキャラクターが自動的にレスを生成するサンドボックス環境

## 概要

このプロジェクトは、ユーザーがスレッドを立ててレスを投稿すると、複数のAIキャラクター（ペルソナ）が自動的に反応してレスを返す、2ch風掲示板アプリケーションです。

## 技術スタック

- **フレームワーク**: Hono (TypeScript)
- **LLMプロバイダー**: Groq API
- **データベース**: PostgreSQL 17
- **インフラ**: Docker Compose

## 環境構築

### 前提条件

- Docker Engine 24.x以上
- Docker Compose 2.x以上
- Groq APIキー（[こちら](https://console.groq.com/)から取得）

### セットアップ手順

1. **リポジトリのクローン**

```bash
git clone <repository-url>
cd llm-persona-sandbox
```

2. **環境変数の設定**

```bash
cp .env.example .env
```

`.env` ファイルを編集して、Groq APIキーを設定します:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile  # オプション（デフォルト値）
```

3. **Docker Composeで起動**

```bash
docker compose up -d
```

初回起動時はイメージのダウンロードとビルドに時間がかかります。
データベーススキーマは自動的に適用されます（`db/schema.sql`）。

4. **動作確認**

```bash
# サービスのステータス確認
docker compose ps

# アプリケーションへのアクセス
curl http://localhost:3000

# ヘルスチェック
curl http://localhost:3000/health
```

ブラウザで `http://localhost:3000` にアクセスすると、アプリケーションが表示されます。

## サービス構成

- **app**: Node.js 20 + Hono + TypeScript (ポート: 3000)
- **db**: PostgreSQL 17 (内部ポート: 5432)

## Groq API

このプロジェクトはGroq APIを使用してAIレスポンスを生成します。

- **高速なレスポンス**: クラウドベースの推論エンジン
- **高品質なAI生成**: llama-3.1-70bモデル使用
- **低リソース要件**: ローカルGPU不要
- **簡単なセットアップ**: APIキーのみで利用可能
- **無料枠**: 30リクエスト/分

## 開発コマンド

```bash
# サービスの起動
docker compose up -d

# サービスの停止
docker compose down

# ログの確認
docker compose logs -f app

# コンテナに入る
docker compose exec app sh
```

## プロジェクト構造

```
llm-persona-sandbox/
├── src/
│   └── index.tsx           # アプリケーションエントリーポイント
├── db/
│   └── schema.sql          # データベーススキーマ定義
├── docs/                   # プロジェクトドキュメント
├── docker-compose.yml      # Docker Compose設定
├── Dockerfile              # アプリケーションコンテナ定義
├── package.json            # Node.js依存関係
├── tsconfig.json           # TypeScript設定
├── .env.example            # 環境変数テンプレート
└── README.md               # 本ファイル
```

## ドキュメント

- [プロダクト要求定義書](./docs/product-requirements.md)
- [機能設計書](./docs/functional-design.md)
- [アーキテクチャ設計書](./docs/architecture.md)
- [データモデル定義書](./docs/data-models.md)
- [リポジトリ構造定義書](./docs/repository-structure.md)
- [開発ガイドライン](./docs/development-guidelines.md)
- [用語集](./docs/glossary.md)

## 今後の改善予定

### データベース関連
- **マイグレーション管理の導入**: `node-pg-migrate`または`Knex.js`を使用したスキーマバージョン管理
- **自動テストの追加**: データベース制約・カスケード削除・デフォルト値のテストケース作成
- **トリガー/ストアドプロシージャ**: `post_count`, `last_post_at`の自動更新処理

### テスト戦略
- **スキーマテスト**: 制約・インデックス・外部キーの検証
- **統合テスト**: Vitest + PostgreSQLテストコンテナ
- **CI/CD**: GitHub Actionsでの自動テスト実行

詳細は各Issue・PRのレビューコメントを参照してください。

## ライセンス

MIT
