# LLM Persona Sandbox - 技術検証メモ

## 概要

「自分以外全員AI」の2ch風掲示板アプリケーションの実現可能性を検証する。
ユーザーが投稿すると、複数のAIキャラクター（マジレスニキ、煽りカス等）が自動的にレスを生成し、
まるで本物の2ch住民のようにスレッドが盛り上がる仕組みを構築する。

## 検証ゴール

### 1. LLM API 基本接続
- [ ] APIキーを環境変数から読み込む
- [ ] Groq API にリクエストを送信できる
- [ ] レスポンスを正常にパースできる

### 2. ペルソナ切り替え
- [ ] System Prompt でキャラクター設定を注入できる
- [ ] 同じ入力に対して、ペルソナごとに異なる口調・視点で応答が返る
- [ ] ペルソナ定義を外部ファイル（JSON/JS）で管理できる

### 3. 連続した会話コンテキスト
- [ ] 過去の投稿を文脈として渡せる
- [ ] 文脈を踏まえた応答が生成される（アンカー参照など）
- [ ] レス番号（>>1, >>3-5）を認識して返答できる

### 4. キャラクター間相互作用
- [ ] キャラAの発言にキャラBが自然に反応する
- [ ] 複数キャラの掛け合いが成立する
- [ ] 話題の流れに応じてキャラが参入/離脱する

### 5. 2ch的な振る舞い
- [ ] レス番号付与とアンカー機能
- [ ] スレッドの自然な流れ（雑談、議論、煽り合い）
- [ ] 典型的な2ch文化の再現（草、定型文、ネットスラング）

### 6. パフォーマンス/コスト検証
- [ ] 1スレッド（20-30レス）生成のコスト計算
- [ ] レスポンス時間の測定（UX許容範囲内か）
- [ ] 並列生成 vs 逐次生成の比較

## 技術スタック（本番運用想定）

### フレームワーク
- **Framework**: Hono（超軽量、Edge対応）
- **View**: Hono + JSX（サーバーサイドHTML生成）
- **Runtime**: Node.js（開発） → Cloudflare Workers（本番）
- **Validation**: Zod（型安全なバリデーション）

### データベース
- **開発**: SQLite（ローカル）
- **本番**: Cloudflare D1（Workers内で直接SQL実行、超低レイテンシ）
- **リアルタイム**: Cloudflare Durable Objects（必要に応じて）

### LLM（AIキャラクター生成用）
- **開発**: Groq API (無料枠)
- **本番**: OpenRouter（複数プロバイダー対応）
- **用途**: ユーザー投稿に対してAIキャラクターが自動レス生成

## ディレクトリ構成（Hono + TypeScript）

```
llm-persona-sandbox/
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── wrangler.toml         # Cloudflare Workers設定
├── src/
│   ├── index.tsx         # Honoアプリエントリーポイント
│   ├── routes/
│   │   ├── threads.tsx   # スレッド表示・作成
│   │   └── posts.tsx     # レス投稿処理
│   ├── services/
│   │   ├── llm.ts        # LLM APIラッパー
│   │   ├── generator.ts  # AIレス生成制御
│   │   └── batch.ts      # バッチ生成方式（実験）
│   ├── lib/
│   │   ├── db.ts         # DB抽象化（SQLite/D1切替）
│   │   ├── personas.ts   # ペルソナ定義
│   │   └── utils.ts      # ユーティリティ関数
│   └── types/
│       └── index.ts      # 型定義
├── data/
│   └── dev.db            # 開発用SQLiteデータベース
└── scripts/
    ├── seed.ts           # DB初期データ投入
    └── migrate.sql       # スキーマ定義
```

## ペルソナ例（2ch風キャラクター）

| ID | 名前 | 特徴 | 発言頻度 | 他キャラへの反応 |
|----|------|------|----------|-----------------|
| `majiresu` | マジレスニキ | 論理的、長文、「いや、それは〜」 | 高 | 煽りを無視、誤情報を訂正 |
| `aori` | 煽りカス | 短文、草、小馬鹿にする | 高 | 誰にでも噛みつく |
| `monoshiri` | 物知りおじさん | 豆知識、上から目線、「〜なんだよなぁ」 | 中 | マジレスを補強、煽りを諭す |
| `rom` | ROM専 | たまに核心をつく一言 | 低 | スレの流れが変わる時だけ |
| `newcomer` | 新参 | 質問が多い、空気読めない | 中 | 誰にでも質問、煽られやすい |

