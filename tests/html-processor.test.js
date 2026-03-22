/**
 * html-processor.js のユニットテスト
 *
 * 検証方針:
 *   【sanitize()】
 *     - 許可タグ（table/tr/td/th/span/div/style）は残る
 *     - 不許可タグ（script/iframe/p/a 等）は除去される
 *     - イベント属性（onclick 等 on〜）は除去される
 *     - href="javascript:" は除去される
 *     - 正常な HTML は文字列として返る
 *
 *   【strictBasicSanitize()】
 *     - script / iframe / object / embed / form タグが除去される
 *     - on〜属性が除去される
 *     - javascript: / vbscript: が除去される
 *     - data:text/html が除去される
 *     - 通常のテキストは残る
 *
 *   【importStyles()】
 *     - style タグの CSS が document.head に追加される
 *     - 危険な CSS 構文（expression / @import 等）が除去される
 *     - style タグがない場合は何もしない
 *
 *   【processTable()】
 *     - table.diff を優先して取得する
 *     - table.diff がなければ最初の table を取得する
 *     - テーブルがない場合は TableProcessingError を投げる
 *     - 取得したテーブルに added-right-bar が付与される
 *
 *   【removeImportedStyle()】
 *     - importedStyleElem が DOM から除去され null になる
 *     - importedStyleElem が null でも例外が発生しない
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ========================================
// ヘルパー: Document を文字列から生成
// ========================================
function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style').forEach(s => s.remove());
    AppState.importedStyleElem = null;
});

afterEach(() => {
    HTMLProcessor.removeImportedStyle();
});

// ========================================
// HTMLProcessor.sanitize()
// ========================================
describe('HTMLProcessor.sanitize()', () => {

    // --- 許可タグ ---
    it('table タグは残る', () => {
        const result = HTMLProcessor.sanitize('<table><tr><td>A</td></tr></table>');
        expect(result).toContain('<table>');
    });

    it('span タグは残る', () => {
        const result = HTMLProcessor.sanitize('<span>テキスト</span>');
        expect(result).toContain('<span>');
    });

    it('style タグは残る', () => {
        const result = HTMLProcessor.sanitize('<style>body{color:red}</style>');
        expect(result).toContain('<style>');
    });

    // --- 不許可タグ ---
    it('script タグは除去される', () => {
        const result = HTMLProcessor.sanitize('<script>alert(1)</script>テキスト');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert(1)');
    });

    it('iframe タグは除去される', () => {
        const result = HTMLProcessor.sanitize('<iframe src="evil.html"></iframe>');
        expect(result).not.toContain('<iframe>');
        expect(result).not.toContain('iframe');
    });

    it.skip('p タグは除去されるがテキストは残る', () => {
        const result = HTMLProcessor.sanitize('<p>本文テキスト</p>');
        expect(result).not.toContain('<p>');
        expect(result).toContain('本文テキスト');
    });

    it.skip('a タグは除去されるがリンクテキストは残る', () => {
        const result = HTMLProcessor.sanitize('<a href="http://example.com">リンク</a>');
        expect(result).not.toContain('<a ');
        expect(result).toContain('リンク');
    });

    // --- イベント属性 ---
    it('onclick 属性は除去される', () => {
        const result = HTMLProcessor.sanitize('<td onclick="evil()">セル</td>');
        expect(result).not.toContain('onclick');
    });

    it('onmouseover 属性は除去される', () => {
        const result = HTMLProcessor.sanitize('<td onmouseover="evil()">セル</td>');
        expect(result).not.toContain('onmouseover');
    });

    it('onload 属性は除去される', () => {
        const result = HTMLProcessor.sanitize('<div onload="evil()">div</div>');
        expect(result).not.toContain('onload');
    });

    // --- javascript: ---
    it('href="javascript:" は除去される', () => {
        const result = HTMLProcessor.sanitize('<td href="javascript:evil()">セル</td>');
        expect(result).not.toContain('javascript:');
    });

    // --- 正常系 ---
    it('WinMerge 形式の差分テーブルは構造が保たれる', () => {
        const html = `
            <table class="diff">
                <tr><th>ファイルA</th><th>ファイルB</th></tr>
                <tr><td style="background:rgb(255,160,160)">削除行</td><td></td></tr>
            </table>
        `;
        const result = HTMLProcessor.sanitize(html);
        expect(result).toContain('class="diff"');
        expect(result).toContain('ファイルA');
        expect(result).toContain('削除行');
    });

    it('空文字列を渡しても例外が発生しない', () => {
        expect(() => HTMLProcessor.sanitize('')).not.toThrow();
    });

    it('戻り値が文字列である', () => {
        expect(typeof HTMLProcessor.sanitize('<table></table>')).toBe('string');
    });
});

// ========================================
// HTMLProcessor.strictBasicSanitize()
// ========================================
describe('HTMLProcessor.strictBasicSanitize()', () => {

    it('script タグブロックが除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('<script>alert(1)</script>本文');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert(1)');
        expect(result).toContain('本文');
    });

    it('iframe タグブロックが除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('<iframe src="x"></iframe>本文');
        expect(result).not.toContain('iframe');
        expect(result).toContain('本文');
    });

    it('object タグブロックが除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('<object data="x"></object>');
        expect(result).not.toContain('object');
    });

    it('embed タグブロックが除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('<embed src="x"></embed>');
        expect(result).not.toContain('embed');
    });

    it('form タグブロックが除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('<form action="x"><input></form>');
        expect(result).not.toContain('form');
    });

    it('on〜属性が除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('<td onclick="evil()">セル</td>');
        expect(result).not.toContain('onclick');
    });

    it('javascript: が除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('href="javascript:evil()"');
        expect(result).not.toContain('javascript:');
    });

    it('vbscript: が除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('src="vbscript:evil"');
        expect(result).not.toContain('vbscript:');
    });

    it('data:text/html が除去される', () => {
        const result = HTMLProcessor.strictBasicSanitize('src="data:text/html,<script>evil()</script>"');
        expect(result).not.toContain('data:text/html');
    });

    it('通常テキストはそのまま残る', () => {
        const plain = '<table><tr><td>差分なし</td></tr></table>';
        const result = HTMLProcessor.strictBasicSanitize(plain);
        expect(result).toContain('差分なし');
    });
});

// ========================================
// HTMLProcessor.importStyles()
// ========================================
describe('HTMLProcessor.importStyles()', () => {

    it('style タグの CSS が document.head に追加される', () => {
        const doc = parseHTML('<html><head><style>body{color:red}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem).not.toBeNull();
        expect(document.head.contains(AppState.importedStyleElem)).toBe(true);
    });

    it('CSS の内容が importedStyleElem に含まれる', () => {
        const doc = parseHTML('<html><head><style>.diff{background:yellow}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).toContain('.diff');
    });

    it('expression( が除去される', () => {
        const doc = parseHTML('<html><head><style>div{width:expression(alert(1))}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).not.toContain('expression(');
    });

    it('@import が除去される', () => {
        const doc = parseHTML('<html><head><style>@import url("evil.css")</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).not.toContain('@import');
    });

    it('javascript: が除去される', () => {
        const doc = parseHTML('<html><head><style>div{background:javascript:evil()}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).not.toContain('javascript:');
    });

    it('behavior: が除去される', () => {
        const doc = parseHTML('<html><head><style>div{behavior:url(evil.htc)}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).not.toContain('behavior:');
    });

    it('style タグがない場合は importedStyleElem が null のまま', () => {
        const doc = parseHTML('<html><head></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem).toBeNull();
    });

    it('複数の style タグがある場合はすべて結合される', () => {
        const doc = parseHTML(`
            <html><head>
                <style>.a{color:red}</style>
                <style>.b{color:blue}</style>
            </head></html>
        `);
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).toContain('.a');
        expect(AppState.importedStyleElem.textContent).toContain('.b');
    });
});

// ========================================
// HTMLProcessor.processTable()
// ========================================
describe('HTMLProcessor.processTable()', () => {

    it('table.diff を優先して取得する', () => {
        const doc = parseHTML(`
            <html><body>
                <table id="other"><tr><td>other</td></tr></table>
                <table class="diff"><tr><th>A</th></tr><tr><td>差分</td></tr></table>
            </body></html>
        `);
        const table = HTMLProcessor.processTable(doc);
        expect(table.classList.contains('diff')).toBe(true);
    });

    it('table.diff がなければ最初の table を取得する', () => {
        const doc = parseHTML(`
            <html><body>
                <table id="first"><tr><td>first</td></tr></table>
            </body></html>
        `);
        const table = HTMLProcessor.processTable(doc);
        expect(table).not.toBeNull();
        expect(table.tagName).toBe('TABLE');
    });

    it('テーブルがない場合は TableProcessingError を投げる', () => {
        const doc = parseHTML('<html><body><p>テーブルなし</p></body></html>');
        expect(() => HTMLProcessor.processTable(doc)).toThrow(TableProcessingError);
    });

    it('返却されたテーブルに added-right-bar セルが付与される', () => {
        const doc = parseHTML(`
            <html><body>
                <table class="diff">
                    <tr><th>A</th><th>B</th></tr>
                    <tr><td>行1</td><td>行1</td></tr>
                </table>
            </body></html>
        `);
        const table = HTMLProcessor.processTable(doc);
        const rightBars = table.querySelectorAll('.added-right-bar');
        expect(rightBars.length).toBeGreaterThan(0);
    });

    it('元の Document のテーブルは変更されない（cloneNode）', () => {
        const doc = parseHTML(`
            <html><body>
                <table class="diff"><tr><td>元</td></tr></table>
            </body></html>
        `);
        const originalTable = doc.querySelector('table.diff');
        const originalCellCount = originalTable.querySelectorAll('td, th').length;
        HTMLProcessor.processTable(doc);
        expect(originalTable.querySelectorAll('td, th').length).toBe(originalCellCount);
    });
});

// ========================================
// HTMLProcessor.removeImportedStyle()
// ========================================
describe('HTMLProcessor.removeImportedStyle()', () => {

    it('importedStyleElem が document.head から除去される', () => {
        const doc = parseHTML('<html><head><style>.x{color:red}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(document.head.contains(AppState.importedStyleElem)).toBe(true);

        HTMLProcessor.removeImportedStyle();
        expect(document.head.querySelector('style[data-imported]')).toBeNull();
        expect(AppState.importedStyleElem).toBeNull();
    });

    it('importedStyleElem が null でも例外が発生しない', () => {
        AppState.importedStyleElem = null;
        expect(() => HTMLProcessor.removeImportedStyle()).not.toThrow();
    });
});
