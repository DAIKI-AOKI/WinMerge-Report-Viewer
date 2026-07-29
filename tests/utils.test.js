/**
 * utils.js のユニットテスト（Vitest / Jest 対応）
 *
 * 実行方法:
 *   npm install -D vitest
 *   npx vitest run
 *
 * 注意: ESM 移行完了後（utils.js の export をコメントインした後）に有効になります。
 *       移行前は utils.js を直接 require して動作確認できます。
 */

// ESM 移行後は下記を有効化:
// import { Utils, CSSManager } from '../js/utils.js';

import { describe, it, expect, vi } from 'vitest';

// ========================================
// Utils.formatFileSize
// ========================================
describe('Utils.formatFileSize', () => {
    it('0バイトを正しくフォーマットする', () => {
        expect(Utils.formatFileSize(0)).toBe('0 B');
    });

    it('キロバイト単位に変換する', () => {
        expect(Utils.formatFileSize(1024)).toBe('1 KB');
    });

    it('メガバイト単位に変換する', () => {
        expect(Utils.formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
    });
});

// ========================================
// Utils.sleep
// ========================================
describe('Utils.sleep', () => {
    it('指定ミリ秒後に解決する Promise を返す', async () => {
        const start = Date.now();
        await Utils.sleep(100);
        expect(Date.now() - start).toBeGreaterThanOrEqual(95); // 誤差 5ms 許容
    });

    it('0ms でも正常に解決する', async () => {
        await expect(Utils.sleep(0)).resolves.toBeUndefined();
    });
});

// ========================================
// Utils.truncateFilename
// ========================================
describe('Utils.truncateFilename', () => {
    it('最大文字数以下のファイル名はそのまま返す', () => {
        const short = 'abc.html';
        expect(Utils.truncateFilename(short)).toBe(short);
    });

    it('長いファイル名を省略して拡張子を保持する', () => {
        const long = 'a'.repeat(100) + '.html';
        const result = Utils.truncateFilename(long);
        expect(result.endsWith('.html')).toBe(true);
        expect(result.includes('...')).toBe(true);
    });
});

// ========================================
// Utils.computeTableHash
// ========================================
describe('Utils.computeTableHash', () => {
    it('null テーブルに対して null を返す', () => {
        expect(Utils.computeTableHash(null)).toBeNull();
    });

    it('同じテーブルは同じハッシュを返す', () => {
        // jsdom 環境でのテスト例
        const table = document.createElement('table');
        table.innerHTML = '<tr><td>A</td></tr><tr><td>B</td></tr>';
        const h1 = Utils.computeTableHash(table);
        const h2 = Utils.computeTableHash(table);
        expect(h1).toBe(h2);
    });

    it('trが1つもないテーブルは0を返す（nullとは別の分岐）', () => {
        const table = document.createElement('table');
        table.innerHTML = '<thead></thead>'; // tr要素を含まない
        expect(Utils.computeTableHash(table)).toBe(0);
    });

    it('31行以上（SAMPLE_SIZE×3を超える）のテーブルでは均等分散サンプリングが行われる', () => {
        // rowCount > SAMPLE_SIZE * 3 (=30) の分岐を通すため、40行のテーブルを用意する
        const table = document.createElement('table');
        table.innerHTML = Array.from(
            { length: 40 },
            (_, i) => `<tr><td>row${i}</td></tr>`
        ).join('');

        const hash = Utils.computeTableHash(table);
        expect(typeof hash).toBe('number');
        expect(hash).toBeGreaterThanOrEqual(0);

        // 内容が変われば別ハッシュになることも確認しておく（サンプリングが実際に効いている確認）
        const table2 = document.createElement('table');
        table2.innerHTML = Array.from(
            { length: 40 },
            (_, i) => `<tr><td>changed-${i}</td></tr>`
        ).join('');
        const hash2 = Utils.computeTableHash(table2);
        expect(hash2).not.toBe(hash);
    });
});

// ========================================
// CSSManager.setVariable / getVariable
// ========================================
describe('CSSManager.setVariable / getVariable', () => {
    it('設定したCSS変数を取得できる', () => {
        CSSManager.setVariable('test-color', '#ff0000');
        expect(CSSManager.getVariable('test-color').trim()).toBe('#ff0000');
    });
});

// ========================================
// CSSManager.hideElement
// ========================================
describe('CSSManager.hideElement', () => {
    it('visibleClass / hiddenClass を明示指定した場合、そのクラス名で切り替える', () => {
        document.body.innerHTML = '<div id="target" class="my-visible"></div>';
        const el = document.getElementById('target');

        CSSManager.hideElement(el, 'my-visible', 'my-hidden');

        expect(el.classList.contains('my-visible')).toBe(false);
        expect(el.classList.contains('my-hidden')).toBe(true);
    });

    it('クラス名未指定時、要素の "-visible" クラスから対応する "-hidden" クラス名を自動判定する', () => {
        // style.css の実際の命名規則（info-visible / info-hidden）に合わせる
        document.body.innerHTML = '<div id="target" class="info-visible"></div>';
        const el = document.getElementById('target');

        CSSManager.hideElement(el);

        expect(el.classList.contains('info-visible')).toBe(false);
        expect(el.classList.contains('info-hidden')).toBe(true);
    });

    it('"-visible" クラスが見つからない場合、button-visible / button-hidden にフォールバックする', () => {
        document.body.innerHTML = '<div id="target" class="something-else"></div>';
        const el = document.getElementById('target');

        CSSManager.hideElement(el);

        expect(el.classList.contains('button-hidden')).toBe(true);
        expect(el.classList.contains('something-else')).toBe(true); // 既存クラスは残る
    });
});
