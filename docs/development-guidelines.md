# 開発ガイドライン (Development Guidelines)

## コーディング規約

### 命名規則

#### 変数・関数

**TypeScript**:

```typescript
// ✅ 良い例: 明確で役割が分かる
const threadHistory = await postManager.getRecentPosts(threadId, 20);
function calculateKeywordScore(
  userPost: string,
  character: Character
): number {}
const isUserPost = true;

// ❌ 悪い例: 曖昧で意味不明
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
class DatabaseClient {}

// インターフェース: PascalCase
interface Thread {
  id: string;
  title: string;
}

interface CreatePostData {
  threadId: string;
  content: string;
  isUserPost: boolean;
}

// 型エイリアス: PascalCase
type TaskStatus = 'pending' | 'in_progress' | 'completed';
type CharacterId = string;
```

#### ファイル名

| ファイル種別         | 命名規則       | 例                    |
| -------------------- | -------------- | --------------------- |
| ルート定義           | kebab-case.tsx | threads.tsx           |
| サービスクラス       | camelCase.ts   | threadManager.ts      |
| ビューコンポーネント | PascalCase.tsx | ThreadList.tsx        |
| 型定義               | index.ts       | index.ts              |
| 定数・設定           | camelCase.ts   | personas.ts, utils.ts |

### コードフォーマット

**インデント**: 2スペース

**行の長さ**: 最大100文字（推奨）

**Prettier設定例**:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
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

/**
 * AIキャラクターによるレス生成を統括
 *
 * @param threadId - 対象スレッドID
 * @param userPost - ユーザーが投稿したレス
 * @param threadHistory - スレッド履歴（最新20件）
 * @returns 生成されたAIレスの配列
 * @throws {OllamaConnectionError} Ollama APIへの接続失敗時
 */
async function generateResponses(
  threadId: string,
  userPost: Post,
  threadHistory: Post[]
): Promise<Post[]> {
  // 実装
}
```

**インラインコメント**:

```typescript
// ✅ 良い例: なぜそうするかを説明
// スレッド履歴を最新20件に制限（トークン数削減のため）
const history = await postManager.getRecentPosts(threadId, 20);

// キーワードマッチスコアを70%、発言頻度スコアを30%の重みで計算
const totalScore = keywordScore * 0.7 + frequencyScore * 0.3;

// ❌ 悪い例: 何をしているか（コードを見れば分かる）
// 履歴を取得する
const history = await postManager.getRecentPosts(threadId, 20);

// スコアを計算する
const totalScore = keywordScore * 0.7 + frequencyScore * 0.3;
```

**TODOコメント**:

```typescript
// TODO: バッチ生成方式の実装（1回のAPI呼び出しで複数キャラクターのレス生成）
// FIXME: キャラクター選択がランダムすぎる（LLM判定方式の検討）
// NOTE: Ollama APIのタイムアウトは30秒に設定（llama3.1:8bの場合）
```

### エラーハンドリング

**原則**:

- 予期されるエラー: 適切なエラークラスを定義
- 予期しないエラー: 上位に伝播し、ログに記録
- エラーを無視しない（`catch`でreturn nullは禁止）

**カスタムエラークラス**:

```typescript
// lib/errors.ts
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(
    public resource: string,
    public id: string
  ) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class OllamaConnectionError extends Error {
  constructor(
    message: string,
    public baseUrl: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'OllamaConnectionError';
    this.cause = cause;
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public query: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = cause;
  }
}
```

**エラーハンドリングパターン**:

```typescript
// ✅ 良い例: 適切なエラーハンドリング
async function getThread(id: string): Promise<Thread> {
  try {
    const result = await db.query('SELECT * FROM threads WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Thread', id);
    }

    return mapRowToThread(result.rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) {
      // 予期されるエラー: そのまま上位に伝播
      throw error;
    }

    // 予期しないエラー: ラップして上位に伝播
    throw new DatabaseError(
      'スレッドの取得に失敗しました',
      'SELECT * FROM threads WHERE id = $1',
      error as Error
    );
  }
}

