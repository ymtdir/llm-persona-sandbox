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
