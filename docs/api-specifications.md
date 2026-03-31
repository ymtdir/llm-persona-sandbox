# API仕様書 (API Specifications)

## 概要

LLM Persona Sandboxで使用される外部API・内部APIの仕様詳細。

**関連ドキュメント**:
- [機能設計書](./functional-design.md) - API使用方法
- [アーキテクチャ設計書](./architecture.md) - API統合戦略

## Ollama API

### 基本情報

- **ベースURL**: `http://ollama:11434` (Docker内部) / `http://localhost:11434` (ホスト)
- **プロトコル**: HTTP/1.1
- **認証**: なし（内部ネットワーク）
- **フォーマット**: JSON
- **互換性**: OpenAI互換API

### POST /api/chat

AIキャラクターのレス生成に使用するチャット補完エンドポイント。

#### リクエスト

**エンドポイント**: `POST /api/chat`

**ヘッダー**:
```
Content-Type: application/json
```

**ボディ**:
```json
{
  "model": "llama3.1:8b",
  "messages": [
    {
      "role": "system",
      "content": "あなたは2chの「マジレスニキ」です。性格: 真面目で論理的..."
    },
    {
      "role": "user",
      "content": "以下のスレッドに対して、レスしてください。\n\nスレッド履歴:\n1: 名無しさん: プログラミング言語で一番好きなのは？\n\n最新の投稿:\n1: 名無しさん: 俺はTypeScriptかな\n\nあなたのレス（本文のみ、レス番号不要）:"
    }
  ],
  "stream": false,
  "options": {
    "temperature": 0.8,
    "num_predict": 200
  }
}
```

**パラメータ説明**:

| パラメータ          | 型      | 必須 | 説明                                                   |
| ------------------- | ------- | ---- | ------------------------------------------------------ |
| model               | string  | ✅   | 使用モデル（例: "llama3.1:8b", "llama3.1:70b"）        |
| messages            | array   | ✅   | チャットメッセージ配列                                 |
| messages[].role     | string  | ✅   | メッセージ送信者（"system", "user", "assistant"）      |
| messages[].content  | string  | ✅   | メッセージ内容                                         |
| stream              | boolean | ❌   | ストリーミングモード（デフォルト: false）              |
| options.temperature | number  | ❌   | 生成ランダム性（0.0-1.0、デフォルト: 0.8）             |
| options.num_predict | number  | ❌   | 最大生成トークン数（デフォルト: 128）                  |
| options.top_p       | number  | ❌   | nucleus sampling（0.0-1.0、デフォルト: 0.9）           |

#### レスポンス（成功）

**ステータスコード**: `200 OK`

**ボディ**:
```json
{
  "model": "llama3.1:8b",
  "created_at": "2025-01-15T05:32:18.123456Z",
  "message": {
    "role": "assistant",
    "content": "いや、それは正しい選択だろ。型安全性が段違いだし、エディタの補完も強力。>>1の言う通り、TypeScript一択。"
  },
  "done": true,
  "total_duration": 2847291667,
  "load_duration": 12345678,
  "prompt_eval_count": 45,
  "prompt_eval_duration": 123456789,
  "eval_count": 28,
  "eval_duration": 2711234567
}
```

**フィールド説明**:

| フィールド           | 型      | 説明                                       |
| -------------------- | ------- | ------------------------------------------ |
| model                | string  | 使用されたモデル名                         |
| created_at           | string  | レスポンス生成日時（ISO 8601形式）         |
| message.role         | string  | 応答者（常に "assistant"）                 |
| message.content      | string  | 生成されたレス内容                         |
| done                 | boolean | 生成完了フラグ（常に true、非ストリーム時）|
| total_duration       | number  | 合計処理時間（ナノ秒）                     |
| prompt_eval_count    | number  | プロンプト評価トークン数                   |
| eval_count           | number  | 生成トークン数                             |
| eval_duration        | number  | 生成処理時間（ナノ秒）                     |

#### レスポンス（エラー）

**404 Not Found** - モデルが見つからない:
```json
{
  "error": "model 'llama3.1:8b' not found, try pulling it first"
}
```

**500 Internal Server Error** - LLM生成エラー:
```json
{
  "error": "failed to generate response"
}
```

**503 Service Unavailable** - Ollamaサーバー未起動:
```
(接続タイムアウト、またはHTTPレスポンスなし)
```

### POST /api/generate（将来実装候補）

シンプルなテキスト生成エンドポイント（チャット以外の用途）。

