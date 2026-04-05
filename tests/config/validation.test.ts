import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const rootDir = join(__dirname, '../..');

describe('Configuration Files Validation', () => {
  describe('package.json', () => {
    it('should exist', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);
    });

    it('should have valid JSON structure', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have required scripts', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.dev).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.lint).toBeDefined();
      expect(packageJson.scripts.format).toBeDefined();
    });

    it('should have required dependencies', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.dependencies.hono).toBeDefined();
      expect(packageJson.dependencies['@hono/node-server']).toBeDefined();
      expect(packageJson.dependencies.zod).toBeDefined();
      expect(packageJson.dependencies.pg).toBeDefined();
    });

    it('should have required devDependencies', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.devDependencies.typescript).toBeDefined();
      expect(packageJson.devDependencies.tsx).toBeDefined();
      expect(packageJson.devDependencies.eslint).toBeDefined();
      expect(packageJson.devDependencies.prettier).toBeDefined();
      expect(packageJson.devDependencies.vitest).toBeDefined();
    });

    it('should have type: module', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.type).toBe('module');
    });
  });

  describe('tsconfig.json', () => {
    it('should exist', () => {
      const tsconfigPath = join(rootDir, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);
    });

    it('should have valid JSON structure', () => {
      const tsconfigPath = join(rootDir, 'tsconfig.json');
      const content = readFileSync(tsconfigPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have Hono JSX configuration', () => {
      const tsconfigPath = join(rootDir, 'tsconfig.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
      expect(tsconfig.compilerOptions.jsxImportSource).toBe('hono/jsx');
    });

    it('should have strict mode enabled', () => {
      const tsconfigPath = join(rootDir, 'tsconfig.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('should target ES2022', () => {
      const tsconfigPath = join(rootDir, 'tsconfig.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.compilerOptions.target).toBe('ES2022');
    });
  });

  describe('eslint.config.js', () => {
    it('should exist', () => {
      const eslintConfigPath = join(rootDir, 'eslint.config.js');
      expect(existsSync(eslintConfigPath)).toBe(true);
    });
  });

  describe('.prettierrc', () => {
    it('should exist', () => {
      const prettierrcPath = join(rootDir, '.prettierrc');
      expect(existsSync(prettierrcPath)).toBe(true);
    });

    it('should have valid JSON structure', () => {
      const prettierrcPath = join(rootDir, '.prettierrc');
      const content = readFileSync(prettierrcPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have recommended settings', () => {
      const prettierrcPath = join(rootDir, '.prettierrc');
      const prettierrc = JSON.parse(readFileSync(prettierrcPath, 'utf-8'));

      expect(prettierrc.semi).toBe(true);
      expect(prettierrc.singleQuote).toBe(true);
      expect(prettierrc.printWidth).toBe(100);
      expect(prettierrc.tabWidth).toBe(2);
    });
  });

  describe('vitest.config.ts', () => {
    it('should exist', () => {
      const vitestConfigPath = join(rootDir, 'vitest.config.ts');
      expect(existsSync(vitestConfigPath)).toBe(true);
    });
  });
});
