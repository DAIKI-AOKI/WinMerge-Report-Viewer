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
});