## 実装タスク

### Phase 1: 開発環境構築 & 最小構成実装
1. `npm init -y` でプロジェクト初期化
2. 必要パッケージインストール: `npm install hono @hono/node-server better-sqlite3 groq-sdk zod`
3. TypeScript設定: `npx tsc --init`
4. SQLiteでローカルDB作成、スキーマ定義（scripts/migrate.sql）
5. Groq ConsoleでAPIキー取得 (https://console.groq.com)
6. `.env` に `GROQ_API_KEY` を設定
7. Hono + JSXで基本的な2ch風UIを実装
8. 単一キャラクターでのレス生成テスト

### Phase 2: 2chスレッド構造の実装
1. スレッドのデータ構造定義（スレタイ、レス配列）
2. レス番号の自動採番機能
3. 「>>1」形式のアンカー解析
4. スレッド全体をプロンプトに変換する機能

### Phase 3: 複数キャラクターの実装
1. `src/personas.js` に5種類以上のペルソナ定義
2. キャラクターごとの発言確率設定
3. 話題への関心度（キーワードマッチング）
4. キャラ間の相性マトリックス定義

### Phase 4: インタラクション生成
1. ユーザー投稿を起点にスレッド生成
2. 複数キャラが順次or並列でレス生成
3. 直前レスへの反応 vs 話題への反応の使い分け
4. 20-30レスの自動生成デモ

### Phase 5: 最適化とコスト削減
1. プロンプトキャッシング戦略
2. 並列API呼び出しの実装
3. トークン数削減（文脈要約機能）
4. 1スレッドあたりのコスト計算と最適化

### Phase 6: Cloudflare Workers移行
1. Wrangler CLIセットアップ
2. D1データベース作成、スキーマ移行
3. 環境変数とシークレットの設定
4. workers.devドメインでデプロイ・動作確認

## 環境変数設定（.env）

```bash
# LLM API
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# 機能フラグ
USE_BATCH_GENERATION=true      # バッチ生成方式を使用
USE_SMART_SELECTION=false      # 本番はtrue（LLMでキャラ選択）

# 開発用
NODE_ENV=development
```

## 実行コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# Cloudflare Workers ローカルテスト
npx wrangler dev

# Cloudflare Workers デプロイ
npx wrangler deploy
```

## Groq API仕様

### 利用可能モデル（無料枠）
- **llama-3.1-70b-versatile**: 最高品質、日本語対応良好
- **llama-3.1-8b-instant**: 高速、軽量
- **mixtral-8x7b-32768**: バランス型

### レート制限（無料枠）
- 30 requests/分
- 14,400 requests/日
- 6,000 tokens/分 (70Bモデル)

### 料金比較
| サービス | モデル | 価格 (1M tokens) |
|---------|--------|------------------|
| Groq | Llama 3.1 70B | 無料 (制限あり) |
| Groq | Llama 3.1 70B | $0.59/$0.79 (有料) |
| Together AI | Llama 3.1 70B | $0.90 |
| OpenRouter | Llama 3.1 70B | $0.70 |
| Anthropic | Claude 3.5 Sonnet | $3.00/$15.00 |

## アーキテクチャ設計

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   User      │─────>│  Thread      │─────>│  Response   │
│   Input     │      │  Manager     │      │  Generator  │
└─────────────┘      └──────────────┘      └─────────────┘
                             │                     │
                             ▼                     ▼
                      ┌──────────────┐      ┌─────────────┐
                      │  Character   │      │   Groq      │
                      │  Selector    │      │   API       │
                      └──────────────┘      └─────────────┘
```

### コンポーネント説明
- **Thread Manager**: スレッド状態管理、レス番号採番
- **Character Selector**: 発言キャラの選択、タイミング制御
- **Response Generator**: プロンプト構築、API呼び出し

## 実装例（Hono + TypeScript）

### package.json 依存関係
```json
{
  "scripts": {
    "dev": "tsx watch src/index.tsx",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.8.0",
    "better-sqlite3": "^9.4.0",
    "groq-sdk": "^0.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/better-sqlite3": "^7.6.9",
    "@cloudflare/workers-types": "^4.20240314.0",
    "wrangler": "^3.48.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

### Hono + JSX実装（MPAアプローチ）
```tsx
// src/index.tsx
import { Hono } from 'hono'
import { jsx } from 'hono/jsx'
import { serve } from '@hono/node-server' // 開発時
// import { D1Database } from '@cloudflare/workers-types' // 本番時

const app = new Hono()

// レイアウトコンポーネント
const Layout = ({ children, title }: { children: any, title: string }) => (
  <html>
    <head>
      <title>{title}</title>
      <style>{`
        body { font-family: 'MS PGothic', monospace; background: #efefef; }
        .container { max-width: 800px; margin: 0 auto; background: #f0e0d6; }
        .post { margin: 4px 8px; }
        .post-header { color: green; font-weight: bold; }
        .post-content { margin-left: 1em; }
        .post-anchor { color: blue; text-decoration: underline; cursor: pointer; }
      `}</style>
    </head>
    <body>
      <div class="container">{children}</div>
    </body>
  </html>
)

// スレッド表示ページ
app.get('/thread/:id', async (c) => {
  const threadId = c.req.param('id')
  const db = c.env?.DB // Cloudflare D1

  // スレッドとレスを取得
  const thread = await db.prepare(
    'SELECT * FROM threads WHERE id = ?'
  ).bind(threadId).first()

  const posts = await db.prepare(
    'SELECT * FROM posts WHERE thread_id = ? ORDER BY post_number'
  ).bind(threadId).all()

  return c.html(
    <Layout title={thread.title}>
      <h1>{thread.title}</h1>
      {posts.results.map((post: any) => (
        <div class="post">
          <div class="post-header">
            {post.post_number} : {post.author_name} : {new Date(post.created_at * 1000).toLocaleString('ja-JP')}
          </div>
          <div class="post-content">{post.content}</div>
        </div>
      ))}
      <form method="POST" action={`/thread/${threadId}/post`}>
        <textarea name="content" rows={4} cols={60}></textarea><br/>
        <button type="submit">書き込む</button>
      </form>
    </Layout>
  )
})
```

```typescript
// lib/db.ts - DB抽象化レイヤー
import Database from 'better-sqlite3'

interface DBAdapter {
  prepare(sql: string): any
  run(sql: string, ...params: any[]): any
  get(sql: string, ...params: any[]): any
  all(sql: string, ...params: any[]): any[]
}

// 開発環境用SQLiteアダプタ
class SQLiteAdapter implements DBAdapter {
  private db: Database.Database

  constructor(path: string) {
    this.db = new Database(path)
  }

  prepare(sql: string) {
    return this.db.prepare(sql)
  }

  run(sql: string, ...params: any[]) {
    return this.db.prepare(sql).run(...params)
  }

  get(sql: string, ...params: any[]) {
    return this.db.prepare(sql).get(...params)
  }

  all(sql: string, ...params: any[]) {
    return this.db.prepare(sql).all(...params)
  }
}

// 本番環境用D1アダプタ（Cloudflare Workers）
class D1Adapter implements DBAdapter {
  constructor(private d1: any) {}

  prepare(sql: string) {
    return this.d1.prepare(sql)
  }

  async run(sql: string, ...params: any[]) {
    return await this.d1.prepare(sql).bind(...params).run()
  }

  async get(sql: string, ...params: any[]) {
    return await this.d1.prepare(sql).bind(...params).first()
  }

  async all(sql: string, ...params: any[]) {
    const result = await this.d1.prepare(sql).bind(...params).all()
    return result.results
  }
}

export function createDB(env?: any): DBAdapter {
  if (env?.DB) {
    // Cloudflare Workers環境
    return new D1Adapter(env.DB)
  } else {
    // ローカル開発環境
    return new SQLiteAdapter('./data/dev.db')
  }
}

// ユーザー投稿処理 + AI自動レス生成
app.post('/thread/:id/post', async (c) => {
  const threadId = c.req.param('id')
  const formData = await c.req.formData()
  const content = formData.get('content') as string
  const db = createDB(c.env)

  // ユーザー投稿を保存
  const postNumber = await getNextPostNumber(db, threadId)
  await db.run(
    'INSERT INTO posts (thread_id, post_number, author_name, content, is_user_post) VALUES (?, ?, ?, ?, ?)',
    threadId, postNumber, '名無しさん', content, 1
  )

  // AIキャラクターによる自動レス生成
  // Workers環境ではwaitUntilが使える、ローカルではPromiseで非同期実行
  if (c.executionCtx) {
    c.executionCtx.waitUntil(generateAIResponses(db, threadId, content))
  } else {
    // ローカル環境では非同期で実行
    generateAIResponses(db, threadId, content).catch(console.error)
  }

  // スレッドページにリダイレクト
  return c.redirect(`/thread/${threadId}`)
})

// AIレス生成ロジック
async function generateAIResponses(
  db: DBAdapter,
  threadId: string,
  userPost: string
) {
  // スレッド履歴を取得
  const posts = await db.all(
    'SELECT * FROM posts WHERE thread_id = ? ORDER BY post_number DESC LIMIT 20',
    threadId
  )

  // 3-5体のキャラクターを選択
  const selectedCharacters = await selectCharactersForTopic(userPost, posts)

  // バッチ生成方式（推奨）- 1回のAPIコールで複数レス生成
  if (USE_BATCH_GENERATION) {
    const batchResponse = await generateBatchResponses(selectedCharacters, posts, userPost)

    for (const [index, aiContent] of batchResponse.entries()) {
      const character = selectedCharacters[index]
      const postNumber = await getNextPostNumber(db, threadId)

      await db.run(
        'INSERT INTO posts (thread_id, post_number, author_name, character_id, content, is_user_post) VALUES (?, ?, ?, ?, ?, ?)',
        threadId, postNumber, character.displayName, character.id, aiContent, 0
      )
    }
  } else {
    // 個別生成方式（フォールバック）
    for (const character of selectedCharacters) {
      const prompt = buildPromptForCharacter(character, posts, userPost)

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [
            { role: 'system', content: character.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: character.temperature || 0.8,
          max_tokens: 200
        })
      })

      const data = await response.json()
      const aiContent = data.choices[0].message.content

      const postNumber = await getNextPostNumber(db, threadId)
      await db.run(
        'INSERT INTO posts (thread_id, post_number, author_name, character_id, content, is_user_post) VALUES (?, ?, ?, ?, ?, ?)',
        threadId, postNumber, character.displayName, character.id, aiContent, 0
      )
    }
  }
}

