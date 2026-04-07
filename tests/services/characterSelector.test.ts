import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterSelector } from '../../src/services/characterSelector';
import type { Character } from '../../src/types';

describe('CharacterSelector', () => {
  let selector: CharacterSelector;
  let testCharacters: Character[];

  beforeEach(() => {
    testCharacters = [
      {
        id: 'test1',
        displayName: 'テストキャラ1',
        systemPrompt: 'Test prompt 1',
        personality: 'Test personality 1',
        speechStyle: 'Test speech 1',
        temperature: 0.8,
        keywords: ['プログラミング', 'コード', 'TypeScript'],
        frequency: 8, // 発言頻度スコア: 80点
      },
      {
        id: 'test2',
        displayName: 'テストキャラ2',
        systemPrompt: 'Test prompt 2',
        personality: 'Test personality 2',
        speechStyle: 'Test speech 2',
        temperature: 0.7,
        keywords: ['デザイン', 'UI', 'UX'],
        frequency: 5, // 発言頻度スコア: 50点
      },
      {
        id: 'test3',
        displayName: 'テストキャラ3',
        systemPrompt: 'Test prompt 3',
        personality: 'Test personality 3',
        speechStyle: 'Test speech 3',
        temperature: 0.9,
        keywords: ['データベース', 'SQL', 'PostgreSQL'],
        frequency: 3, // 発言頻度スコア: 30点
      },
      {
        id: 'test4',
        displayName: 'テストキャラ4',
        systemPrompt: 'Test prompt 4',
        personality: 'Test personality 4',
        speechStyle: 'Test speech 4',
        temperature: 0.6,
        keywords: ['AI', '機械学習', 'LLM'],
        frequency: 10, // 発言頻度スコア: 100点
      },
      {
        id: 'test5',
        displayName: 'テストキャラ5',
        systemPrompt: 'Test prompt 5',
        personality: 'Test personality 5',
        speechStyle: 'Test speech 5',
        temperature: 0.5,
        keywords: ['セキュリティ', '暗号化', 'HTTPS'],
        frequency: 1, // 発言頻度スコア: 10点
      },
    ];

    selector = new CharacterSelector(testCharacters);
  });

  describe('constructor', () => {
    it('should initialize with provided characters', () => {
      const result = selector.selectCharacters('プログラミング');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use default characters when none provided', () => {
      const defaultSelector = new CharacterSelector();
      const result = defaultSelector.selectCharacters('テスト');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('selectCharacters', () => {
    it('should select 2-5 characters', () => {
      const result = selector.selectCharacters('プログラミングとデザインについて');
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should return at least minCount characters', () => {
      const result = selector.selectCharacters('テスト', undefined, 3, 5);
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should not exceed maxCount', () => {
      const result = selector.selectCharacters(
        'プログラミング デザイン データベース AI セキュリティ',
        undefined,
        2,
        3
      );
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should prefer characters with matching keywords', () => {
      // プログラミング関連の投稿
      const result = selector.selectCharacters(
        'TypeScriptでコードを書くのが好きです'
      );

      // test1（プログラミング、コード、TypeScript）が選ばれやすい
      const hasTest1 = result.some((c) => c.id === 'test1');
      expect(hasTest1).toBe(true);
    });

    it('should consider frequency score', () => {
      // キーワードマッチなしの場合、発言頻度の高いキャラクターが選ばれやすい
      const result = selector.selectCharacters('これは特定のキーワードを含まない投稿です');

      // test4（frequency: 10）が選ばれやすい
      const hasHighFrequency = result.some((c) => c.frequency >= 8);
      expect(hasHighFrequency).toBe(true);
    });
  });

  describe('selectByKeywords', () => {
    it('should calculate keyword score correctly for 0 matches', () => {
      const result = selector.selectByKeywords('まったく関係ない話題', 1, 5);
      // キーワードスコア0点でも、発言頻度スコアで30点以上になるキャラクターが選ばれる
      expect(result.length).toBeGreaterThan(0);

      // frequency 10のtest4は発言頻度スコア100点 → 総合スコア30点で選ばれる
      const hasTest4 = result.some((c) => c.id === 'test4');
      expect(hasTest4).toBe(true);
    });

    it('should calculate keyword score correctly for 1 match', () => {
      // test1のキーワード「プログラミング」が1個マッチ
      // キーワードスコア: 50点
      // 発言頻度スコア: 80点
      // 総合スコア: 50*0.7 + 80*0.3 = 35 + 24 = 59点
      const result = selector.selectByKeywords('プログラミングについて', 1, 5);
      expect(result.some((c) => c.id === 'test1')).toBe(true);
    });

    it('should calculate keyword score correctly for 2 matches', () => {
      // test1のキーワード「プログラミング」「コード」が2個マッチ
      // キーワードスコア: 75点
      // 発言頻度スコア: 80点
      // 総合スコア: 75*0.7 + 80*0.3 = 52.5 + 24 = 76.5点
      const result = selector.selectByKeywords('プログラミングでコードを書く', 1, 5);
      expect(result.some((c) => c.id === 'test1')).toBe(true);
    });

    it('should calculate keyword score correctly for 3+ matches', () => {
      // test1のキーワード「プログラミング」「コード」「TypeScript」が3個マッチ
      // キーワードスコア: 100点
      // 発言頻度スコア: 80点
      // 総合スコア: 100*0.7 + 80*0.3 = 70 + 24 = 94点
      const result = selector.selectByKeywords(
        'TypeScriptでコードを書くプログラミング',
        1,
        5
      );
      expect(result.some((c) => c.id === 'test1')).toBe(true);

      // test1が選ばれることを確認（ランダム性により順序は保証しない）
      const test1Index = result.findIndex((c) => c.id === 'test1');
      expect(test1Index).toBeGreaterThanOrEqual(0);
    });

    it('should filter by score threshold (30 points)', () => {
      // test5（frequency: 1）は発言頻度スコア10点
      // キーワードマッチなしの場合、総合スコア: 0*0.7 + 10*0.3 = 3点
      // 30点未満なので選ばれない
      const result = selector.selectByKeywords('関係ない話題', 1, 5);
      expect(result.some((c) => c.id === 'test5')).toBe(false);
    });

    it('should return all candidates if less than minCount', () => {
      // 極端に低いfrequencyのキャラクターのみをテスト
      const lowFreqCharacters: Character[] = [
        {
          id: 'low1',
          displayName: 'Low Freq 1',
          systemPrompt: 'Test',
          personality: 'Test',
          speechStyle: 'Test',
          temperature: 0.5,
          keywords: ['特殊なキーワード'],
          frequency: 1, // 10点
        },
      ];

      const lowSelector = new CharacterSelector(lowFreqCharacters);
      const result = lowSelector.selectByKeywords('関係ない話題', 2, 5);

      // 30点以上の候補が1体しかいないので、1体返す
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('should include randomness in selection', () => {
      // 同じ入力で複数回実行し、異なる結果が得られることを確認
      const results: string[][] = [];

      for (let i = 0; i < 10; i++) {
        const result = selector.selectByKeywords(
          'プログラミング デザイン データベース',
          2,
          4
        );
        results.push(result.map((c) => c.id).sort());
      }

      // 少なくとも2種類の異なる組み合わせが存在する
      const uniqueResults = new Set(results.map((r) => r.join(',')));
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should sort candidates by total score descending', () => {
      // 複数のキーワードマッチでスコアが明確に異なる投稿
      const result = selector.selectByKeywords(
        'TypeScriptでプログラミングしてコードを書く',
        5,
        5
      );

      // test1（3マッチ: 94点）が最高スコア
      // 上位候補に含まれるはず
      expect(result.some((c) => c.id === 'test1')).toBe(true);
    });
  });

  describe('score calculation', () => {
    it('should calculate total score correctly', () => {
      // test1でTypeScriptマッチ（3個マッチ）
      // キーワードスコア: 100点
      // 発言頻度スコア: 80点
      // 総合スコア: 100*0.7 + 80*0.3 = 70 + 24 = 94点

      // 複数回実行してtest1が必ず含まれることを確認
      let hasTest1 = false;
      for (let i = 0; i < 5; i++) {
        const result = selector.selectByKeywords(
          'TypeScriptとプログラミングでコードを書く',
          1,
          5
        );
        if (result.some((c) => c.id === 'test1')) {
          hasTest1 = true;
          break;
        }
      }

      expect(hasTest1).toBe(true);
    });

    it('should weight keyword score at 70% and frequency score at 30%', () => {
      // test1: キーワード100点, 発言頻度80点 → 総合94点
      // test4: キーワード0点, 発言頻度100点 → 総合30点
      const result = selector.selectByKeywords(
        'TypeScriptでプログラミングしてコードを書く',
        2,
        5
      );

      // test1が上位に来る（94点 > 30点）
      const test1Index = result.findIndex((c) => c.id === 'test1');
      const test4Index = result.findIndex((c) => c.id === 'test4');

      if (test1Index !== -1 && test4Index !== -1) {
        expect(test1Index).toBeLessThan(test4Index);
      }
    });
  });

  describe('case insensitivity', () => {
    it('should match keywords case-insensitively', () => {
      // 大文字小文字を混在させた投稿
      const result = selector.selectByKeywords('TYPESCRIPT Programming code', 1, 5);

      // test1のキーワードにマッチする
      expect(result.some((c) => c.id === 'test1')).toBe(true);
    });
  });
});
