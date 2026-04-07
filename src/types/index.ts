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
   * スレッドID（UUID v4形式）
   */
  id: string;

  /**
   * スレッドタイトル（1-100文字）
   */
  title: string;

  /**
   * 作成日時
   */
  createdAt: Date;

  /**
   * 最終レス日時
   */
  lastPostAt: Date;

  /**
   * レス数（0以上）
   */
  postCount: number;
}

/**
 * レス（投稿）情報
 */
export interface Post {
  /**
   * レスID（自動採番）
   */
  id: number;

  /**
   * スレッドID（外部キー）
   */
  threadId: string;

  /**
   * レス番号（スレッド内で1から開始）
   */
  postNumber: number;

  /**
   * 投稿者名（デフォルト: "名無しさん"）
   */
  authorName: string;

  /**
   * キャラクターID（ユーザー投稿の場合はnull）
   */
  characterId: string | null;

  /**
   * 投稿内容（1-2000文字）
   */
  content: string;

  /**
   * アンカー情報（カンマ区切り: "1,2,5"）
   */
  anchors: string | null;

  /**
   * ユーザー投稿フラグ（true: ユーザー, false: AI）
   */
  isUserPost: boolean;

  /**
   * 作成日時
   */
  createdAt: Date;
}

/**
 * レス作成データ
 */
export interface CreatePostData {
  /**
   * スレッドID
   */
  threadId: string;

  /**
   * 投稿内容（1-2000文字）
   */
  content: string;

  /**
   * 投稿者名（省略時は「名無しさん」）
   */
  authorName?: string;

  /**
   * キャラクターID（AI投稿の場合のみ）
   */
  characterId?: string;

  /**
   * アンカー情報（カンマ区切り: "1,2,5"）
   */
  anchors?: string;

  /**
   * ユーザー投稿フラグ（デフォルト: true）
   */
  isUserPost?: boolean;
}

/**
 * Ollama APIチャットメッセージ
 */
export interface ChatMessage {
  /**
   * メッセージのロール
   * - system: システムプロンプト（キャラクター定義）
   * - user: ユーザープロンプト（スレッド履歴 + 最新投稿）
   */
  role: 'system' | 'user' | 'assistant';

  /**
   * メッセージ内容
   */
  content: string;
}

/**
 * Ollama APIチャットオプション
 */
export interface ChatOptions {
  /**
   * 生成時の温度パラメータ（0.0-1.0）
   * 低いほど確定的、高いほど創造的
   */
  temperature?: number;

  /**
   * 生成する最大トークン数
   * デフォルト: 200（5chレスの平均的な長さ）
   */
  num_predict?: number;
}

/**
 * Ollama APIチャット補完レスポンス
 */
export interface ChatResponse {
  /**
   * 生成されたメッセージ
   */
  message: {
    role: 'assistant';
    content: string;
  };

  /**
   * レスポンス完了フラグ
   */
  done: boolean;

  /**
   * 生成にかかった時間（ナノ秒）
   */
  total_duration?: number;

  /**
   * プロンプト評価時間（ナノ秒）
   */
  prompt_eval_duration?: number;
}