// バッチ生成方式の実装例
async function generateBatchResponses(
  characters: Character[],
  threadHistory: Post[],
  userPost: string
): Promise<string[]> {
  const batchPrompt = `
以下の2chスレッドに、異なるキャラクターとして${characters.length}個のレスを生成してください。

スレッド履歴:
${threadHistory.map(p => `${p.post_number}: ${p.author_name}: ${p.content}`).join('\n')}

最新の投稿:
${userPost}

以下のキャラクターそれぞれでレスしてください:
${characters.map((c, i) => `
${i + 1}. ${c.displayName}
- 性格: ${c.personality}
- 口調: ${c.speechStyle}
`).join('\n')}

JSON配列形式で返してください:
["キャラ1のレス", "キャラ2のレス", ...]
`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'user', content: batchPrompt }
      ],
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })
  })

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
```

### AIキャラクター定義例
```typescript
// src/lib/personas.ts
export const personas = [
  {
    id: 'majiresu',
    displayName: 'マジレスニキ',
    systemPrompt: `あなたは2chの「マジレスニキ」です。
    - 論理的で長文の返答をする
    - 「いや、それは違うだろ」から始めることが多い
    - 正確な情報を重視し、間違いを訂正する
    - 煽りは華麗にスルー`,
    temperature: 0.7,
    keywords: ['技術', 'プログラミング', '設計', 'アーキテクチャ']
  },
  {
    id: 'aori',
    displayName: '煽りカス',
    systemPrompt: `あなたは2chの「煽りカス」です。
    - 短文で煽る
    - 「草」「ｗｗｗ」を多用
    - 「それって〜じゃんｗ」のような馬鹿にした口調
    - マジレスを茶化す`,
    temperature: 0.9,
    keywords: ['初心者', 'エラー', '質問', 'わからない']
  },
  {
    id: 'monoshiri',
    displayName: '物知りおじさん',
    systemPrompt: `あなたは2chの「物知りおじさん」です。
    - 豆知識や経験談を語る
    - 「昔は〜だったんだよなぁ」という回顧的な語り
    - 上から目線だが悪意はない
    - 話が脱線しがち`,
    temperature: 0.8,
    keywords: ['歴史', '昔', '経験', 'ベテラン']
  }
]

