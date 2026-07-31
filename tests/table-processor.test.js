/**
 * table-processor.js のユニットテスト
 *
 * 検証方針:
 *   - addRightBars() が各行に added-right-bar セルを追加するか
 *   - setupFixedHeader() がヘッダー行の th を正しくコピーするか
 *   - setupFixedHeader() が危険な属性をサニタイズするか
 *   - getRowColors() が差分色行を正しく検出するか（table-processor-coverage.test.jsで詳細テスト）
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
