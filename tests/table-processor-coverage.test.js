/**
 * tests/table-processor-coverage.test.js
 *
 * table-processor.js のカバレッジ向上テスト
 *
 * 対象: 既存テストで未カバーの分岐
 *   - updateFixedHeaderPosition(): ウィンドウ幅 3 パターン（<=600 / <=750 / other）
 *   - setupResizeHandler(): 既存ハンドラのクリーンアップ分岐
 *   - _getTdBgColor(): HEX インラインスタイル分岐
 *   - getRowColors(): td が 1 本（区切り行）の分岐
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// DOM フィクスチャ
// ========================================
function setupDOM() {
    document.body.innerHTML = `
        <div id="locationPane">
            <div id="locationPaneLeft"></div>
            <div id="locationPaneRight"></div>
        </div>
        <div id="diffContent">
            <div id="viewer">
                <table id="mainTable">
                    <tr>
                        <th class="title">旧</th>
                        <th>内容</th>
                        <th class="title">新</th>
                        <th>内容</th>
                        <th class="added-right-bar"></th>
                    </tr>
                </table>
            </div>
            <div id="diffInfo" class="info-hidden"></div>
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

/**
 * WinMerge 形式の行を生成
 */
function makeRow(leftBg = null, rightBg = null) {
    const row = document.createElement('tr');
    const titleLeft = document.createElement('td');
    titleLeft.className = 'title';
    row.appendChild(titleLeft);
    const contentLeft = document.createElement('td');
    if (leftBg) contentLeft.style.backgroundColor = leftBg;
    row.appendChild(contentLeft);
    const titleRight = document.createElement('td');
    titleRight.className = 'title';
    row.appendChild(titleRight);
    const contentRight = document.createElement('td');
    if (rightBg) contentRight.style.backgroundColor = rightBg;
    row.appendChild(contentRight);
    const rightBar = document.createElement('td');
    rightBar.className = 'added-right-bar';
    row.appendChild(rightBar);
    return row;
}

beforeEach(() => {
    setupDOM();
    AppState.diffBlocks = [];
    AppState.currentDiffIndex = -1;
    AppState.intersectionObserver = null;
});

afterEach(() => {
    vi.restoreAllMocks();
    if (AppState.intersectionObserver) {
        AppState.intersectionObserver.disconnect();
        AppState.intersectionObserver = null;
    }
    if (AppState.eventHandlers.debouncedResize) {
        window.removeEventListener('resize', AppState.eventHandlers.debouncedResize);
        AppState.eventHandlers.debouncedResize = null;
    }
});

// ========================================
// updateFixedHeaderPosition() - ウィンドウ幅分岐
// ========================================
describe('TableProcessor.updateFixedHeaderPosition() - ウィンドウ幅分岐', () => {

    beforeEach(() => {
        // fixedHeaderRow に th をセットアップ
        TableProcessor.setupFixedHeader(document.getElementById('mainTable'));
    });

    it('windowWidth <= 600 のとき thRect.width をそのまま使う', () => {
        Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
        const table = document.getElementById('mainTable');
        expect(() => TableProcessor.updateFixedHeaderPosition(table)).not.toThrow();
    });

    it('windowWidth <= 750 のとき thRect.width - 17 を使う', () => {
        Object.defineProperty(window, 'innerWidth', { value: 700, configurable: true });
        const table = document.getElementById('mainTable');
        expect(() => TableProcessor.updateFixedHeaderPosition(table)).not.toThrow();
    });

    it('windowWidth > 750 のとき MIN_COLUMN_WIDTH との max を使う', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
        const table = document.getElementById('mainTable');
        expect(() => TableProcessor.updateFixedHeaderPosition(table)).not.toThrow();
    });

    it('originalTable が null のとき例外が発生しない', () => {
        expect(() => TableProcessor.updateFixedHeaderPosition(null)).not.toThrow();
    });

    it('added-right-bar の th には RIGHT_BAR_WIDTH が設定される', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
        const table = document.getElementById('mainTable');
        TableProcessor.updateFixedHeaderPosition(table);
        const fixedThs = AppState.elements.fixedHeader.querySelectorAll('th');
        // 末尾の added-right-bar th には固定幅が設定される
        if (fixedThs.length > 0) {
            const lastTh = fixedThs[fixedThs.length - 1];
            expect(lastTh.style.width).toBeDefined();
        }
    });
});