// キャラクター選択ロジック（改良版）
export async function selectCharactersForTopic(
  userPost: string,
  threadHistory: any[],
  min = 2,
  max = 4
): Promise<Character[]> {
  // 検証段階: キーワードマッチング
  if (!USE_SMART_SELECTION) {
    // シンプルなキーワードマッチング（検証用）
    const interested = personas.filter(p =>
      p.keywords.some(k => userPost.toLowerCase().includes(k.toLowerCase()))
    )

    const count = Math.floor(Math.random() * (max - min + 1)) + min
    const selected = [...interested]

    while (selected.length < count && selected.length < personas.length) {
      const random = personas[Math.floor(Math.random() * personas.length)]
      if (!selected.includes(random)) {
        selected.push(random)
      }
    }

    return selected.slice(0, count)
  }

  // 本番: LLMによる関心度判定
  const selectionPrompt = `
以下の投稿に対して、どのキャラクターが反応しそうか判定してください。

投稿内容: ${userPost}

キャラクターリスト:
${personas.map(p => `- ${p.id}: ${p.personality}`).join('\n')}

反応しそうなキャラクターのIDを${min}〜${max}個、JSON配列で返してください。
例: ["majiresu", "aori", "monoshiri"]
`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // 軽量モデルで十分
        messages: [{ role: 'user', content: selectionPrompt }],
        temperature: 0.7,
        max_tokens: 100,
        response_format: { type: 'json_object' }
      })
    })

    const data = await response.json()
    const selectedIds = JSON.parse(data.choices[0].message.content)

    return selectedIds
      .map((id: string) => personas.find(p => p.id === id))
      .filter(Boolean)
  } catch (error) {
    console.error('Smart selection failed, falling back:', error)
    // フォールバック: ランダム選択
    return personas.slice(0, Math.floor(Math.random() * (max - min + 1)) + min)
  }
}
```

## バックエンドアーキテクチャ

### 推奨スタック（検証〜本番対応）

```
[ユーザー] → ブラウザでスレッドに投稿
       ↓
