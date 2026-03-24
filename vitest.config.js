import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js'],
        // E2Eテスト（Playwright）をvitestの対象から除外
        exclude: [
            '**/node_modules/**',
            '**/tests/e2e/**',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['js/**/*.js'],
            exclude: [
                'js/main.js',
                'js/progress-indicator.js',
            ],
        },
    },
});