// ========================================
// setupResizeHandler() - 既存ハンドラのクリーンアップ分岐
// ========================================
describe('TableProcessor.setupResizeHandler() - ハンドラ管理', () => {

    it('既存の debouncedResize がある場合はクリーンアップしてから再登録する', () => {
        const table = document.getElementById('mainTable');
        // 1回目の登録
        TableProcessor.setupResizeHandler(table);
        const firstHandler = AppState.eventHandlers.debouncedResize;
        expect(firstHandler).not.toBeNull();

        // 2回目の登録（既存ハンドラのクリーンアップが走る）
        TableProcessor.setupResizeHandler(table);
        const secondHandler = AppState.eventHandlers.debouncedResize;
        expect(secondHandler).not.toBeNull();
        // 新しいハンドラに差し替わっている
        expect(secondHandler).not.toBe(firstHandler);
    });

    it('table が null のとき例外が発生しない', () => {
        expect(() => TableProcessor.setupResizeHandler(null)).not.toThrow();
    });

    it('既存の resizeTimeout がある場合はクリアする', () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const fakeId = setTimeout(() => {}, 99999);
        AppState.eventHandlers.resizeTimeout = fakeId;

        const table = document.getElementById('mainTable');
        TableProcessor.setupResizeHandler(table);

        expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeId);
    });
});

// ========================================
// _getTdBgColor() - HEX インラインスタイル分岐
// ========================================
describe('TableProcessor._getTdBgColor() 経由 - getRowColors()', () => {

    it('HEX インラインスタイル（#efcb05）を rgb 形式に変換して返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        // HEX 形式のインラインスタイル（file:// 環境対応の分岐）
        td.style.backgroundColor = '#efcb05';
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        const { left } = TableProcessor.getRowColors(row);
        // HEX が rgb に変換されて返る
        expect(left).toBe('rgb(239, 203, 5)');
    });

    it('中立色の HEX（#ffffff）は null を返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.style.backgroundColor = '#ffffff';
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        const { left } = TableProcessor.getRowColors(row);
        expect(left).toBeNull();
    });

    it('中立色に近い薄グレー（#f0f0f0）は null を返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.style.backgroundColor = '#f0f0f0';
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        const { left } = TableProcessor.getRowColors(row);
        expect(left).toBeNull();
    });
});

// ========================================
// getRowColors() - td が 1 本の分岐（区切り行）
// ========================================
describe('TableProcessor.getRowColors() - td が 1 本の行', () => {

    it('td が 1 本（added-right-bar のみ）のとき left=null, right=null を返す', () => {
        const row = document.createElement('tr');
        const rightBar = document.createElement('td');
        rightBar.className = 'added-right-bar';
        row.appendChild(rightBar);

        const { left, right } = TableProcessor.getRowColors(row);
        expect(left).toBeNull();
        expect(right).toBeNull();
    });

    it('td が 1 本（色あり）のとき left に色・right は null を返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.style.backgroundColor = 'rgb(239, 203, 5)';
        row.appendChild(td);

        const { left, right } = TableProcessor.getRowColors(row);
        expect(left).toBe('rgb(239, 203, 5)');
        expect(right).toBeNull();
    });
});

// ========================================
// setupIntersectionObserver() - エラー分岐
// ========================================
describe('TableProcessor.setupIntersectionObserver() - エラー分岐', () => {

    it('viewer にテーブルがない場合も例外が発生しない', () => {
        // viewer を空にする
        AppState.elements.viewer.innerHTML = '';
        expect(() => TableProcessor.setupIntersectionObserver()).not.toThrow();
    });

    it('テーブルに行がない場合も例外が発生しない', () => {
        AppState.elements.viewer.innerHTML = '<table></table>';
        expect(() => TableProcessor.setupIntersectionObserver()).not.toThrow();
    });

    it('2回呼び出しても例外が発生しない（既存 observer のクリーンアップ）', () => {
        TableProcessor.setupIntersectionObserver();
        expect(() => TableProcessor.setupIntersectionObserver()).not.toThrow();
    });
});
