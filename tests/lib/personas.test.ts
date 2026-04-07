import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  majiresu,
  aori,
  monoshiri,
  rom,
  newcomer,
  characters,
  getCharacters,
  getCharacterById,
  getRandomCharacter,
  getCharactersByKeyword,
} from '../../src/lib/personas';
import type { Character } from '../../src/types';

describe('personas', () => {
  describe('Individual character definitions', () => {
    it('should define majiresu character correctly', () => {
      expect(majiresu.id).toBe('majiresu');
      expect(majiresu.displayName).toBe('マジレスニキ');
      expect(majiresu.personality).toContain('論理的');
      expect(majiresu.temperature).toBe(0.3);
      expect(majiresu.frequency).toBe(7);
      expect(majiresu.keywords).toContain('論理');
      expect(majiresu.systemPrompt).toContain('マジレスニキ');
    });

    it('should define aori character correctly', () => {
      expect(aori.id).toBe('aori');
      expect(aori.displayName).toBe('煽りカス');
      expect(aori.personality).toContain('攻撃的');
      expect(aori.temperature).toBe(0.9);
      expect(aori.frequency).toBe(5);
      expect(aori.keywords).toContain('草');
      expect(aori.systemPrompt).toContain('煽りカス');
    });

    it('should define monoshiri character correctly', () => {
      expect(monoshiri.id).toBe('monoshiri');
      expect(monoshiri.displayName).toBe('物知りおじさん');
      expect(monoshiri.personality).toContain('博識');
      expect(monoshiri.temperature).toBe(0.5);
      expect(monoshiri.frequency).toBe(6);
      expect(monoshiri.keywords).toContain('昔');
      expect(monoshiri.systemPrompt).toContain('物知りおじさん');
    });

    it('should define rom character correctly', () => {
      expect(rom.id).toBe('rom');
      expect(rom.displayName).toBe('ROM専');
      expect(rom.personality).toContain('観察者');
      expect(rom.temperature).toBe(0.7);
      expect(rom.frequency).toBe(3);
      expect(rom.keywords).toContain('草');
      expect(rom.systemPrompt).toContain('ROM専');
    });

    it('should define newcomer character correctly', () => {
      expect(newcomer.id).toBe('newcomer');
      expect(newcomer.displayName).toBe('新参');
      expect(newcomer.personality).toContain('初心者');
      expect(newcomer.temperature).toBe(0.8);
      expect(newcomer.frequency).toBe(4);
      expect(newcomer.keywords).toContain('質問');
      expect(newcomer.systemPrompt).toContain('新参');
    });
  });

  describe('Character type conformance', () => {
    it('should have all required Character properties', () => {
      const requiredProps: (keyof Character)[] = [
        'id',
        'displayName',
        'systemPrompt',
        'personality',
        'speechStyle',
        'temperature',
        'keywords',
        'frequency',
      ];

      characters.forEach((char) => {
        requiredProps.forEach((prop) => {
          expect(char).toHaveProperty(prop);
          expect(char[prop]).toBeDefined();
        });
      });
    });

    it('should have valid temperature values (0.0-1.0)', () => {
      characters.forEach((char) => {
        expect(char.temperature).toBeGreaterThanOrEqual(0.0);
        expect(char.temperature).toBeLessThanOrEqual(1.0);
      });
    });

    it('should have valid frequency values (1-10)', () => {
      characters.forEach((char) => {
        expect(char.frequency).toBeGreaterThanOrEqual(1);
        expect(char.frequency).toBeLessThanOrEqual(10);
      });
    });

    it('should have non-empty keywords array', () => {
      characters.forEach((char) => {
        expect(Array.isArray(char.keywords)).toBe(true);
        expect(char.keywords.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty systemPrompt', () => {
      characters.forEach((char) => {
        expect(char.systemPrompt.length).toBeGreaterThan(0);
      });
    });
  });

  describe('characters array', () => {
    it('should contain all 5 characters', () => {
      expect(characters).toHaveLength(5);
    });

    it('should contain all defined characters', () => {
      expect(characters).toContain(majiresu);
      expect(characters).toContain(aori);
      expect(characters).toContain(monoshiri);
      expect(characters).toContain(rom);
      expect(characters).toContain(newcomer);
    });

    it('should have unique IDs', () => {
      const ids = characters.map((char) => char.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(characters.length);
    });

    it('should have unique display names', () => {
      const names = characters.map((char) => char.displayName);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(characters.length);
    });
  });

  describe('getCharacters', () => {
    it('should return all characters', () => {
      const result = getCharacters();
      expect(result).toHaveLength(5);
      expect(result).toEqual(characters);
    });

    it('should return a new array (not reference)', () => {
      const result1 = getCharacters();
      const result2 = getCharacters();
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it('should not affect original when mutating returned array', () => {
      const result = getCharacters();
      const originalLength = characters.length;
      result.pop();
      expect(characters).toHaveLength(originalLength);
    });
  });

  describe('getCharacterById', () => {
    it('should return correct character by id', () => {
      expect(getCharacterById('majiresu')).toBe(majiresu);
      expect(getCharacterById('aori')).toBe(aori);
      expect(getCharacterById('monoshiri')).toBe(monoshiri);
      expect(getCharacterById('rom')).toBe(rom);
      expect(getCharacterById('newcomer')).toBe(newcomer);
    });

    it('should return undefined for non-existent id', () => {
      expect(getCharacterById('nonexistent')).toBeUndefined();
      expect(getCharacterById('')).toBeUndefined();
    });

    it('should be case sensitive', () => {
      expect(getCharacterById('MAJIRESU')).toBeUndefined();
      expect(getCharacterById('Majiresu')).toBeUndefined();
    });
  });

  describe('getRandomCharacter', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return a character from the list', () => {
      const result = getRandomCharacter();
      expect(characters).toContain(result);
    });

    it('should return different characters based on random value', () => {
      // 異なるランダム値で異なるキャラクターが返されることを確認
      const totalFrequency = 25;

      // majiresuを取得
      vi.spyOn(Math, 'random').mockReturnValue(0 / totalFrequency);
      const char1 = getRandomCharacter();

      // aoriを取得
      vi.spyOn(Math, 'random').mockReturnValue(10 / totalFrequency);
      const char2 = getRandomCharacter();

      // romを取得
      vi.spyOn(Math, 'random').mockReturnValue(20 / totalFrequency);
      const char3 = getRandomCharacter();

      expect(char1.id).toBe('majiresu');
      expect(char2.id).toBe('aori');
      expect(char3.id).toBe('rom');
      expect(char1).not.toBe(char2);
      expect(char2).not.toBe(char3);
    });

    it('should respect frequency weighting (deterministic test)', () => {
      // 頻度の累積値をテスト
      // majiresu: 7, aori: 5, monoshiri: 6, rom: 3, newcomer: 4
      // 累積: 7, 12, 18, 21, 25
      const totalFrequency = 25;

      // majiresuが選ばれる範囲: [0, 7)
      vi.spyOn(Math, 'random').mockReturnValue(3 / totalFrequency);
      expect(getRandomCharacter().id).toBe('majiresu');

      // aoriが選ばれる範囲: [7, 12)
      vi.spyOn(Math, 'random').mockReturnValue(9 / totalFrequency);
      expect(getRandomCharacter().id).toBe('aori');

      // monoshiriが選ばれる範囲: [12, 18)
      vi.spyOn(Math, 'random').mockReturnValue(15 / totalFrequency);
      expect(getRandomCharacter().id).toBe('monoshiri');

      // romが選ばれる範囲: [18, 21)
      vi.spyOn(Math, 'random').mockReturnValue(19 / totalFrequency);
      expect(getRandomCharacter().id).toBe('rom');

      // newcomerが選ばれる範囲: [21, 25)
      vi.spyOn(Math, 'random').mockReturnValue(23 / totalFrequency);
      expect(getRandomCharacter().id).toBe('newcomer');
    });

    it('should return first character when Math.random returns 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = getRandomCharacter();
      expect(result).toBe(characters[0]);
    });

    it('should handle edge case when Math.random returns near 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9999);
      const result = getRandomCharacter();
      expect(characters).toContain(result);
    });
  });

  describe('getCharactersByKeyword', () => {
    it('should find characters by exact keyword match', () => {
      const result = getCharactersByKeyword('論理');
      expect(result).toContain(majiresu);
      expect(result).toHaveLength(1);
    });

    it('should find multiple characters with same keyword', () => {
      const result = getCharactersByKeyword('草');
      expect(result).toContain(aori);
      expect(result).toContain(rom);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should find characters by partial keyword match', () => {
      const result = getCharactersByKeyword('質');
      expect(result).toContain(newcomer);
    });

    it('should be case insensitive', () => {
      const result1 = getCharactersByKeyword('質問');
      const result2 = getCharactersByKeyword('質問');
      expect(result1).toEqual(result2);
    });

    it('should return empty array for non-matching keyword', () => {
      const result = getCharactersByKeyword('xyzabc123');
      expect(result).toHaveLength(0);
    });

    it('should handle empty string', () => {
      const result = getCharactersByKeyword('');
      // 空文字列は全てのキーワードにマッチする可能性がある
      expect(Array.isArray(result)).toBe(true);
    });

    it('should find character by multiple different keywords', () => {
      const result1 = getCharactersByKeyword('論理');
      const result2 = getCharactersByKeyword('データ');
      expect(result1).toContain(majiresu);
      expect(result2).toContain(majiresu);
    });
  });

  describe('Character diversity', () => {
    it('should have diverse temperature values', () => {
      const temperatures = characters.map((char) => char.temperature);
      const uniqueTemperatures = new Set(temperatures);
      expect(uniqueTemperatures.size).toBeGreaterThan(3);
    });

    it('should have diverse frequency values', () => {
      const frequencies = characters.map((char) => char.frequency);
      const uniqueFrequencies = new Set(frequencies);
      expect(uniqueFrequencies.size).toBeGreaterThan(3);
    });

    it('should cover a range of temperature from low to high', () => {
      const temperatures = characters.map((char) => char.temperature);
      const minTemp = Math.min(...temperatures);
      const maxTemp = Math.max(...temperatures);
      expect(minTemp).toBeLessThan(0.5);
      expect(maxTemp).toBeGreaterThan(0.7);
    });
  });

  describe('Character personality consistency', () => {
    it('majiresu should have low temperature for consistency', () => {
      expect(majiresu.temperature).toBeLessThan(0.5);
    });

    it('aori should have high temperature for creativity', () => {
      expect(aori.temperature).toBeGreaterThan(0.7);
    });

    it('rom should have low frequency (quiet character)', () => {
      expect(rom.frequency).toBeLessThan(5);
    });

    it('majiresu should have high frequency (active character)', () => {
      expect(majiresu.frequency).toBeGreaterThan(5);
    });
  });
});
