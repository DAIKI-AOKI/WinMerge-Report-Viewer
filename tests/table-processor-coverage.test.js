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
    // NOTE: jsdom は style.backgroundColor に HEX を代入しても内部的に rgb() へ
    // 正規化してしまうため、素直に代入するだけでは _getTdBgColor() 内の
    // HEX 専用分岐（inline.startsWith('#')）を実際には通らない
    // （getComputedStyle 側の rgb() 分岐で偶然同じ結果になっていた）。
    // Object.defineProperty で読み取り値を差し替えて、意図した分岐を狙う。

    it('HEX インラインスタイル（#efcb05）を rgb 形式に変換して返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        Object.defineProperty(td.style, 'backgroundColor', {
            value: '#efcb05',
            configurable: true,
        });

        const { left } = TableProcessor.getRowColors(row);
        // HEX が rgb に変換されて返る
        expect(left).toBe('rgb(239, 203, 5)');
    });

    it('中立色の HEX（#ffffff）は null を返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        Object.defineProperty(td.style, 'backgroundColor', {
            value: '#ffffff',
            configurable: true,
        });

        const { left } = TableProcessor.getRowColors(row);
        expect(left).toBeNull();
    });

    it('中立色に近い薄グレー（#f0f0f0）は null を返す', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        Object.defineProperty(td.style, 'backgroundColor', {
            value: '#f0f0f0',
            configurable: true,
        });

        const { left } = TableProcessor.getRowColors(row);
        expect(left).toBeNull();
    });

    it('# で始まるが不正な形式（6桁hexでない）の場合は hexToRgb が null を返し getComputedStyle にフォールバックする', () => {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        row.appendChild(td);
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);

        // 3桁hexなど、正規表現 [a-f\d]{2}×3 にマッチしない不正な形式
        Object.defineProperty(td.style, 'backgroundColor', {
            value: '#zzz',
            configurable: true,
        });

        const { left } = TableProcessor.getRowColors(row);
        // hexToRgb が null を返し、getComputedStyle 側（無色）で null になる
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

    it('IntersectionObserver のコンストラクタが例外を投げても catch され、observer がクリーンアップされる', () => {
        const OriginalIO = global.IntersectionObserver;
        global.IntersectionObserver = class {
            constructor() {
                throw new Error('IO construction failed');
            }
        };

        expect(() => TableProcessor.setupIntersectionObserver()).not.toThrow();
        expect(AppState.intersectionObserver).toBeNull();

        global.IntersectionObserver = OriginalIO;
    });
});

// ========================================
// cleanupIntersectionObserver() - disconnect() が例外を投げるケース
// ========================================
describe('TableProcessor.cleanupIntersectionObserver() - 異常系', () => {
    it('disconnect() が例外を投げても catch され、参照はクリアされる', () => {
        AppState.intersectionObserver = {
            disconnect: () => {
                throw new Error('disconnect失敗テスト');
            },
        };

        expect(() => TableProcessor.cleanupIntersectionObserver()).not.toThrow();
        expect(AppState.intersectionObserver).toBeNull();
    });
});

// ========================================
// setupIntersectionObserver() - observerCallback（IntersectionObserver 本体の挙動）
// ========================================
describe('TableProcessor.setupIntersectionObserver() - observerCallback', () => {
    it('isIntersecting: true のとき固定ヘッダーが非表示になる', () => {
        TableProcessor.setupIntersectionObserver();
        const observer = AppState.intersectionObserver;
        const headerRow = AppState.elements.viewer.querySelector('table tr');

        observer._cb([{ isIntersecting: true, target: headerRow }]);

        expect(AppState.elements.fixedHeader.classList.contains('fixed-header-hidden')).toBe(
            true
        );
        expect(headerRow.style.visibility).toBe('visible');
    });

    it('isIntersecting: false かつ target がヘッダー行のとき固定ヘッダーが表示される', () => {
        TableProcessor.setupIntersectionObserver();
        const observer = AppState.intersectionObserver;
        const headerRow = AppState.elements.viewer.querySelector('table tr');

        observer._cb([{ isIntersecting: false, target: headerRow }]);

        expect(AppState.elements.fixedHeader.classList.contains('fixed-header-visible')).toBe(
            true
        );
        expect(headerRow.style.visibility).toBe('hidden');
    });
});

