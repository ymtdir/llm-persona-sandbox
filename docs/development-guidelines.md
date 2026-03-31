# 開発ガイドライン (Development Guidelines)

## 概要

LLM Persona Sandboxの開発における規約とプロセス。

**関連ドキュメント**:
- [リポジトリ構造](./repository-structure.md) - ファイル配置規則
- [アーキテクチャ設計書](./architecture.md) - 技術スタック
- [デプロイメントガイド](./deployment-guide.md) - 環境構築

## コーディング規約

### 命名規則

#### 変数・関数

```typescript
// ✅ 良い例
const threadHistory = await postManager.getRecentPosts(threadId, 20);
function calculateKeywordScore(userPost: string, character: Character): number {}
const isUserPost = true;

// ❌ 悪い例
const data = await manager.get(id, 20);
function calc(str: string, obj: any): number {}
const flag = true;
```

**原則**:
- 変数: camelCase、名詞または名詞句
- 関数: camelCase、動詞で始める
- 定数: UPPER_SNAKE_CASE
- Boolean: `is`, `has`, `should`で始める

#### クラス・インターフェース

```typescript
// クラス: PascalCase、名詞
class ThreadManager {}
class ResponseGenerator {}

// インターフェース: PascalCase
interface Thread { id: string; title: string; }
interface CreatePostData { threadId: string; content: string; }

// 型エイリアス: PascalCase
type TaskStatus = 'pending' | 'in_progress' | 'completed';
```

#### ファイル名

| ファイル種別         | 命名規則       | 例                    |
| -------------------- | -------------- | --------------------- |
| ルート定義           | kebab-case.tsx | threads.tsx           |
| サービスクラス       | camelCase.ts   | threadManager.ts      |
| ビューコンポーネント | PascalCase.tsx | ThreadList.tsx        |
| 型定義               | index.ts       | index.ts              |
| 定数・設定           | camelCase.ts   | personas.ts, utils.ts |

