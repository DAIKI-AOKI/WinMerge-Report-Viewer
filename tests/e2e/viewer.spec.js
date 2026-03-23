// tests/e2e/viewer.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// デバッグ用：コンソールエラーを出力
test('デバッグ：コンソールエラー確認', async ({ page }) => {
    const errors = [];
    const logs = [];
    page.on('console', msg => {
        // すべてのコンソール出力を収集
        logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
        errors.push(err.stack || err.message);
    });

    await page.goto(APP_URL);

    const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
    await page.locator('#fileInput').setInputFiles(filePath);
    await page.waitForTimeout(5000);

    console.log('=== pageerror（生のスタック）===');
    errors.forEach(e => console.log(e));
    console.log('=== 全コンソール出力 ===');
    // errorとwarnのみ表示
    logs.filter(l => l.startsWith('[error]') || l.startsWith('[warn]'))
        .forEach(l => console.log(l));
});

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

        // テーブルが表示されるまで待機
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
        // 差分情報が更新される
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
        // 少なくとも1件以上のマーカーが存在する
        await expect(page.locator('#locationPane .marker').first()).toBeVisible({ timeout: 5000 });
        // sample.htm には差分行が2行あるので2件のマーカーが生成される
        await expect(page.locator('#locationPane .marker')).toHaveCount(2);
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

        // XSSペイロードを埋め込んだHTMファイルを生成
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

        // XSSが実行されていないことを確認
        const xssExecuted = await page.evaluate(() => window.__xss);
        expect(xssExecuted).toBeUndefined();
    });
});

// ========================================
// サニタイズ（ブラウザ環境での動作確認）
// ========================================
test.describe('サニタイズ - 不許可タグの除去', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);
    });

    test('p タグはテキストが保持される（DOMParserでは除去不可）', async ({ page }) => {
        const result = await page.evaluate(() => {
            return WinMergeViewer.HTMLProcessor.sanitize('<p>本文テキスト</p>');
        });
        expect(result).toContain('本文テキスト');
    });

    test('a タグはテキストが保持される（DOMParserでは除去不可）', async ({ page }) => {
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
        // #viewer 内のテーブルに絞る
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