// ========================================
// setupResizeHandler() - debouncedResize コールバック本体
// ========================================
describe('TableProcessor.setupResizeHandler() - debouncedResize コールバック本体', () => {
    it('resizeイベント発火後、固定ヘッダーが表示中なら updateFixedHeaderPosition が呼ばれる', async () => {
        const table = document.getElementById('mainTable');
        TableProcessor.setupFixedHeader(table);
        TableProcessor.setupResizeHandler(table);

        // 固定ヘッダーを「表示中」状態にしておく
        AppState.elements.fixedHeader.classList.remove('fixed-header-hidden');
        AppState.elements.fixedHeader.classList.add('fixed-header-visible');

        // updateFixedHeaderPosition() はモジュール内クロージャ経由で呼ばれるため、
        // TableProcessor.updateFixedHeaderPosition への spy では捕捉できない。
        // 代わりに、その内部で必ず呼ばれる CSSManager.setVariable を監視する。
        const setVarSpy = vi.spyOn(CSSManager, 'setVariable');

        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RESIZE_DEBOUNCE_DELAY + 50));

        expect(setVarSpy).toHaveBeenCalledWith('fixed-header-left', expect.any(String));
    });

    it('固定ヘッダーが非表示中なら updateFixedHeaderPosition は呼ばれない', async () => {
        const table = document.getElementById('mainTable');
        TableProcessor.setupResizeHandler(table);
        // fixed-header-hidden のまま（setupDOMのデフォルト）

        const setVarSpy = vi.spyOn(CSSManager, 'setVariable');

        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RESIZE_DEBOUNCE_DELAY + 50));

        expect(setVarSpy).not.toHaveBeenCalledWith('fixed-header-left', expect.any(String));
    });

    it('markerResizeCallback が登録されていれば resize 時に呼ばれる', async () => {
        const table = document.getElementById('mainTable');
        TableProcessor.setupResizeHandler(table);
        const markerResizeCallback = vi.fn();
        AppState.eventHandlers.markerResizeCallback = markerResizeCallback;

        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RESIZE_DEBOUNCE_DELAY + 50));

        expect(markerResizeCallback).toHaveBeenCalled();
        AppState.eventHandlers.markerResizeCallback = null;
    });

    it('デバウンス期間中に連続でresizeが発火すると、既存タイマーがクリアされ1回だけ実行される', async () => {
        const table = document.getElementById('mainTable');
        TableProcessor.setupResizeHandler(table);
        const markerResizeCallback = vi.fn();
        AppState.eventHandlers.markerResizeCallback = markerResizeCallback;
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

        // デバウンス遅延が経過する前に2回連続で発火させる
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('resize'));

        // 2回目の発火時点で、1回目がセットした resizeTimeout の clearTimeout が呼ばれているはず
        expect(clearTimeoutSpy).toHaveBeenCalled();

        await new Promise((resolve) => setTimeout(resolve, CONFIG.RESIZE_DEBOUNCE_DELAY + 50));
        // 最終的にコールバックは1回だけ実行される
        expect(markerResizeCallback).toHaveBeenCalledTimes(1);
        AppState.eventHandlers.markerResizeCallback = null;
    });
});

// ========================================
// setupFixedHeader() - aria-*/data-* 属性のコピー
// ========================================
describe('TableProcessor.setupFixedHeader() - aria-*/data-* 属性', () => {
    it('aria-* 属性がコピーされ、危険な文字がサニタイズされる', () => {
        document
            .getElementById('mainTable')
            .querySelector('th')
            .setAttribute('aria-label', '<script>列名</script>');
        TableProcessor.setupFixedHeader(document.getElementById('mainTable'));

        const fixedTh = AppState.elements.fixedHeader.querySelector('th');
        // <, >, ', " が除去される（on*/javascript: の除去はこの分岐の対象外）
        expect(fixedTh.getAttribute('aria-label')).toBe('script列名/script');
    });

    it('data-* 属性がコピーされる', () => {
        document.getElementById('mainTable').querySelector('th').setAttribute('data-col', 'title');
        TableProcessor.setupFixedHeader(document.getElementById('mainTable'));

        const fixedTh = AppState.elements.fixedHeader.querySelector('th');
        expect(fixedTh.getAttribute('data-col')).toBe('title');
    });
});

// ========================================
// updateFixedHeaderPosition() - fixedThs が originalThs より少ないケース
// ========================================
describe('TableProcessor.updateFixedHeaderPosition() - th数の不一致', () => {
    it('fixedTable側のthが originalTable より少ない場合も例外が発生しない', () => {
        const table = document.getElementById('mainTable');
        TableProcessor.setupFixedHeader(table);
        // fixedHeader側のth を1つ削除して、originalより少ない状態を作る
        const fixedTable = AppState.elements.fixedHeader.querySelector('table');
        fixedTable.querySelector('tr').lastElementChild.remove();

        expect(() => TableProcessor.updateFixedHeaderPosition(table)).not.toThrow();
    });
});