[Hono + JSX] → サーバーサイドでHTML生成（2ch風UI）
       ↓
[Runtime]
  - 開発: Node.js（ローカル）
  - 本番: Cloudflare Workers（エッジで高速動作）
       ↓
[データストア]
  - 開発: SQLite（ローカル）
  - 本番: Cloudflare D1（Workers内で完結）
       ↓
[LLM API] → AIキャラクターのレス生成
  - Groq（検証）→ OpenRouter（本番）
```

### アーキテクチャの利点

1. **シンプル**: SPAではなくMPA（Multi-Page App）として実装
2. **高速**: Cloudflare D1はWorkers内で直接SQL実行（外部API不要）
3. **低コスト**: Workers + D1は無料枠が大きい
4. **SEO対応**: サーバーサイドレンダリングで検索エンジン最適化
5. **2ch風UI**: 古典的なHTMLフォーム投稿が自然にマッチ

### データベーススキーマ（Cloudflare D1）

```sql
-- threads テーブル
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  last_post_at INTEGER DEFAULT (unixepoch()),
  post_count INTEGER DEFAULT 0
);

-- posts テーブル
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  post_number INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  character_id TEXT,
  content TEXT NOT NULL,
  anchors TEXT, -- カンマ区切りで"1,2,5"のように保存
  is_user_post INTEGER DEFAULT 0, -- D1ではBOOLEAN→INTEGER
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (thread_id) REFERENCES threads(id)
);

