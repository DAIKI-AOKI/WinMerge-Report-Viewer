// playwright.config.js
import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:5500',
        headless: true,       // falseにすると実際のブラウザが開いて動作を目視確認できる
        screenshot: 'only-on-failure',  // 失敗時のみスクリーンショットを保存
    },
    webServer: {
        command: 'npx serve . -p 5500',
        url: 'http://localhost:5500',
        timeout: 30000,
        reuseExistingServer: !process.env.CI,
    },
});
