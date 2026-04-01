import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Layer 1（純粋ロジック）は node 環境、Layer 2（DOM依存）は jsdom 環境
    // ファイルパスのパターンで環境を切り替える
    environmentMatchGlobs: [
      ['tests/dom/**', 'jsdom'],
      ['tests/integration/**', 'jsdom'],  // 統合テストは jsdom 環境で実行
    ],
    environment: 'node',

    // テストファイルの場所
    include: ['tests/**/*.test.js'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js'],
      exclude: [
        'js/main.js',          // エントリーポイント（統合テストの対象）
        'js/event-manager.js', // UIイベント（統合テストの対象）
        'js/ui.js',            // 表示制御（統合テストの対象）
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },

    // テスト結果の表示
    reporters: ['verbose'],
  },
});
