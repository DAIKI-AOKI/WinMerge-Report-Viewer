/**
 * table-processor.js のユニットテスト
 *
 * 検証方針:
 *   - addRightBars() が各行に added-right-bar セルを追加するか
 *   - setupFixedHeader() がヘッダー行の th を正しくコピーするか
 *   - setupFixedHeader() が危険な属性をサニタイズするか
 *   - getRowBackgroundColor() が差分色行を正しく検出するか
 *   - getRowBackgroundColor() が白・グレー行を除外するか
 *   - getRowBackgroundColor() が added-right-bar を無視するか
 *
 * IntersectionObserver を使う setupIntersectionObserver() は
 * jsdom 未実装のためモックを使用する。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// IntersectionObserver のモック
// jsdom は IntersectionObserver を実装していないため手動で用意する
// ========================================
class MockIntersectionObserver {
    constructor(cb) { this._cb = cb; }
    observe()    {}
    unobserve()  {}
    disconnect() {}
}

// ========================================
// DOM フィクスチャのセットアップ
// ========================================
function setupDOM() {
    document.body.innerHTML = `
        <input id="fileInput" />
        <div id="viewer"><table id="mainTable"></table></div>
        <div id="diffContent"></div>
        <div id="locationPane"></div>
        <div id="dropArea"></div>
        <button id="resetButton"></button>
        <button id="scrollTopButton"></button>
        <button id="prevDiffButton"></button>
        <button id="nextDiffButton"></button>
        <div id="diffInfo"></div>
        <div id="fixedHeader"><table><tr id="fixedHeaderRow"></tr></table></div>
        <div id="toolHeader"></div>
    `;
    AppState.init();
}

/**
 * ヘッダー行を持つシンプルなテーブルを生成
 * @param {string[]} headers - ヘッダーテキストの配列
 * @returns {HTMLTableElement}
 */
function makeTableWithHeader(headers) {
    const table = document.createElement('table');
    const tr = document.createElement('tr');
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        tr.appendChild(th);
    });
    table.appendChild(tr);
    return table;
}

/**
 * 指定した背景色を td に設定した行を持つテーブルを生成
 * @param {(string|null)[]} colors - 行ごとの背景色
 * @returns {HTMLTableElement}
 */
function makeTableWithColors(colors) {
    const table = document.createElement('table');
    colors.forEach(color => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        if (color) td.style.backgroundColor = color;
        tr.appendChild(td);
        table.appendChild(tr);
    });
    document.body.appendChild(table);
    return table;
}

beforeEach(() => {
    global.IntersectionObserver = MockIntersectionObserver;
    setupDOM();
});

afterEach(() => {
    document.body.innerHTML = '';
});

// ========================================
// TableProcessor.addRightBars()
// ========================================
describe('TableProcessor.addRightBars()', () => {
    it('各行に added-right-bar クラスのセルが追加される', () => {
        const table = makeTableWithHeader(['File A', 'File B']);
        const tr = document.createElement('tr');
        tr.appendChild(document.createElement('td'));
        table.appendChild(tr);

        TableProcessor.addRightBars(table);

        table.querySelectorAll('tr').forEach(row => {
            const rightBar = row.querySelector('.added-right-bar');
            expect(rightBar).not.toBeNull();
        });
    });

    it('ヘッダー行には th として追加される', () => {
        const table = makeTableWithHeader(['A']);
        TableProcessor.addRightBars(table);
        const added = table.querySelector('tr').lastChild;
        expect(added.tagName).toBe('TH');
        expect(added.classList.contains('added-right-bar')).toBe(true);
    });

    it('データ行には td として追加される', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        tr.appendChild(document.createElement('td'));
        table.appendChild(tr);

        TableProcessor.addRightBars(table);
        const added = tr.lastChild;
        expect(added.tagName).toBe('TD');
        expect(added.classList.contains('added-right-bar')).toBe(true);
    });

    it('既存のセル数が変わらない（追加のみ）', () => {
        const table = makeTableWithHeader(['A', 'B']);
        const before = table.querySelector('tr').querySelectorAll('th').length;
        TableProcessor.addRightBars(table);
        const after = table.querySelector('tr').querySelectorAll('th').length;
        expect(after).toBe(before + 1);
    });
});