**詳細**: [リポジトリ構造](./repository-structure.md#命名規則)

### コードフォーマット

- **インデント**: 2スペース
- **行の長さ**: 最大100文字（推奨）
- **ツール**: Prettier

**Prettier設定例**:
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### コメント規約

**関数・クラスのドキュメント**:

```typescript
/**
 * スレッドの過去レスを2ch風テキスト形式にフォーマット
 *
 * @param posts - フォーマット対象のレス配列（最大20件を推奨）
 * @returns 2ch風フォーマット文字列（例: "1: 名無しさん: 内容"）
 */
function formatThreadHistory(posts: Post[]): string {
  return posts
    .map((post) => `${post.postNumber}: ${post.authorName}: ${post.content}`)
    .join('\n');
}
```

**インラインコメント**:

```typescript
// ✅ 良い例: なぜそうするかを説明
// スレッド履歴を最新20件に制限（トークン数削減のため）
const history = await postManager.getRecentPosts(threadId, 20);

// ❌ 悪い例: 何をしているか（コードを見れば分かる）
// 履歴を取得する
const history = await postManager.getRecentPosts(threadId, 20);
```

### エラーハンドリング

**原則**:
- 予期されるエラー: 適切なエラークラスを定義
- 予期しないエラー: 上位に伝播し、ログに記録
- エラーを無視しない（`catch`でreturn nullは禁止）

**カスタムエラークラス例**:

```typescript
export class ValidationError extends Error {
  constructor(message: string, public field: string, public value: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(public resource: string, public id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}
```

**エラーハンドリングパターン**:

```typescript
// ✅ 良い例
async function getThread(id: string): Promise<Thread> {
  try {
    const result = await db.query('SELECT * FROM threads WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Thread', id);
    }
    return mapRowToThread(result.rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new DatabaseError('スレッド取得失敗', 'SELECT ...', error as Error);
  }
}
```

### セキュリティ

**SQLインジェクション対策**:

```typescript
// ✅ 良い例: パラメータ化クエリ
await db.query('SELECT * FROM threads WHERE id = $1', [threadId]);

// ❌ 悪い例: 文字列結合（決して使用しない）
await db.query(`SELECT * FROM threads WHERE id = '${threadId}'`);
```

**XSS対策**:

```typescript
// Hono JSXはデフォルトでエスケープする
<div>{userContent}</div>  // <script>タグ等が無害化される
```

**環境変数の管理**:

```typescript
// ✅ 良い例: 環境変数から読み込み
const dbUrl = process.env.DATABASE_URL;

// ❌ 悪い例: ハードコード
const dbUrl = 'postgresql://postgres:password@localhost:5432/db';
```

### パフォーマンス

**データベースクエリ最適化**:

```typescript
// ✅ 良い例: LIMIT句で件数制限
const threads = await db.query(
  'SELECT * FROM threads ORDER BY last_post_at DESC LIMIT 50'
);

// ❌ 悪い例: 全件取得後にJavaScriptでフィルタリング
const allThreads = await db.query('SELECT * FROM threads');
const filteredThreads = allThreads.slice(0, 50);
```

**非同期処理の最適化**:

```typescript
// ✅ 良い例: 並列実行
const [thread, posts] = await Promise.all([
  threadManager.getThread(threadId),
  postManager.getPostsByThread(threadId),
]);

// ❌ 悪い例: 逐次実行
const thread = await threadManager.getThread(threadId);
const posts = await postManager.getPostsByThread(threadId);
```

## Git運用ルール

### ブランチ戦略（Git Flow）

**ブランチ構成**:

```
main (本番環境)
└── develop (開発・統合環境)
    ├── feature/* (新機能開発)
    ├── fix/* (バグ修正)
    └── refactor/* (リファクタリング)
```

**ブランチ種別**:

| ブランチ           | 用途                       | 派生元  | マージ先 |
| ------------------ | -------------------------- | ------- | -------- |
| `main`             | 本番リリース済みコード     | -       | -        |
| `develop`          | 次期リリース向け開発コード | main    | main     |
| `feature/[機能名]` | 新機能開発                 | develop | develop  |
| `fix/[修正内容]`   | バグ修正                   | develop | develop  |
| `refactor/[対象]`  | リファクタリング           | develop | develop  |

**命名規則**:

```bash
feature/character-selection
feature/batch-generation
fix/ollama-timeout
fix/xss-vulnerability
refactor/response-generator
```

**運用ルール**:
- mainとdevelopへの直接コミット禁止（PRレビュー必須）
- feature→develop は squash merge
- develop→main は merge commit

**作業フロー**:

```bash
# 1. developから新ブランチ作成
git checkout develop
git pull origin develop
git checkout -b feature/character-selection

# 2. 開発作業
git add .
git commit -m "feat(character): キーワードマッチングロジック実装"

# 3. developに追従（必要に応じて）
git fetch origin
git rebase origin/develop

# 4. リモートにプッシュ
git push origin feature/character-selection

# 5. GitHubでPR作成（develop <- feature/character-selection）
```

### コミットメッセージ規約

**Conventional Commits採用**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type一覧**:

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コードフォーマット（機能変更なし）
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テスト追加・修正
- `chore`: その他（依存関係更新等）

**Scope例**:

- `character`: キャラクター選択・管理
- `thread`: スレッド管理
- `post`: レス管理
- `ollama`: Ollama API連携
- `db`: データベース関連

**良い例**:

```
feat(character): キーワードマッチング方式のキャラクター選択実装

投稿内容のキーワードに基づいてキャラクターを選択する機能を実装。

実装内容:
- CharacterSelectorクラスにselectByKeywords()メソッド追加
- キーワードスコア（70%）と発言頻度スコア（30%）の加重平均で総合スコア算出
- 総合スコア30点以上のキャラクターを「関心あり」として抽出

Refs #15
```

**悪い例**:

```
update code
fix bug
WIP
いろいろ修正
```

### プルリクエストプロセス

**作成前のチェック**:
- [ ] 機能が正常に動作する（手動テスト実施）
- [ ] ESLintエラーがない（`npm run lint`）
- [ ] 型チェックがパス（`npm run type-check`）
- [ ] developブランチと競合が解決されている

**PRテンプレート**:

```markdown
## 概要
キーワードマッチング方式のキャラクター選択機能を実装しました。

## 変更理由
ユーザー投稿内容に応じて適切なキャラクターが反応するようにするため。

## 変更内容
- CharacterSelectorクラスにselectByKeywords()メソッドを追加
- キーワードスコアと発言頻度スコアの加重平均で総合スコアを算出

## テスト
- [x] 手動テスト実施
  - 「プログラミング」というキーワードで投稿 → マジレスニキが反応

## 関連Issue
Refs #15
```

**レビュープロセス**:
1. セルフレビュー
2. 自動チェック（ESLint、型チェック）
3. レビュアーアサイン
4. レビューフィードバック対応
5. 承認後マージ

## テスト戦略

### MVP段階の方針

**現状**: 手動テスト中心（自動テストは将来実装）

**理由**: 検証段階のため、まずは機能の実装を優先

### 手動テストチェックリスト

**スレッド作成**:
- [ ] スレッドタイトルと初回投稿を入力し、作成できる
- [ ] 作成後、スレッド詳細ページにリダイレクトされる
- [ ] スレッド一覧に新規スレッドが表示される

**ユーザー投稿**:
- [ ] レスを投稿できる
- [ ] 投稿後、即座にスレッド詳細ページに戻る
- [ ] データベースにユーザーレス（isUserPost=true）が保存されている

**AIレス生成**:
- [ ] ユーザー投稿後、3-5体のAIキャラクターがレスを生成する
- [ ] 各キャラクターの口調が一致している
- [ ] アンカー（>>1等）が自然に含まれている

**詳細**: [機能設計書](./functional-design.md#テスト戦略)

### 将来的なテスト戦略

**テストピラミッド**:

```
       /\
      /E2E\       少（遅い、高コスト）
     /------\
    / 統合   \     中
   /----------\
  / ユニット   \   多（速い、低コスト）
 /--------------\
```

**目標比率**: ユニット70%、統合20%、E2E10%

## コードレビュー基準

**レビューポイント**:

**機能性**:
- [ ] PRDの要件を満たしているか
- [ ] エッジケースが考慮されているか
- [ ] エラーハンドリングが適切か

**可読性**:
- [ ] 命名が明確か
- [ ] コメントが適切か
- [ ] 複雑なロジックが説明されているか

**保守性**:
- [ ] 重複コードがないか
- [ ] 責務が明確に分離されているか
- [ ] 変更の影響範囲が限定的か

**パフォーマンス**:
- [ ] 不要な計算がないか
- [ ] データベースクエリが最適化されているか
- [ ] AIレス生成が非同期化されているか

**セキュリティ**:
- [ ] SQLインジェクション対策が適切か
- [ ] XSS対策が適切か
- [ ] 環境変数が適切に管理されているか

**レビューコメントの書き方**:

```markdown
## ✅ 良い例
この実装だと、スレッド数が1000件を超えた時にパフォーマンスが劣化する可能性があります。
代わりに、LIMIT句でページネーションを実装してはどうでしょうか？
```

```markdown
## ❌ 悪い例
この書き方は良くないです。
```

**優先度の明示**:
- `[必須]`: 修正必須（セキュリティ脆弱性、バグ等）
- `[推奨]`: 修正推奨（パフォーマンス改善、可読性向上等）
- `[提案]`: 検討してほしい（代替案の提示）
- `[質問]`: 理解のための質問

## 開発環境セットアップ

**詳細手順**: [デプロイメントガイド](./deployment-guide.md#開発環境セットアップ)

**概要**:

```bash
git clone <repository>
cd llm-persona-sandbox
cp .env.example .env
docker-compose up -d
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql
docker exec ollama ollama run llama3.1:8b
```

**推奨エディタ設定（VS Code）**:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

**推奨拡張機能**:
- ESLint
- Prettier - Code formatter
- Docker

## まとめ

**主要なポイント**:

1. **命名規則の統一**: camelCase/PascalCase/kebab-caseの使い分け
2. **エラーハンドリングの徹底**: カスタムエラークラス、適切な例外処理
3. **Git Flow採用**: main（本番）← develop ← feature/fix（開発）
4. **Conventional Commits**: 一貫性のあるコミットメッセージ
5. **手動テスト中心（MVP段階）**: 将来的に自動テストへ移行
6. **コードレビューの重要性**: 建設的なフィードバックで品質向上

## 関連ドキュメント

- [リポジトリ構造](./repository-structure.md) - ファイル配置規則
- [アーキテクチャ設計書](./architecture.md) - 技術スタック
- [機能設計書](./functional-design.md) - テスト戦略
- [デプロイメントガイド](./deployment-guide.md) - 環境構築
