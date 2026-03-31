# リポジトリ構造定義書 (Repository Structure Document)

## 概要

LLM Persona Sandboxのディレクトリ構造とファイル配置規則。

**関連ドキュメント**:
- [アーキテクチャ設計書](./architecture.md) - レイヤードアーキテクチャ
- [開発ガイドライン](./development-guidelines.md) - 開発規約

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
│   ├── glossary.md
│   ├── data-models.md
│   ├── api-specifications.md
│   └── deployment-guide.md
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
- `threads.tsx`: スレッド関連エンドポイント

**命名規則**: `[リソース名の複数形].tsx`

**依存関係**:
- 依存可能: `services/`, `types/`, `views/`
- 依存禁止: `lib/`（直接アクセス禁止）

#### services/

**役割**: サービスレイヤー - ビジネスロジック、データ変換、トランザクション制御

**配置ファイル**:
- `threadManager.ts`: スレッドのCRUD操作
- `postManager.ts`: レスのCRUD操作
- `responseGenerator.ts`: AIレス生成統括
- `characterSelector.ts`: キャラクター選択
- `ollamaClient.ts`: Ollama API呼び出し

**命名規則**: `camelCase.ts`、クラス名は `PascalCase`

**依存関係**:
- 依存可能: `lib/`, `types/`
- 依存禁止: `routes/`, `views/`

#### lib/

**役割**: データレイヤー - データ永続化、外部APIアクセス、共通ユーティリティ

**配置ファイル**:
- `db.ts`: PostgreSQL接続とクエリ実行
- `personas.ts`: ペルソナ（キャラクター）定義
- `utils.ts`: 汎用ユーティリティ関数

**命名規則**: `camelCase.ts`

**依存関係**:
- 依存可能: `types/`, `node-postgres`, `fetch API`
- 依存禁止: `routes/`, `services/`, `views/`

#### views/

**役割**: Hono JSXビュー - HTML生成、2ch風UIのレンダリング

**配置ファイル**:
- `Layout.tsx`: 共通レイアウト
- `ThreadList.tsx`: スレッド一覧ビュー
- `ThreadDetail.tsx`: スレッド詳細ビュー

**命名規則**: `PascalCase.tsx`

**依存関係**:
- 依存可能: `types/`
- 依存禁止: `routes/`, `services/`, `lib/`

#### types/

**役割**: TypeScript型定義の集約

**配置ファイル**: `index.ts`

**命名規則**: 型名は `PascalCase`

**依存関係**: なし（型定義は依存を持たない）

**型定義例**:
```typescript
export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  lastPostAt: Date;
  postCount: number;
}
```

**詳細**: [データモデル定義書](./data-models.md)

#### index.tsx

**役割**: アプリケーションエントリーポイント - Honoアプリ初期化、ルート登録

### db/ (データベーススキーマディレクトリ)

**配置ファイル**: `schema.sql`

**用途**: PostgreSQLテーブル定義、インデックス定義

**詳細**: [データモデル定義書](./data-models.md#データベーススキーマ)

### docs/ (ドキュメントディレクトリ)

**配置ドキュメント**:
- `product-requirements.md`: プロダクト要求定義書
- `functional-design.md`: 機能設計書
- `architecture.md`: アーキテクチャ設計書
- `repository-structure.md`: リポジトリ構造定義書（本ドキュメント）
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: 用語集
- `data-models.md`: データモデル定義書
- `api-specifications.md`: API仕様書
- `deployment-guide.md`: デプロイメントガイド

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
| エントリーポイント   | src/      | index.tsx      | index.tsx        |

### 設定ファイル

| ファイル種別         | 配置先             | 例                 |
| -------------------- | ------------------ | ------------------ |
| Docker Compose設定   | プロジェクトルート | docker-compose.yml |
| Dockerfile           | プロジェクトルート | Dockerfile         |
| TypeScript設定       | プロジェクトルート | tsconfig.json      |
| npm依存関係          | プロジェクトルート | package.json       |
| 環境変数             | プロジェクトルート | .env               |
| Git除外設定          | プロジェクトルート | .gitignore         |

## 命名規則

### ディレクトリ名

- **レイヤーディレクトリ**: 複数形、kebab-case
  - 例: `routes/`, `services/`, `views/`

### ファイル名

- **ルート定義**: kebab-case.tsx（リソース名の複数形）
  - 例: `threads.tsx`
- **サービスクラス**: camelCase.ts
  - 例: `threadManager.ts`, `responseGenerator.ts`
- **ビューコンポーネント**: PascalCase.tsx
  - 例: `ThreadList.tsx`, `Layout.tsx`
- **型定義**: index.ts または PascalCase.ts
- **定数ファイル**: camelCase.ts
  - 例: `personas.ts`, `utils.ts`

### クラス名・関数名

- **クラス**: PascalCase
  - 例: `ThreadManager`, `ResponseGenerator`
- **関数**: camelCase、動詞で始める
  - 例: `createThread()`, `getCharacters()`
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

### 循環依存の禁止

```typescript
// ❌ 悪い例: 循環依存
// services/responseGenerator.ts
import { PostManager } from './postManager';

// services/postManager.ts
import { ResponseGenerator } from './responseGenerator'; // 循環依存
```

**解決策**: 依存関係を見直し、一方向の依存にする

## スケーリング戦略

### 機能追加時の配置

1. **小規模機能**: 既存ファイルに追加
2. **中規模機能**: 新しいファイルを作成（例: `services/searchService.ts`）
3. **大規模機能**: レイヤー内にサブディレクトリ作成（将来検討）

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
└── lib/
    ├── db.ts
    ├── personas.ts
    └── utils.ts
```

### ファイルサイズ管理

**分割の目安**:
- 1ファイル: 300行以下を推奨
- 300-500行: リファクタリング検討
- 500行以上: 分割を強く推奨

## 除外設定

### .gitignore

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

# OS固有
.DS_Store
Thumbs.db

# IDEファイル
.vscode/
.idea/
```

### .dockerignore

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

## 関連ドキュメント

- [アーキテクチャ設計書](./architecture.md) - レイヤードアーキテクチャ
- [機能設計書](./functional-design.md) - コンポーネント設計
- [開発ガイドライン](./development-guidelines.md) - 開発規約
- [データモデル定義書](./data-models.md) - データ構造