// ========================================
// TableProcessor.setupFixedHeader()
// ========================================
describe('TableProcessor.setupFixedHeader()', () => {
    it('ヘッダー行の th テキストが fixedHeaderRow にコピーされる', () => {
        const table = makeTableWithHeader(['ファイルA', 'ファイルB']);
        TableProcessor.setupFixedHeader(table);

        const fixedThs = AppState.elements.fixedHeaderRow.querySelectorAll('th');
        expect(fixedThs[0].textContent).toBe('ファイルA');
        expect(fixedThs[1].textContent).toBe('ファイルB');
    });

    it('th の数が一致する', () => {
        const table = makeTableWithHeader(['A', 'B', 'C']);
        TableProcessor.setupFixedHeader(table);
        const fixedThs = AppState.elements.fixedHeaderRow.querySelectorAll('th');
        expect(fixedThs).toHaveLength(3);
    });

    it('危険な属性値（javascript:）がサニタイズされる', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.setAttribute('class', 'javascript:alert(1)');
        th.textContent = 'test';
        tr.appendChild(th);
        table.appendChild(tr);

        TableProcessor.setupFixedHeader(table);

        const fixedTh = AppState.elements.fixedHeaderRow.querySelector('th');
        expect(fixedTh.getAttribute('class')).not.toContain('javascript:');
    });

    it('危険なイベント属性（onXxx）がサニタイズされる', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.setAttribute('class', 'onclick=evil');
        th.textContent = 'test';
        tr.appendChild(th);
        table.appendChild(tr);

        TableProcessor.setupFixedHeader(table);

        const fixedTh = AppState.elements.fixedHeaderRow.querySelector('th');
        expect(fixedTh.getAttribute('class')).not.toContain('onclick');
    });

    it('scope="col" が設定される', () => {
        const table = makeTableWithHeader(['A']);
        TableProcessor.setupFixedHeader(table);
        const fixedTh = AppState.elements.fixedHeaderRow.querySelector('th');
        expect(fixedTh.getAttribute('scope')).toBe('col');
    });

    it('テーブルに行がない場合でも例外が発生しない', () => {
        const emptyTable = document.createElement('table');
        expect(() => TableProcessor.setupFixedHeader(emptyTable)).not.toThrow();
    });
});

// ========================================
// TableProcessor.getRowBackgroundColor()
// ========================================
describe('TableProcessor.getRowBackgroundColor()', () => {
    it('差分色（changed）の行は色を返す', () => {
        const table = makeTableWithColors(['rgb(239, 203, 5)']);
        const row = table.querySelector('tr');
        const result = TableProcessor.getRowBackgroundColor(row);
        expect(result).toBe('rgb(239, 203, 5)');
    });

    it('差分色（del）の行は色を返す', () => {
        const table = makeTableWithColors(['rgb(255, 160, 160)']);
        const row = table.querySelector('tr');
        const result = TableProcessor.getRowBackgroundColor(row);
        expect(result).toBe('rgb(255, 160, 160)');
    });

    it('白背景（rgb(255, 255, 255)）は null を返す', () => {
        const table = makeTableWithColors(['rgb(255, 255, 255)']);
        const row = table.querySelector('tr');
        const result = TableProcessor.getRowBackgroundColor(row);
        expect(result).toBeNull();
    });

    it('薄グレー（rgb(240, 240, 240)）は null を返す', () => {
        const table = makeTableWithColors(['rgb(240, 240, 240)']);
        const row = table.querySelector('tr');
        const result = TableProcessor.getRowBackgroundColor(row);
        expect(result).toBeNull();
    });

    it('背景色なしの行は null を返す', () => {
        const table = makeTableWithColors([null]);
        const row = table.querySelector('tr');
        const result = TableProcessor.getRowBackgroundColor(row);
        expect(result).toBeNull();
    });

    it('added-right-bar セルの色は無視される', () => {
        // added-right-bar だけが差分色を持つ行は null を返すべき
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.className = 'added-right-bar';
        td.style.backgroundColor = 'rgb(239, 203, 5)';
        tr.appendChild(td);
        table.appendChild(tr);
        document.body.appendChild(table);

        const result = TableProcessor.getRowBackgroundColor(tr);
        expect(result).toBeNull();
    });

    it('通常の td と added-right-bar が混在する場合は通常 td の色を返す', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');

        const tdNormal = document.createElement('td');
        tdNormal.style.backgroundColor = 'rgb(239, 203, 5)';

        const tdBar = document.createElement('td');
        tdBar.className = 'added-right-bar';
        tdBar.style.backgroundColor = 'rgb(255, 255, 255)';

        tr.appendChild(tdNormal);
        tr.appendChild(tdBar);
        table.appendChild(tr);
        document.body.appendChild(table);

        const result = TableProcessor.getRowBackgroundColor(tr);
        expect(result).toBe('rgb(239, 203, 5)');
    });
});
