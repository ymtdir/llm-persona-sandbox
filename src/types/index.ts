/**
 * AIキャラクター定義
 *
 * 5chスタイルの掲示板における、各種ペルソナを表現するキャラクター型
 */
export interface Character {
  /**
   * キャラクターの一意識別子
   * 例: 'majiresu', 'aori', 'monoshiri'
   */
  id: string;

  /**
   * 表示名（5chスタイルの名前欄）
   * 例: 'マジレスニキ', '煽りカス', '物知りおじさん'
   */
  displayName: string;

  /**
   * システムプロンプト
   * LLMに渡されるキャラクターの基本的な振る舞い定義
   */
  systemPrompt: string;

  /**
   * 性格特性
   * キャラクターの内面的な特徴を表す文字列
   * 例: '真面目で論理的', '攻撃的で挑発的'
   */
  personality: string;

  /**
   * 話し方の特徴
   * 5chスタイルの口調や表現パターン
   * 例: '丁寧語、構造化された説明', '煽り言葉、攻撃的な表現'
   */
  speechStyle: string;

  /**
   * LLM生成時の温度パラメータ
   * 0.0（確定的）～ 1.0（創造的）
   */
  temperature: number;

  /**
   * キャラクターに関連するキーワード
   * レス選択や話題判定に使用
   */
  keywords: string[];

  /**
   * 発言頻度の重み付け
   * 1（低頻度）～ 10（高頻度）
   */
  frequency: number;
}

/**
 * スレッド情報
 */
export interface Thread {
  /**
   * スレッドID（ULID）
   */
  id: string;

  /**
   * スレッドタイトル
   */
  title: string;

  /**
   * 作成日時（ISO 8601形式）
   */
  createdAt: string;
}

/**
 * レス（投稿）情報
 */
export interface Post {
  /**
   * レスID（ULID）
   */
  id: string;

  /**
   * 所属するスレッドID
   */
  threadId: string;

  /**
   * レス番号（1から開始）
   */
  postNumber: number;

  /**
   * 投稿者名（キャラクター表示名またはユーザー入力）
   */
  authorName: string;

  /**
   * レス本文
   */
  content: string;

  /**
   * 投稿日時（ISO 8601形式）
   */
  createdAt: string;

  /**
   * キャラクターID（AIレスの場合のみ）
   */
  characterId?: string;
}

/**
 * レス作成リクエスト
 */
export interface CreatePostRequest {
  /**
   * レス本文
   */
  content: string;

  /**
   * 投稿者名（省略時は「名無しさん」）
   */
  authorName?: string;
}

/**
 * スレッド作成リクエスト
 */
export interface CreateThreadRequest {
  /**
   * スレッドタイトル
   */
  title: string;

  /**
   * 初回レスの本文
   */
  initialPost: string;

  /**
   * 投稿者名（省略時は「名無しさん」）
   */
  authorName?: string;
}