// ❌ 悪い例: エラーを無視
async function getThread(id: string): Promise<Thread | null> {
  try {
    const result = await db.query('SELECT * FROM threads WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    return null; // エラー情報が失われる
  }
}
```

**Honoでのエラーハンドリング**:

```typescript
// routes/threads.tsx
app.onError((err, c) => {
  console.error('[ERROR]', err.message, err.stack);

  if (err instanceof ValidationError) {
    return c.text(`バリデーションエラー: ${err.message}`, 400);
  }

  if (err instanceof NotFoundError) {
    return c.text('スレッドが見つかりません', 404);
  }

  if (err instanceof OllamaConnectionError) {
    return c.text('AIレス生成サービスに接続できません', 503);
  }

  // その他のエラー
  return c.text('サーバーエラーが発生しました', 500);
});
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
// ✅ 良い例: 自動的にエスケープ
<div>{userContent}</div>  // <script>タグ等が無害化される

// ❌ 悪い例: 生HTMLの挿入（特別な理由がない限り使用しない）
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

**環境変数の管理**:

```typescript
// .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/llm_persona_sandbox
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

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

// ✅ 良い例: インデックスを活用
const posts = await db.query(
  'SELECT * FROM posts WHERE thread_id = $1 ORDER BY post_number',
  [threadId]
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

**AIレス生成の非同期化**:

```typescript
// ✅ 良い例: ユーザーレス保存後、即座にレスポンス
app.post('/thread/:id/post', async (c) => {
  const userPost = await postManager.createPost({
    threadId,
    content,
    isUserPost: true,
  });

  // AIレス生成はバックグラウンドで実行（awaitしない）
  responseGenerator.generateResponses(threadId, userPost, history);

  return c.redirect(`/thread/${threadId}`);
});
```

## Git運用ルール

### ブランチ戦略（Git Flow）

**Git Flowとは**:
Vincent Driessenが提唱した、機能開発・リリース・ホットフィックスを体系的に管理するブランチモデル。明確な役割分担により、チーム開発での並行作業と安定したリリースを実現します。

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
# 機能開発
feature/character-selection
feature/batch-generation
feature/realtime-sse

# バグ修正
fix/ollama-timeout
fix/db-connection-leak
fix/xss-vulnerability

# リファクタリング
refactor/response-generator
refactor/database-queries
```

**運用ルール**:

- **main**: 本番リリース済みの安定版コードのみを保持。タグでバージョン管理
- **develop**: 次期リリースに向けた最新の開発コードを統合。CIでの自動テスト実施（将来実装）
- **feature/\*, fix/\***: developから分岐し、作業完了後にPRでdevelopへマージ
- **直接コミット禁止**: mainとdevelopへの直接コミットは禁止（PRレビューを必須とする）
- **マージ方針**: feature→develop は squash merge、develop→main は merge commit を推奨

**作業フロー**:

```bash
# 1. developから新ブランチを作成
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

# 5. GitHubでPRを作成（develop <- feature/character-selection）
```

### コミットメッセージ規約

**Conventional Commits採用**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type一覧**:

```
feat: 新機能 (minor version up)
fix: バグ修正 (patch version up)
docs: ドキュメント
style: コードフォーマット（機能変更なし）
refactor: リファクタリング
perf: パフォーマンス改善
test: テスト追加・修正
build: ビルドシステム
ci: CI/CD設定
chore: その他（依存関係更新等）

BREAKING CHANGE: 破壊的変更 (major version up)
```

**Scope例**:

```
character: キャラクター選択・管理
thread: スレッド管理
post: レス管理
ollama: Ollama API連携
db: データベース関連
ui: UI・ビュー関連
```

**良いコミットメッセージの例**:

```
feat(character): キーワードマッチング方式のキャラクター選択実装

投稿内容のキーワードに基づいてキャラクターを選択する機能を実装。

実装内容:
- CharacterSelectorクラスにselectByKeywords()メソッド追加
- キーワードスコア（70%）と発言頻度スコア（30%）の加重平均で総合スコア算出
- 総合スコア30点以上のキャラクターを「関心あり」として抽出
- 上位から2-5体をランダムに選択

Refs #15
```

```
fix(ollama): API接続タイムアウトを30秒に延長

llama3.1:8bモデルでのレス生成時、5秒のタイムアウトでは
頻繁にエラーが発生していた問題を修正。

変更内容:
- OllamaClientのタイムアウトを5秒→30秒に変更
- タイムアウト発生時のエラーメッセージを改善

Closes #42
```

**悪いコミットメッセージの例**:

```
❌ update code
❌ fix bug
❌ WIP
❌ いろいろ修正
```

### プルリクエストプロセス

**作成前のチェック**:

- [ ] 機能が正常に動作する（手動テスト実施）
- [ ] ESLintエラーがない（`npm run lint`）
- [ ] 型チェックがパス（`npm run type-check`）
- [ ] developブランチと競合が解決されている
- [ ] コミットメッセージがConventional Commitsに従っている

**PRテンプレート**:

```markdown
## 概要

キーワードマッチング方式のキャラクター選択機能を実装しました。

## 変更理由

ユーザー投稿内容に応じて適切なキャラクターが反応するようにするため。
現状ではランダム選択のみで、投稿内容との関連性が薄かった。

## 変更内容

- CharacterSelectorクラスにselectByKeywords()メソッドを追加
- キーワードスコアと発言頻度スコアの加重平均で総合スコアを算出
- 総合スコア30点以上のキャラクターを「関心あり」として抽出
- 上位から2-5体をランダムに選択

## テスト

- [x] 手動テスト実施
  - 「プログラミング」というキーワードで投稿 → マジレスニキが反応
  - 「初心者」というキーワードで投稿 → 煽りカスが反応
  - 毎回異なるキャラクターの組み合わせが登場することを確認

## 関連Issue

Refs #15
```

**レビュープロセス**:

1. **セルフレビュー**: 自分でコードを見直し、明らかな問題を修正
2. **自動チェック**: ESLint、型チェックを実行
3. **レビュアーアサイン**: チームメンバー1名以上をアサイン
4. **レビューフィードバック対応**: 指摘事項を修正
5. **承認後マージ**: Approveを得たらdevelopにマージ

## テスト戦略

### MVP段階のテスト方針

**現状**: 手動テスト中心（自動テストは将来実装）

**理由**:

- 検証段階のため、まずは機能の実装を優先
- Ollama APIやPostgreSQLとの統合テストは環境依存が大きい
- 手動テストで基本機能の動作確認を行い、安定後に自動テストを追加

### 手動テストチェックリスト

#### スレッド作成テスト

- [ ] スレッドタイトルと初回投稿を入力し、作成できる
- [ ] 作成後、スレッド詳細ページにリダイレクトされる
- [ ] スレッド一覧に新規スレッドが表示される
- [ ] データベースにスレッドとレス（postNumber=1）が保存されている

#### ユーザー投稿テスト

- [ ] レスを投稿できる
- [ ] 投稿後、即座にスレッド詳細ページに戻る
- [ ] データベースにユーザーレス（isUserPost=true）が保存されている
- [ ] レス番号が連番で採番されている

#### AIレス生成テスト

- [ ] ユーザー投稿後、3-5体のAIキャラクターがレスを生成する
- [ ] 各キャラクターの口調が一致している（マジレスニキ: 断定的、煽りカス: ｗｗｗ等）
- [ ] アンカー（>>1等）が自然に含まれている
- [ ] データベースにAIレス（isUserPost=false）が保存されている
- [ ] レス生成時間が10秒以内（CPU推論の場合）

#### キャラクター選択テスト

- [ ] 「プログラミング」というキーワードで投稿すると、マジレスニキが反応する
- [ ] 「初心者」というキーワードで投稿すると、煽りカスが反応する
- [ ] 毎回異なるキャラクターの組み合わせが登場する
- [ ] 最低2体、最大5体のキャラクターが選択される

#### エラーハンドリングテスト

- [ ] Ollamaコンテナ停止時、適切なエラーメッセージが表示される
- [ ] DB接続失敗時、500エラーが返される
- [ ] 存在しないスレッドIDにアクセス時、404エラーが返される
- [ ] バリデーションエラー時（タイトル空欄等）、400エラーが返される

### 将来的なテスト戦略

#### テストピラミッド

```
       /\
      /E2E\       少（遅い、高コスト）
     /------\
    / 統合   \     中
   /----------\
  / ユニット   \   多（速い、低コスト）
 /--------------\
```

**目標比率**:

- ユニットテスト: 70%
- 統合テスト: 20%
- E2Eテスト: 10%

#### ユニットテスト（将来実装）

**フレームワーク**: Vitest（高速、TypeScript対応）

**対象**: 個別の関数・クラス

**カバレッジ目標**: 80%以上

**例**:

```typescript
// tests/unit/services/characterSelector.test.ts
import { describe, it, expect } from 'vitest';
import { CharacterSelector } from '../../../src/services/characterSelector';
import { getCharacters } from '../../../src/lib/personas';

describe('CharacterSelector', () => {
  describe('selectByKeywords', () => {
    it('キーワードに一致するキャラクターを選択できる', () => {
      const selector = new CharacterSelector();
      const characters = selector.selectByKeywords('プログラミング', 2, 5);

      expect(characters.length).toBeGreaterThanOrEqual(2);
      expect(characters.length).toBeLessThanOrEqual(5);
      expect(characters.some((c) => c.id === 'majiresu')).toBe(true);
    });

    it('最低でもminCount体のキャラクターを選択する', () => {
      const selector = new CharacterSelector();
      const characters = selector.selectByKeywords('', 2, 5);

      expect(characters.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

#### 統合テスト（将来実装）

**対象**: 複数コンポーネントの連携

**例**:

```typescript
// tests/integration/thread-post-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ThreadManager } from '../../src/services/threadManager';
import { PostManager } from '../../src/services/postManager';
import { DatabaseClient } from '../../src/lib/db';

describe('Thread-Post統合テスト', () => {
  let db: DatabaseClient;
  let threadManager: ThreadManager;
  let postManager: PostManager;

  beforeAll(async () => {
    db = new DatabaseClient();
    threadManager = new ThreadManager(db);
    postManager = new PostManager(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('スレッド作成→レス投稿→取得の一連フローが動作する', async () => {
    // スレッド作成
    const thread = await threadManager.createThread(
      'テストスレッド',
      '初回投稿'
    );
    expect(thread.id).toBeDefined();

    // レス投稿
    const post = await postManager.createPost({
      threadId: thread.id,
      content: 'テストレス',
      isUserPost: true,
    });
    expect(post.postNumber).toBe(2);

    // レス取得
    const posts = await postManager.getPostsByThread(thread.id);
    expect(posts.length).toBe(2);
    expect(posts[0].content).toBe('初回投稿');
    expect(posts[1].content).toBe('テストレス');
  });
});
```

#### E2Eテスト（将来実装）

**ツール**: Playwright（ブラウザ自動化）

**対象**: ユーザーシナリオ全体

**例**:

```typescript
// tests/e2e/thread-creation.spec.ts
import { test, expect } from '@playwright/test';

test('スレッド作成からAIレス生成までのフロー', async ({ page }) => {
  // トップページにアクセス
  await page.goto('http://localhost:3000');

  // スレッド作成フォームに入力
  await page.fill(
    'input[name="title"]',
    'プログラミング言語で一番好きなのは？'
  );
  await page.fill('textarea[name="content"]', '俺はTypeScriptかな');
  await page.click('button[type="submit"]');

  // スレッド詳細ページにリダイレクト
  await expect(page).toHaveURL(/\/thread\/.+/);
  await expect(page.locator('h1')).toContainText(
    'プログラミング言語で一番好きなのは？'
  );

  // 初回投稿が表示
  await expect(page.locator('.post').first()).toContainText(
    '俺はTypeScriptかな'
  );

  // 10秒待機（AIレス生成完了まで）
  await page.waitForTimeout(10000);

  // AIレスが表示されていることを確認
  const posts = await page.locator('.post').count();
  expect(posts).toBeGreaterThanOrEqual(4); // 初回投稿 + AIレス3体以上
});
```

## コードレビュー基準

### レビューポイント

**機能性**:

- [ ] PRDの要件を満たしているか
- [ ] エッジケースが考慮されているか（空文字列、null、大量データ等）
- [ ] エラーハンドリングが適切か

**可読性**:

- [ ] 命名が明確か（変数名、関数名、クラス名）
- [ ] コメントが適切か（なぜそうするか、が説明されているか）
- [ ] 複雑なロジックが説明されているか

**保守性**:

- [ ] 重複コードがないか
- [ ] 責務が明確に分離されているか（レイヤードアーキテクチャの遵守）
- [ ] 変更の影響範囲が限定的か

**パフォーマンス**:

- [ ] 不要な計算がないか
- [ ] データベースクエリが最適化されているか（LIMIT、インデックス活用）
- [ ] AIレス生成が非同期化されているか

**セキュリティ**:

- [ ] SQLインジェクション対策（パラメータ化クエリ）が適切か
- [ ] XSS対策（Hono JSXのエスケープ）が適切か
- [ ] 環境変数が適切に管理されているか（ハードコード禁止）

### レビューコメントの書き方

**建設的なフィードバック**:

````markdown
## ✅ 良い例

この実装だと、スレッド数が1000件を超えた時にパフォーマンスが劣化する可能性があります。
代わりに、LIMIT句でページネーションを実装してはどうでしょうか？

```typescript
const threads = await db.query(
  'SELECT * FROM threads ORDER BY last_post_at DESC LIMIT 50'
);
```
````

## ❌ 悪い例

この書き方は良くないです。

````

**優先度の明示**:

- `[必須]`: 修正必須（セキュリティ脆弱性、バグ等）
- `[推奨]`: 修正推奨（パフォーマンス改善、可読性向上等）
- `[提案]`: 検討してほしい（代替案の提示）
- `[質問]`: 理解のための質問

## 開発環境セットアップ

### 必要なツール

| ツール         | バージョン | インストール方法                              |
| -------------- | ---------- | --------------------------------------------- |
| Node.js        | 20.x LTS   | https://nodejs.org/ または nodenv/nvm         |
| npm            | 10.x       | Node.jsに同梱                                 |
| Docker         | 24.x       | https://www.docker.com/products/docker-desktop |
| Docker Compose | 2.x        | Dockerに同梱                                  |
| Git            | 2.x        | https://git-scm.com/                          |

### セットアップ手順

```bash
# 1. リポジトリのクローン
git clone https://github.com/[username]/llm-persona-sandbox.git
cd llm-persona-sandbox

# 2. 環境変数の設定
cp .env.example .env
# .envファイルを編集（必要に応じて）

# 3. Docker Composeで環境起動
docker-compose up -d

# 4. データベース初期化
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql

# 5. Ollamaモデルのプリロード
docker exec ollama ollama run llama3.1:8b

# 6. ブラウザでアクセス
open http://localhost:3000
````

### 推奨エディタ設定

**VS Code**:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.eol": "\n"
}
```

**推奨拡張機能**:

- ESLint
- Prettier - Code formatter
- TypeScript Vue Plugin (Volar)
- Docker

### よくある問題と解決策

**Ollamaコンテナが起動しない**:

```bash
# ログを確認
docker-compose logs ollama

# コンテナを再起動
docker-compose restart ollama
```

**PostgreSQLに接続できない**:

```bash
# コンテナが起動しているか確認
docker-compose ps

# データベースが作成されているか確認
docker exec -it db psql -U postgres -l

# データベースを再作成
docker exec -it db psql -U postgres
DROP DATABASE llm_persona_sandbox;
CREATE DATABASE llm_persona_sandbox;
\q

# スキーマを再投入
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql
```

**Port 3000が既に使用されている**:

```bash
# .envファイルでポート番号を変更
PORT=3001

# docker-compose.ymlでポートマッピングを変更
ports:
  - "3001:3000"

# 再起動
docker-compose down
docker-compose up -d
```

## まとめ

本開発ガイドラインでは、LLM Persona Sandboxの開発における標準的な規約とプロセスを定義しました。

**主要なポイント**:

1. **命名規則の統一**: camelCase/PascalCase/kebab-caseの使い分け
2. **エラーハンドリングの徹底**: カスタムエラークラスの定義、適切な例外処理
3. **Git Flow採用**: main（本番）← develop ← feature/fix（開発）のブランチ戦略
4. **Conventional Commits**: 一貫性のあるコミットメッセージ
5. **手動テスト中心（MVP段階）**: 将来的に自動テストへ移行
6. **コードレビューの重要性**: 建設的なフィードバックで品質向上

**次のステップ**:

1. 用語集の作成（`docs/glossary.md`）
2. 実装開始（Docker環境構築、データベーススキーマ作成、コア機能実装）
