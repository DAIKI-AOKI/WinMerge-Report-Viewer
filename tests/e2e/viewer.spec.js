// tests/e2e/viewer.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = 'http://localhost:5500';

// ========================================
// ファイル読み込み
// ========================================
test.describe('ファイル読み込み', () => {

    test('ページが正常に表示される', async ({ page }) => {
        await page.goto(APP_URL);
        await expect(page).toHaveTitle('WinMerge Report Viewer');
        await expect(page.locator('#dropArea')).toBeVisible();
    });

    test('HTMファイルを読み込むと差分テーブルが表示される', async ({ page }) => {
        await page.goto(APP_URL);

        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);

        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });
    });

    test('ファイル読み込み後にドロップエリアが非表示になる', async ({ page }) => {
        await page.goto(APP_URL);

        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);

        await expect(page.locator('#dropArea')).toBeHidden({ timeout: 5000 });
    });

    test('ファイル読み込み後にナビゲーションボタンが表示される', async ({ page }) => {
        await page.goto(APP_URL);

        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);

        await expect(page.locator('#nextDiffButton')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#prevDiffButton')).toBeVisible({ timeout: 5000 });
    });
});

// ========================================
// 差分ナビゲーション
// ========================================
test.describe('差分ナビゲーション', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });
    });

    test('「次の差分」ボタンで差分にジャンプする', async ({ page }) => {
        await page.locator('#nextDiffButton').click();
        await expect(page.locator('#diffInfo')).toContainText('差分: 1');
    });

    test('「前の差分」ボタンで差分にジャンプする', async ({ page }) => {
        // 一度次へ進んでから前へ戻る
        await page.locator('#nextDiffButton').click();
        await page.locator('#nextDiffButton').click();
        await page.locator('#prevDiffButton').click();
        await expect(page.locator('#diffInfo')).toContainText('差分: 1');
    });

    test('ミニマップのマーカーが表示される', async ({ page }) => {
        // v2 では locationPaneLeft / locationPaneRight の2ペインにそれぞれマーカーが生成される。
        // 差分ブロックの左右の色の有無によって総数が変わるため、
        // 絶対数ではなく「1件以上存在すること」と「左右ペイン個別の存在」を確認する。
        await expect(page.locator('#locationPaneLeft .marker').first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#locationPaneRight .marker').first()).toBeVisible({ timeout: 5000 });
        const count = await page.locator('#locationPane .marker').count();
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

// ========================================
// リセット
// ========================================
test.describe('リセット', () => {

    test('更新ボタンでドロップエリアに戻る', async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });

        await page.locator('#resetButton').click();
        await expect(page.locator('#dropArea')).toBeVisible({ timeout: 3000 });
    });
});

// ========================================
// セキュリティ
// ========================================
test.describe('セキュリティ', () => {

    test('scriptタグを含むファイルを読み込んでもXSSが発生しない', async ({ page }) => {
        await page.goto(APP_URL);

        const xssContent = `
            <table class="diff">
                <tr><td onclick="alert('XSS')">テスト</td></tr>
                <script>window.__xss = true;</script>
            </table>
        `;
        const buffer = Buffer.from(xssContent);
        await page.locator('#fileInput').setInputFiles({
            name: 'xss-test.htm',
            mimeType: 'text/html',
            buffer,
        });

        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });

        const xssExecuted = await page.evaluate(() => window.__xss);
        expect(xssExecuted).toBeUndefined();
    });
});

// ========================================
// サニタイズ（ブラウザ環境での動作確認）
// ========================================
test.describe('サニタイズ - 非許可タグの除外', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);
    });

    test('p タグはテキストが保持される（DOMParserでは除外不可）', async ({ page }) => {
        const result = await page.evaluate(() => {
            return WinMergeViewer.HTMLProcessor.sanitize('<p>本文テキスト</p>');
        });
        expect(result).toContain('本文テキスト');
    });

    test('a タグはテキストが保持される（DOMParserでは除外不可）', async ({ page }) => {
        const result = await page.evaluate(() => {
            return WinMergeViewer.HTMLProcessor.sanitize('<a href="http://example.com">リンク</a>');
        });
        expect(result).toContain('リンク');
    });
});

// ========================================
// 実WinMergeファイルでの動作確認
// ========================================
test.describe('実WinMergeファイル - small-file.htm', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/small-file.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('#viewer table')).toBeVisible({ timeout: 10000 });
    });

    test('差分テーブルが表示される', async ({ page }) => {
        await expect(page.locator('#viewer table')).toBeVisible();
    });

    test('ミニマップにマーカーが表示される', async ({ page }) => {
        await expect(page.locator('#locationPane .marker').first()).toBeVisible({ timeout: 5000 });
    });

    test('差分情報が表示される', async ({ page }) => {
        await expect(page.locator('#diffInfo')).toBeVisible({ timeout: 5000 });
    });

    test('「次の差分」で正しくナビゲーションできる', async ({ page }) => {
        await page.locator('#nextDiffButton').click();
        await expect(page.locator('#diffInfo')).toContainText('差分: 1');
    });
});

test.describe('実WinMergeファイル - middle-file.htm', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/middle-file.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('#viewer table')).toBeVisible({ timeout: 10000 });
    });

    test('差分テーブルが表示される', async ({ page }) => {
        await expect(page.locator('#viewer table')).toBeVisible();
    });

    test('ミニマップにマーカーが表示される', async ({ page }) => {
        await expect(page.locator('#locationPane .marker').first()).toBeVisible({ timeout: 5000 });
    });

    test('リセット後に再読み込みできる', async ({ page }) => {
        await page.locator('#resetButton').click();
        await expect(page.locator('#dropArea')).toBeVisible({ timeout: 3000 });

        const filePath = path.resolve(__dirname, '../fixtures/middle-file.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('#viewer table')).toBeVisible({ timeout: 10000 });
    });
});

test.describe('実WinMergeファイル - large-file.htm（性能テスト）', () => {

    test('1.1MBのファイルを10秒以内に処理できる', async ({ page }) => {
        await page.goto(APP_URL);

        const start = Date.now();
        const filePath = path.resolve(__dirname, '../fixtures/large-file.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('#viewer table')).toBeVisible({ timeout: 10000 });
        const elapsed = Date.now() - start;

        console.log(`large-file.htm 処理時間: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(10000);
    });

    test('大きなファイルでもミニマップが表示される', async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/large-file.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('#viewer table')).toBeVisible({ timeout: 10000 });

        await expect(page.locator('#locationPane .marker').first()).toBeVisible({ timeout: 5000 });
    });
});
