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
// キーボードショートカット
// ========================================
// document.html「キーボードショートカット」節に記載の4操作を、
// 実ブラウザ上でのキー入力として検証する（tests/integration/
// ui-navigation-flow.test.js の jsdom レベルの検証とは別に、
// 実際のブラウザのキーイベント発火・スムーズスクロール完了まで確認する）。
test.describe('キーボードショートカット', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });
    });

    test('Ctrl+↓ で次の差分へジャンプする', async ({ page }) => {
        await page.keyboard.press('Control+ArrowDown');
        await expect(page.locator('#diffInfo')).toContainText('差分: 1');
    });

    test('Ctrl+↑ で前の差分へ戻る（マウス操作の「前の差分」ボタンと同じ結果になる）', async ({ page }) => {
        await page.locator('#nextDiffButton').click();
        await page.locator('#nextDiffButton').click();
        await page.keyboard.press('Control+ArrowUp');
        await expect(page.locator('#diffInfo')).toContainText('差分: 1');
    });

    test('Home でレポート最上部へスクロールする', async ({ page }) => {
        // 一旦下にスクロールしておく
        await page.evaluate(() => {
            document.getElementById('diffContent').scrollTop = 300;
        });
        await expect
            .poll(async () => page.evaluate(() => document.getElementById('diffContent').scrollTop))
            .toBeGreaterThan(0);

        await page.keyboard.press('Home');

        // smooth scroll の完了を待つ（固定時間ではなくポーリングで確認）
        await expect
            .poll(async () => page.evaluate(() => document.getElementById('diffContent').scrollTop), {
                timeout: 3000,
            })
            .toBe(0);
    });

    test('Esc でリセットされ、ドロップエリアに戻る', async ({ page }) => {
        await page.keyboard.press('Escape');
        await expect(page.locator('#dropArea')).toBeVisible({ timeout: 3000 });
    });
});

// ========================================
// リサイズ（マーカー重複配置の回帰確認）
// ========================================
// 過去、ファイル読み込み直後（マーカーの初回配置がまだ完了しないうち）に
// ウィンドウがリサイズされると、古い配置処理と新しい配置処理が競合し、
// ミニマップのマーカーが重複配置されるバグがあった（世代番号による無効化で
// 修正済み）。jsdom 上で scrollHeight を模擬した Unit テストでは検証済みだが、
// 実ブラウザの実際のタイミングでは未検証だったため、ここで確認する。
test.describe('リサイズ', () => {

    test('ファイル読込直後にウィンドウをリサイズしても、マーカーが重複しない', async ({ page }) => {
        await page.goto(APP_URL);
        const filePath = path.resolve(__dirname, '../fixtures/small-file.htm');

        // 「ファイルをドロップした直後にウィンドウを最大化/リサイズする」という
        // 実際の操作を再現するため、読み込み直後に間髪入れずリサイズする
        await page.locator('#fileInput').setInputFiles(filePath);
        await page.setViewportSize({ width: 1400, height: 900 });

        await expect(page.locator('#viewer table')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#locationPane .marker').first()).toBeVisible({ timeout: 5000 });
        // マーカー配置・リサイズ由来の再配置が完全に落ち着くまで待つ
        await page.waitForTimeout(1000);

        const markerCountAfterFirstResize = await page.locator('#locationPane .marker').count();

        // さらにもう一度リサイズしても、マーカー数が増え続けない（重複が蓄積しない）ことを確認
        await page.setViewportSize({ width: 1100, height: 800 });
        await page.waitForTimeout(500);
        const markerCountAfterSecondResize = await page.locator('#locationPane .marker').count();

        expect(markerCountAfterSecondResize).toBe(markerCountAfterFirstResize);
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

// ========================================
// file:// プロトコルでの起動
// ========================================
// このアプリの中心的な要件（ダウンロードしてダブルクリックするだけで動く）を
// 直接検証する。index.html は type="module" ではなく通常の<script>で
// dist/bundle.js を読み込む構成になっており、これにより file:// で開いても
// ESモジュールのimportに起因するCORSブロックが起きないようにしている。
// npm run build で dist/bundle.js を生成してから実行する必要がある
// （test.yml の e2e-test ジョブでは既にビルド済み）。
test.describe('file:// プロトコルでの起動', () => {
    const fileUrl = 'file://' + path.resolve(__dirname, '../../index.html');

    test('file:// で開いてもページが正常に表示され、コンソールエラーが出ない', async ({ page }) => {
        const consoleErrors = [];
        page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
        });

        await page.goto(fileUrl);

        await expect(page).toHaveTitle('WinMerge Report Viewer');
        await expect(page.locator('#dropArea')).toBeVisible();
        expect(consoleErrors).toEqual([]);
    });

    test('file:// でもファイルの読み込み・差分表示ができる', async ({ page }) => {
        await page.goto(fileUrl);

        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);

        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });
    });

    test('file:// でもキーボードショートカットが動作する', async ({ page }) => {
        await page.goto(fileUrl);
        const filePath = path.resolve(__dirname, '../fixtures/sample.htm');
        await page.locator('#fileInput').setInputFiles(filePath);
        await expect(page.locator('table.diff')).toBeVisible({ timeout: 5000 });

        await page.keyboard.press('Control+ArrowDown');
        await expect(page.locator('#diffInfo')).toContainText('差分: 1');
    });
});
