/**
 * table-processor.js 追加テスト
 *
 * 検証方針:
 *   - setupFixedHeader(): ヘッダー行が正しくコピーされる
 *   - addRightBars(): 右端バーセルが追加される
 *   - cleanupIntersectionObserver(): クリーンアップが正常に動く
 */

import { TableProcessor } from '../js/table-processor.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
});

function setupDOM() {
    document.body.innerHTML = `
        <div id="locationPane"></div>
        <div id="diffContent">
            <div id="diffInfo" class="info-hidden"></div>
            <div id="viewer"></div>
            <button id="resetButton" class="button-hidden"></button>
            <button id="scrollTopButton" class="button-hidden"></button>
            <button id="prevDiffButton" class="button-hidden"></button>
            <button id="nextDiffButton" class="button-hidden"></button>
            <div id="fixedHeader" class="fixed-header-hidden">
                <table><tr id="fixedHeaderRow"></tr></table>
            </div>
            <div id="toolHeader"></div>
            <div id="dropArea"></div>
            <input id="fileInput" type="file" />
        </div>
    `;
    AppState.init();
}

beforeEach(() => setupDOM());

// ========================================
// getRowColors() - td が 0 本の行
// ========================================
// NOTE: 以前は後方互換の getRowBackgroundColor() 経由でテストしていたが、
// 同関数は本番コードから一切呼ばれていない未使用関数だったため削除し、
// 実際に使われている getRowColors() 側のテストとして移植した。
describe('TableProcessor.getRowColors() - td が 0 本の行', () => {
    it('td が1つもない行は left=null, right=null を返す', () => {
        const row = document.createElement('tr');
        const { left, right } = TableProcessor.getRowColors(row);
        expect(left).toBeNull();
        expect(right).toBeNull();
    });
});

// ========================================
// addRightBars()
// ========================================
describe('TableProcessor.addRightBars()', () => {
    it('各行の末尾に added-right-bar セルが追加される', () => {
        const table = document.createElement('table');
        const tr1 = document.createElement('tr');
        tr1.appendChild(document.createElement('td'));
        const tr2 = document.createElement('tr');
        tr2.appendChild(document.createElement('td'));
        table.appendChild(tr1);
        table.appendChild(tr2);

        TableProcessor.addRightBars(table);

        expect(tr1.querySelectorAll('.added-right-bar').length).toBe(1);
        expect(tr2.querySelectorAll('.added-right-bar').length).toBe(1);
    });

    it('ヘッダー行（th）には th の added-right-bar が追加される', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        tr.appendChild(document.createElement('th'));
        table.appendChild(tr);

        TableProcessor.addRightBars(table);

        const rightBar = tr.querySelector('.added-right-bar');
        expect(rightBar).not.toBeNull();
        expect(rightBar.tagName).toBe('TH');
    });
});

// ========================================
// setupFixedHeader()
// ========================================
describe('TableProcessor.setupFixedHeader()', () => {
    it('テーブルの最初の行の th が fixedHeaderRow にコピーされる', () => {
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        const th1 = document.createElement('th');
        th1.textContent = '列1';
        const th2 = document.createElement('th');
        th2.textContent = '列2';
        headerRow.appendChild(th1);
        headerRow.appendChild(th2);
        table.appendChild(headerRow);

        TableProcessor.setupFixedHeader(table);

        const fixedThs = AppState.elements.fixedHeaderRow.querySelectorAll('th');
        expect(fixedThs.length).toBe(2);
        expect(fixedThs[0].textContent).toBe('列1');
        expect(fixedThs[1].textContent).toBe('列2');
    });

    it('th がない行でも例外が発生しない', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        tr.appendChild(document.createElement('td'));
        table.appendChild(tr);

        expect(() => TableProcessor.setupFixedHeader(table)).not.toThrow();
    });

    it('行がないテーブルでも例外が発生しない', () => {
        const table = document.createElement('table');
        expect(() => TableProcessor.setupFixedHeader(table)).not.toThrow();
    });
});

// ========================================
// cleanupIntersectionObserver()
// ========================================
describe('TableProcessor.cleanupIntersectionObserver()', () => {
    it('IntersectionObserver がない場合でも例外が発生しない', () => {
        AppState.intersectionObserver = null;
        expect(() => TableProcessor.cleanupIntersectionObserver()).not.toThrow();
    });

    it('IntersectionObserver がある場合は disconnect される', () => {
        const mockObserver = { disconnect: vi.fn() };
        AppState.intersectionObserver = mockObserver;

        TableProcessor.cleanupIntersectionObserver();

        expect(mockObserver.disconnect).toHaveBeenCalledOnce();
        expect(AppState.intersectionObserver).toBeNull();
    });
});