-- インデックス（高速化）
CREATE INDEX idx_posts_thread ON posts(thread_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
```

### API設計（REST + SSE）

```javascript
// POST /api/thread - スレッド作成
{
  title: "プログラミング言語で一番好きなのは？",
  firstPost: "俺はTypeScriptかな"
}

// GET /api/thread/:id - スレッド取得
// Response: { thread, posts: [...] }

// POST /api/post - ユーザー投稿 & AI生成トリガー
{
  threadId: "xxx",
  content: "Python一択だろ"
}

// GET /api/stream/:threadId - SSEでリアルタイム配信
// AI生成されたレスを順次配信
```

### なぜこの構成が最適か

1. **パフォーマンス最優先**
   - Cloudflare D1 = Workers内で直接SQL実行（レイテンシ数ms）
   - Hono + JSX = サーバーサイドHTML生成（初回表示高速）
   - エッジ配信 = 世界中どこでも低レイテンシ

2. **開発からの移行が簡単**
   - 開発: Hono on Node.js + SQLite
   - 本番: Hono on Workers + D1（コード変更最小限）

3. **2ch風UIに最適**
   - 古典的なフォーム投稿 = MPAが自然
   - SEO対応 = サーバーサイドレンダリング
   - JavaScriptオフでも動作

### コスト最適化戦略

1. **Cloudflare Workers 無料枠**
   - 100,000 リクエスト/日
   - 10ms CPU時間/呼び出し（有料プランで50ms）
   - 月額$5で1000万リクエスト

2. **Cloudflare D1 無料枠**
   - 5GB ストレージ
   - 500万行読み取り/月
   - 10万行書き込み/月

3. **LLMコスト削減**
   - プロンプトキャッシング（同じスレッドは再利用）
   - レス数制限（古いレスは要約）
   - キャラクター数の動的調整（人気度に応じて）

**想定コスト**:
- インフラ: 月額$0〜5（10万PV程度まで）
- LLM: 1スレッドあたり約$0.05（30レス生成）

## 移行戦略

1. **検証フェーズ** (現在)
   - Groq無料枠で機能検証
   - ペルソナのプロンプト調整
   - レスポンス品質の確認

2. **プロトタイプ**
   - Together AI or OpenRouterで安定性テスト
   - 複数プロバイダー対応の実装

3. **本番運用**
   - OpenRouter経由で複数プロバイダーフェイルオーバー
   - コスト最適化とSLA確保

## 重要な検証ポイント

### コスト面での懸念
- 1スレッド30レス生成 = 約30 API呼び出し → **バッチ生成で6-10回に削減可能**
- 各レスが前のレスを文脈として含む → トークン数が累積的に増加
- **推定**: 1スレッドあたり 50,000-100,000 tokens → バッチで30,000-60,000に削減

### 技術的課題
1. **文脈の肥大化対策**
   - 古いレスの要約機能
   - 重要レスのみ残す選別ロジック
   - sliding window方式（直近N件のみ参照）

2. **Cloudflare Workers制約への対応**
   - **タイマー制限**: setTimeoutは使えない → クライアント側で遅延表示
   - **実行時間制限**: 10ms（無料）/50ms（有料）→ バッチ生成で高速化
   - **メモリ制限**: 128MB → コンテキストサイズに注意
   - **Subrequests制限**: 50回/リクエスト → バッチ生成必須

3. **リアルタイム感の演出**
   - クライアント側でのレス順次表示（setIntervalで制御）
   - 「書き込み中...」インジケーター
   - SSEまたはポーリングでの更新通知

4. **キャラクター一貫性の維持**
   - キャラクター固有のメモリ機能
   - 過去の自分の発言を記憶
   - 話題への一貫した態度

## 優先実装すべきアプローチ

### 【最優先】バッチ生成方式
- **1回のAPI呼び出しで3-5キャラのレスをJSON配列で生成**
- メリット:
  - APIコール数が1/3〜1/5に削減（コスト大幅減）
  - レイテンシ改善（1回の往復で完了）
  - キャラ間の文脈共有で自然な掛け合い
- 実装済み: `generateBatchResponses()`関数
- 検証項目: JSON解析の成功率、レス品質の維持

### Alternative 1: スマートキャラクター選択
- LLMに「このキャラはこの話題に反応するか？」を判定させる
- 実装済み: `USE_SMART_SELECTION`フラグで切替可能
- 軽量モデル（8B）で十分な精度

### Alternative 2: ハイブリッド方式
- 重要キャラはLLM、モブは定型文
- メリット: コスト削減
- デメリット: 実装複雑

### Alternative 3: Fine-tuning（将来）
- 2chログでファインチューニング
- メリット: より自然な2ch風の応答
- デメリット: 初期コスト、メンテナンス

## 備考

- APIキーは `.env` に置き、`.gitignore` で除外する
- Groqは日本からのアクセスが不安定な場合があるため、VPN使用も検討
- 本番サービス化は別リポジトリで行う予定
- プロバイダー切り替えを容易にするため、LLMアクセス層を抽象化する
