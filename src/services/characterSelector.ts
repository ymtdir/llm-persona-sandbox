import type { Character, Post } from '../types';
import { characters } from '../lib/personas';

/**
 * キャラクター選択結果
 */
interface CharacterScore {
  character: Character;
  keywordScore: number;
  frequencyScore: number;
  totalScore: number;
}

/**
 * CharacterSelector
 *
 * 投稿内容に応じて反応するキャラクターを選択するクラス。
 * キーワードマッチングスコアと発言頻度スコアを組み合わせ、2-5体のキャラクターを選択。
 */
export class CharacterSelector {
  private characters: Character[];

  constructor(characters: Character[] = []) {
    this.characters = characters.length > 0 ? characters : this.loadDefaultCharacters();
  }

  /**
   * デフォルトキャラクターを読み込み
   */
  private loadDefaultCharacters(): Character[] {
    return characters;
  }

  /**
   * キャラクター選択
   *
   * 投稿内容に応じて反応するキャラクターを2-5体選択する。
   *
   * @param userPost - ユーザー投稿内容
   * @param threadHistory - スレッド履歴（未使用、将来のLLM判定方式用）
   * @param minCount - 最小選択数（デフォルト: 2）
   * @param maxCount - 最大選択数（デフォルト: 5）
   * @returns 選択されたキャラクター配列
   */
  selectCharacters(
    userPost: string,
    threadHistory?: Post[],
    minCount: number = 2,
    maxCount: number = 5
  ): Character[] {
    return this.selectByKeywords(userPost, minCount, maxCount);
  }

  /**
   * キーワードマッチング方式でキャラクター選択
   *
   * アルゴリズム:
   * 1. キーワードマッチングスコア計算（0-100点）
   * 2. 発言頻度スコア計算（0-100点）
   * 3. 総合スコア計算（70%:30%の加重平均）
   * 4. スコア30点以上を抽出し、上位から2-5体をランダムに選択
   *
   * @param userPost - ユーザー投稿内容
   * @param minCount - 最小選択数
   * @param maxCount - 最大選択数
   * @returns 選択されたキャラクター配列
   */
  selectByKeywords(userPost: string, minCount: number = 2, maxCount: number = 5): Character[] {
    // 全キャラクターのスコアを計算
    const scores: CharacterScore[] = this.characters.map((character) => {
      const keywordScore = this.calculateKeywordScore(userPost, character);
      const frequencyScore = this.calculateFrequencyScore(character);
      const totalScore = this.calculateTotalScore(keywordScore, frequencyScore);

      return {
        character,
        keywordScore,
        frequencyScore,
        totalScore,
      };
    });

    // スコア30点以上を抽出
    let candidates = scores.filter((score) => score.totalScore >= 30);

    // 候補が不足している場合、全キャラクターから選択
    if (candidates.length < minCount) {
      candidates = scores;
    }

    // スコア順にソート（降順）
    candidates.sort((a, b) => b.totalScore - a.totalScore);

    // 候補がminCount以下の場合は全て返す
    if (candidates.length <= minCount) {
      return candidates.map((s) => s.character);
    }

    // 選択数を決定（minCount以上、maxCount以下、候補数以下）
    const targetCount = Math.min(
      Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount,
      candidates.length
    );

    // 上位からtargetCount体を選択（ランダム性を持たせるため若干シャッフル）
    const selected: Character[] = [];
    const pool = candidates.slice(0, Math.min(targetCount + 2, candidates.length));

    // プールからランダムに選択
    for (let i = 0; i < targetCount && pool.length > 0; i++) {
      const index = Math.floor(Math.random() * pool.length);
      selected.push(pool[index].character);
      pool.splice(index, 1);
    }

    return selected;
  }

  /**
   * キーワードマッチングスコア計算
   *
   * 投稿内容に含まれるキャラクターのキーワードの数に応じてスコアを算出:
   * - マッチ0個 → 0点
   * - マッチ1個 → 50点
   * - マッチ2個 → 75点
   * - マッチ3個以上 → 100点
   *
   * @param userPost - ユーザー投稿内容
   * @param character - キャラクター
   * @returns キーワードスコア（0-100）
   */
  private calculateKeywordScore(userPost: string, character: Character): number {
    const lowerPost = userPost.toLowerCase();
    const matchCount = character.keywords.filter((keyword) =>
      lowerPost.includes(keyword.toLowerCase())
    ).length;

    if (matchCount === 0) return 0;
    if (matchCount === 1) return 50;
    if (matchCount === 2) return 75;
    return 100; // 3個以上
  }

  /**
   * 発言頻度スコア計算
   *
   * キャラクターの発言頻度設定（1-10）を0-100点にマッピング:
   * 発言頻度スコア = (frequency / 10) × 100
   *
   * @param character - キャラクター
   * @returns 発言頻度スコア（0-100）
   */
  private calculateFrequencyScore(character: Character): number {
    return (character.frequency / 10) * 100;
  }

  /**
   * 総合スコア計算
   *
   * キーワードスコアと発言頻度スコアの加重平均:
   * 総合スコア = (キーワードスコア × 70%) + (発言頻度スコア × 30%)
   *
   * @param keywordScore - キーワードスコア
   * @param frequencyScore - 発言頻度スコア
   * @returns 総合スコア（0-100）
   */
  private calculateTotalScore(keywordScore: number, frequencyScore: number): number {
    return keywordScore * 0.7 + frequencyScore * 0.3;
  }
}
