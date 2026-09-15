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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import DOMPurify from '../js/vendor/purify.es.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // --- style属性内のCSSインジェクション（DOMPurifyはstyle属性の値の中身までは
    //     検証しないため、uponSanitizeAttribute フックで追加検証している） ---
    it('style属性内の expression( は属性ごと除去される', () => {
        const result = HTMLProcessor.sanitize('<td style="width:expression(alert(1))">セル</td>');
        expect(result).not.toContain('style=');
        expect(result).toContain('セル');
    });

    it('style属性内の javascript: は属性ごと除去される', () => {
        const result = HTMLProcessor.sanitize('<td style="background:url(javascript:alert(1))">セル</td>');
        expect(result).not.toContain('style=');
    });

    it('style属性内の @import は属性ごと除去される', () => {
        const result = HTMLProcessor.sanitize('<div style="@import url(evil.css)">x</div>');
        expect(result).not.toContain('style=');
    });

    it('正当な色指定のstyle属性（WinMergeが実際に出力する形式）は保持される', () => {
        // <td>は table/tr の中でなければHTMLパーサーの仕様上保持されないため、
        // 正しいテーブル構造で検証する
        const result = HTMLProcessor.sanitize(
            '<table><tr><td style="background-color: rgb(239, 203, 5);">セル</td></tr></table>'
        );
        expect(result).toContain('background-color: rgb(239, 203, 5)');
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
        expect(AppState.importedStyleElem.textContent).toContain('#viewer .diff');
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

    it('外部リソースを読み込む url(...) を含む style ブロック全体を破棄する', () => {
        const doc = parseHTML('<html><head><style>div{background:url(https://evil.example/x)}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).toBe('');
    });

    it('@media を含む style ブロック全体を破棄する（_scopeCss の {} マッチングがネストを正しく扱えないため fail closed）', () => {
        const doc = parseHTML('<html><head><style>@media (min-width: 600px){.diff{color:red}}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).toBe('');
    });

    it('style タグがない場合は importedStyleElem が null のまま', () => {
        const doc = parseHTML('<html><head></head></html>');
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem).toBeNull();
    });

    it('WinMerge CSS のセレクターが #viewer / #fixedHeader 配下にスコープされる', () => {
        // #fixedHeader は setupFixedHeader() が #viewer 内の th を複製して作る
        // #viewer の兄弟要素（DOM上は外側）。複製されたth（class属性はコピーされる）にも
        // レポート側のCSS（見出しセルの背景色等）が効くよう、#viewer と #fixedHeader の
        // 両方にスコープする。
        const doc = parseHTML('<html><head><style>body{color:red} table{margin:0} .diff, td{background:yellow}</style></head></html>');
        HTMLProcessor.importStyles(doc);
        const css = AppState.importedStyleElem.textContent;
        expect(css).toContain('#viewer, #fixedHeader {');
        expect(css).toContain('#viewer table, #fixedHeader table {');
        expect(css).toContain('#viewer .diff, #fixedHeader .diff, #viewer td, #fixedHeader td {');
        expect(css).not.toMatch(/(^|[}\n])\s*(body|table|\.diff|td)\s*\{/);
    });

    it('複数の style タグがある場合はすべて結合される', () => {
        const doc = parseHTML(`
            <html><head>
                <style>.a{color:red}</style>
                <style>.b{color:blue}</style>
            </head></html>
        `);
        HTMLProcessor.importStyles(doc);
        expect(AppState.importedStyleElem.textContent).toContain('#viewer .a');
        expect(AppState.importedStyleElem.textContent).toContain('#viewer .b');
    });
});

// ========================================
// HTMLProcessor.sanitize() - fail closed
// ========================================
describe('HTMLProcessor.sanitize() - DOMPurify失敗時', () => {
    it('DOMPurifyが例外を投げた場合は未検証HTMLへフォールバックしない', () => {
        const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize').mockImplementation(() => {
            throw new Error('forced DOMPurify failure');
        });

        expect(() => HTMLProcessor.sanitize('<table><tr><td>未検証</td></tr></table>')).toThrow(
            FileProcessingError
        );
        expect(() => HTMLProcessor.sanitize('<table><tr><td>未検証</td></tr></table>')).toThrow(
            'HTMLの安全性を確認できないため、ファイルを表示できません。'
        );

        sanitizeSpy.mockRestore();
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

// ========================================
// HTMLProcessor.sanitize() - html/head/body 誤削除バグの回帰テスト
// ========================================
describe('HTMLProcessor.sanitize() - html/head/body 誤削除バグの回帰テスト', () => {
    // NOTE: ALLOWED_TAGS に html/head/body が含まれていないと、
    // <html> 自体が「許可されていないタグ」として削除され、
    // ドキュメント構造が壊れる。このテストはその再発を防止する。

    it('style タグ（<head>に配置される）と table タグ（<body>に配置される）が両方とも保持される', () => {
        const result = HTMLProcessor.sanitize(
            '<style>body{color:red}</style><table><tr><td>A</td></tr></table>'
        );
        expect(result).toContain('<style>');
        expect(result).toContain('<table>');
    });

    it('script タグは要素ごと除去され、中身のコードもテキストとして残らない', () => {
        const result = HTMLProcessor.sanitize('<script>alert(1)</script>テキスト');
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert(1)');
        expect(result).toContain('テキスト');
    });

    it('iframe タグは中身ごと除去される', () => {
        const result = HTMLProcessor.sanitize('<iframe src="evil.html">フォールバックテキスト</iframe>');
        expect(result).not.toContain('<iframe');
        expect(result).not.toContain('フォールバックテキスト');
    });

    it('a タグ（危険タグではない不許可タグ）はアンラップされ、リンクテキストは残る', () => {
        const result = HTMLProcessor.sanitize('<a href="http://example.com">リンクテキスト</a>');
        expect(result).not.toContain('<a ');
        expect(result).toContain('リンクテキスト');
    });

    // NOTE: WinMergeレポートは列幅指定に <colgroup>/<col> を使用しており、
    // これらが ALLOWED_TAGS に含まれず誤って除去されると、
    // 差分ビューの左右ペインの表示幅が崩れる（実際に発生した回帰）。
    it('実際のWinMergeレポート（small-file.htm）で colgroup/col/thead/tbody が保持される', () => {
        const fixturePath = path.resolve(__dirname, 'fixtures/small-file.htm');
        const html = fs.readFileSync(fixturePath, 'utf-8');

        const result = HTMLProcessor.sanitize(html);

        expect(result).toContain('<colgroup');
        expect(result).toContain('<col ');
        expect(result).toContain('<thead');
        expect(result).toContain('<tbody');
        // 列幅指定（0.5em / calc(100% / 2 - 0.5em)）が失われていないことも確認
        expect(result).toContain('calc(100% / 2 - 0.5em)');
    });

    // 回帰テスト: WinMergeは<style>タグの中身を古いブラウザ互換のための
    // `<!-- -->` コメントで囲む慣習がある。DOMPurifyはコメントを含む
    // <style>ブロックを、コメントを使った難読化型XSS対策として丸ごと
    // 削除する挙動をするため、事前にコメント記号だけを除去する前処理
    // （_stripStyleComments）を入れている。この前処理がないと、実際の
    // WinMergeレポートを読み込んだ際に<style>タグ自体が消え、差分の
    // 色付けが一切表示されなくなる。
    it('実際のWinMergeレポート（small-file.htm）で<style>タグ内のCSSクラス定義が保持される', () => {
        const fixturePath = path.resolve(__dirname, 'fixtures/small-file.htm');
        const html = fs.readFileSync(fixturePath, 'utf-8');

        expect(html).toContain('<!--'); // 前提: 元ファイルがコメント記法を使っていること

        const result = HTMLProcessor.sanitize(html);

        expect(result).toContain('<style');
        expect(result).toContain('.sf3b14'); // WinMergeが生成する色クラスの一例
    });

    it('<style>タグ内のコメント記法を除去しても、CSSの中身自体は変更されない', () => {
        const html = '<style><!--\n.foo { color: red; }\n--></style><div class="foo">x</div>';
        const result = HTMLProcessor.sanitize(html);
        expect(result).toContain('.foo { color: red; }');
        expect(result).not.toContain('<!--');
    });
});

// ========================================
// HTMLProcessor.sanitize() - 異常系・fail closed
// ========================================
describe('HTMLProcessor.sanitize() - 異常系・fail closed', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('DOMParser の結果に documentElement が無い場合は表示を中止する', () => {
        vi.spyOn(DOMParser.prototype, 'parseFromString').mockReturnValueOnce({
            documentElement: null,
        });

        expect(() => HTMLProcessor.sanitize('<script>alert(1)</script><div>ok</div>')).toThrow(
            FileProcessingError
        );
    });

    it('parseFromString が例外を投げた場合は表示を中止する', () => {
        vi.spyOn(DOMParser.prototype, 'parseFromString').mockImplementationOnce(() => {
            throw new Error('parse boom');
        });

        expect(() => HTMLProcessor.sanitize('<script>alert(1)</script><div>ok</div>')).toThrow(
            FileProcessingError
        );
    });

    it('危険タグ（script）の removeChild が例外を投げた場合は表示を中止する', () => {
        vi.spyOn(Element.prototype, 'removeChild').mockImplementationOnce(() => {
            throw new Error('removeChild boom');
        });

        expect(() => HTMLProcessor.sanitize('<script>alert(1)</script><div>ok</div>')).toThrow(
            FileProcessingError
        );
    });

    it('アンラップ対象（a タグ）の insertBefore が例外を投げた場合は表示を中止する', () => {
        vi.spyOn(Element.prototype, 'insertBefore').mockImplementationOnce(() => {
            throw new Error('insertBefore boom');
        });

        expect(() => HTMLProcessor.sanitize('<div><a href="#">リンク</a></div>')).toThrow(
            FileProcessingError
        );
    });

    it('アンラップ対象（a タグ）の removeChild が例外を投げた場合は表示を中止する', () => {
        vi.spyOn(Element.prototype, 'removeChild').mockImplementationOnce(() => {
            throw new Error('removeChild boom');
        });

        expect(() => HTMLProcessor.sanitize('<div><a href="#">リンク</a></div>')).toThrow(
            FileProcessingError
        );
    });
});

// ========================================
// HTMLProcessor.importStyles() - 追加ケース
// ========================================
describe('HTMLProcessor.importStyles() - 追加ケース', () => {
    it('空の style タグでも例外が発生しない', () => {
        const doc = parseHTML('<html><head><style></style></head></html>');
        expect(() => HTMLProcessor.importStyles(doc)).not.toThrow();
        expect(AppState.importedStyleElem.textContent).toBe('');
    });
});

// ========================================
// HTMLProcessor._scopeCss() - CSSスコープエスケープ対策
// ========================================
// 参照: malicious-06-css-scope-escape.htm での実害報告
//
// _scopeCss() は html/body/:root セレクターを #viewer に読み替えるが、
// #viewer はレポート内容を描画する実際のコンテナのidでもあるため、
// 単純な文字列置換だけでは「html/bodyを非表示にする」攻撃が
// 「#viewer（保護すべき表示領域そのもの）を非表示にする」攻撃に
// そのまま変換されてしまう問題があった。
describe('HTMLProcessor._scopeCss() - CSSスコープエスケープ対策', () => {
    function runPipeline(rawHtml) {
        const sanitized = HTMLProcessor.sanitize(rawHtml);
        const doc = parseHTML(sanitized);
        HTMLProcessor.importStyles(doc);
        return AppState.importedStyleElem ? AppState.importedStyleElem.textContent : '';
    }

    it('malicious-06-css-scope-escape.htm と同じペイロードで #viewer 自体を隠せない', () => {
        const raw = `<!DOCTYPE html>
<html><head><title>WinMerge File Compare Report</title>
<style type="text/css">
<!--
html, body, #viewer ~ * , #app { display: none !important; }
button, input, .toolbar { visibility: hidden !important; }
* { pointer-events: none !important; }
.sf3b2 { color: #000000; background-color: #ffffff; }
-->
</style></head>
<body><table><tr><td class="sf3b2">diff</td></tr></table></body></html>`;
        const css = runPipeline(raw);
        expect(css).not.toMatch(/#viewer\s*(:[\w-]+)?\s*\{[^}]*display\s*:\s*none/i);
        expect(css).not.toMatch(/#viewer\s*(:[\w-]+)?\s*\{[^}]*visibility\s*:\s*hidden/i);
        // 無害な装飾ルール(色指定)はそのまま機能する
        expect(css).toContain('.sf3b2');
    });

    it('html, body { display:none } は #viewer に対して display を適用しない', () => {
        const css = runPipeline('<html><head><style>html, body { display: none; }</style></head><body></body></html>');
        expect(css).not.toMatch(/display\s*:\s*none/i);
    });

    it(':root { visibility: hidden } も同様にブロックされる', () => {
        const css = runPipeline('<html><head><style>:root { visibility: hidden; }</style></head><body></body></html>');
        expect(css).not.toMatch(/visibility\s*:\s*hidden/i);
    });

    it('疑似クラス付き body:hover{display:none} も #viewer 自身は隠せない', () => {
        const css = runPipeline('<html><head><style>body:hover{display:none;color:blue}</style></head><body></body></html>');
        expect(css).not.toMatch(/display\s*:\s*none/i);
        expect(css).toContain('#viewer:hover');
        expect(css).toContain('color:blue');
    });

    it('#viewer を子孫として辿る通常セレクターは引き続き display 等を使える（誤検知しない）', () => {
        const css = runPipeline('<html><head><style>div{display:none}</style></head><body></body></html>');
        expect(css).toContain('#viewer div, #fixedHeader div {display:none}');
    });

    it('危険プロパティを含まない body ルールは従来どおり #viewer / #fixedHeader にスコープされる（既存挙動の回帰なし）', () => {
        const css = runPipeline('<html><head><style>body{color:red;font-family:Arial}</style></head><body></body></html>');
        expect(css).toContain('#viewer, #fixedHeader {color:red;font-family:Arial}');
    });

    it('固定ヘッダー（#fixedHeader）にも見出しセル用クラスの背景色が効く（スクロール時の白抜けバグの回帰テスト）', () => {
        // #fixedHeader は #viewer と同じ見た目になるべき複製ヘッダーなので、
        // .title のようなクラスベースの装飾は両方に適用されなければならない。
        const css = runPipeline('<html><head><style>.title{color:white;background-color:blue;}</style></head><body></body></html>');
        expect(css).toContain('#viewer .title, #fixedHeader .title {color:white;background-color:blue;}');
    });
});