### タイムアウト設定

| 環境           | タイムアウト | 理由                                       |
| -------------- | ------------ | ------------------------------------------ |
| 開発環境（CPU）| 30秒         | llama3.1:8bで200トークン生成に約3-5秒      |
| 本番環境（GPU）| 10秒         | GPU推論で200トークン生成に約1-2秒          |

**実装例**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒

const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

## 内部APIエンドポイント（Hono）

現時点ではフロントエンドとの分離がないため、内部APIエンドポイントは定義なし。
将来的にSPA化する場合、以下のようなREST APIを検討：

### GET /api/threads

スレッド一覧取得（将来実装）。

**レスポンス例**:
```json
{
  "threads": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "プログラミング言語で一番好きなのは？",
      "postCount": 15,
      "lastPostAt": "2025-01-15T14:32:18Z",
      "createdAt": "2025-01-15T12:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "perPage": 50
}
```

### GET /api/threads/:id

スレッド詳細とレス一覧取得（将来実装）。

### POST /api/threads

スレッド作成（将来実装）。

### POST /api/threads/:id/posts

レス投稿（将来実装）。

## WebSocket API（将来実装）

リアルタイムレス表示のためのWebSocket接続。

**エンドポイント**: `ws://localhost:3000/ws/thread/:id`

**イベント**:

- `post_created`: 新しいレスが投稿された
- `ai_generating`: AIレス生成中
- `ai_generated`: AIレスが生成された

**メッセージ例**:
```json
{
  "event": "ai_generated",
  "data": {
    "postNumber": 5,
    "authorName": "マジレスニキ",
    "content": "いや、それは正しい選択だろ。",
    "createdAt": "2025-01-15T14:32:20Z"
  }
}
```

## エラーハンドリング戦略

### Ollama APIエラーの処理

```typescript
try {
  const response = await ollamaClient.chat(model, messages, options);
  return response;
} catch (error) {
  if (error.name === 'AbortError') {
    throw new OllamaTimeoutError('Ollama API request timed out');
  }
  if (error.message.includes('model not found')) {
    throw new OllamaModelNotFoundError(model);
  }
  throw new OllamaConnectionError('Failed to connect to Ollama API', error);
}
```

### リトライ戦略（将来実装）

- **タイムアウト時**: リトライなし（ユーザー体験を優先）
- **接続エラー時**: 最大3回リトライ（指数バックオフ: 1秒、2秒、4秒）
- **モデル未ロード時**: 1回リトライ（モデルロード待機: 30秒）

## パフォーマンス測定

### Ollama API呼び出し時間

| モデル       | 環境       | 200トークン生成 | 備考                       |
| ------------ | ---------- | --------------- | -------------------------- |
| llama3.1:8b  | CPU 4コア  | 3-5秒           | 標準的な開発環境           |
| llama3.1:8b  | GPU GTX1660| 1-2秒           | CUDA対応GPU                |
| llama3.1:70b | CPU 16コア | 20-30秒         | 高品質だが遅い             |
| llama3.1:70b | GPU RTX4090| 3-5秒           | ハイエンドGPU              |

### ログ出力例

```typescript
console.log('[INFO] OllamaClient: Sending chat request', {
  model: 'llama3.1:8b',
  messageCount: 2,
  temperature: 0.8,
});

console.time('ollama-chat');
const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {...});
console.timeEnd('ollama-chat'); // ollama-chat: 3421ms

console.log('[INFO] OllamaClient: Received response', {
  tokenCount: response.eval_count,
  duration: response.total_duration / 1_000_000, // ミリ秒に変換
});
```

## セキュリティ考慮事項

### プロンプトインジェクション対策

ユーザー入力をそのままSystem Promptに含めない：

```typescript
// ❌ 危険な実装
const systemPrompt = `あなたは${userInput}です。`;

// ✅ 安全な実装
const systemPrompt = buildSystemPrompt(character); // 定義済みキャラクターのみ使用
const userPrompt = `ユーザー投稿: ${escapePrompt(userInput)}`;
```

### APIキーの管理

- Ollama APIは認証不要（内部ネットワーク限定）
- 将来的にクラウドLLM APIを使用する場合は `.env` にAPIキーを記載

## 関連ドキュメント

- [機能設計書](./functional-design.md) - AIレス生成アルゴリズム
- [アーキテクチャ設計書](./architecture.md) - Ollama統合戦略
- [デプロイメントガイド](./deployment-guide.md) - Ollamaサーバー設定
