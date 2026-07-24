import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    // ブラウザで動く js/ フォルダのファイル
    files: ['js/**/*.js', '_legacy/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Vitest（Node.js環境で動くテストコード）
    files: ['tests/unit/**/*.js', 'tests/dom/**/*.js', 'tests/integration/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    // Playwright（E2Eテストコード）
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // node_modules や coverage レポートなどはチェック対象外にする
    ignores: ['node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
];