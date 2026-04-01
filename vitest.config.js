import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // グローバル変数（AppState, Logger, CONFIG 等）を setup.js で注入するために必要
        globals: true,

        // 全テストを jsdom 環境で実行（DOM 操作を含むテストが多いため）
        environment: 'jsdom',

        // グローバル変数の注入・モック定義
        setupFiles: ['./tests/setup.js'],

        // E2Eテスト（Playwright）を Vitest の対象から除外
        exclude: [
            '**/node_modules/**',
            '**/tests/e2e/**',
        ],

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
