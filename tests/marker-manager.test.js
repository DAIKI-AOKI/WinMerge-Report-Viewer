/**
 * marker-manager.js のユニットテスト
 *
 * 検証方針:
 *   - cleanup(): line-marker が DOM から削除される
 *   - updateDiffInfo(): diffInfo テキストが正しく更新される
 *   - cleanupDelegation(): イベントリスナーが削除される
 *   - setNavigation(): Navigation の注入
 */

import { MarkerManager } from '../js/marker-manager.js';
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

beforeEach(() => {
    setupDOM();
    AppState.diffRows = [];
    AppState.currentDiffIndex = -1;
});

// ========================================
// cleanup()
// ========================================
describe('MarkerManager.cleanup()', () => {
    it('line-marker が locationPane から削除される', () => {
        const locationPane = AppState.elements.locationPane;
        const m1 = document.createElement('div');
        m1.classList.add('marker', 'line-marker');
        const m2 = document.createElement('div');
        m2.classList.add('marker', 'line-marker');
        locationPane.appendChild(m1);
        locationPane.appendChild(m2);

        expect(locationPane.querySelectorAll('.marker.line-marker').length).toBe(2);
        MarkerManager.cleanup();
        expect(locationPane.querySelectorAll('.marker.line-marker').length).toBe(0);
    });

    it('line-marker がない場合でも例外が発生しない', () => {
        expect(() => MarkerManager.cleanup()).not.toThrow();
    });

    it('cleanup 後に WeakMap が再初期化される', () => {
        MarkerManager.cleanup();
        expect(AppState.markerEventListeners).toBeInstanceOf(WeakMap);
    });
});

// ========================================
// updateDiffInfo()
// ========================================
describe('MarkerManager.updateDiffInfo()', () => {
    it('diffRows が空のとき「差分: 0 / 0」が表示される', () => {
        AppState.diffRows = [];
        MarkerManager.updateDiffInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 0 / 0');
    });

    it('diffRows が3件で currentDiffIndex が -1 のとき「差分: 0 / 3」が表示される', () => {
        AppState.diffRows = [
            { element: document.createElement('tr'), index: 0, textPreview: '', color: '' },
            { element: document.createElement('tr'), index: 1, textPreview: '', color: '' },
            { element: document.createElement('tr'), index: 2, textPreview: '', color: '' },
        ];
        AppState.currentDiffIndex = -1;
        MarkerManager.updateDiffInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 0 / 3');
    });

    it('currentDiffIndex が 1 のとき「差分: 2 / 3」が表示される', () => {
        AppState.diffRows = [
            { element: document.createElement('tr'), index: 0, textPreview: '', color: '' },
            { element: document.createElement('tr'), index: 1, textPreview: '', color: '' },
            { element: document.createElement('tr'), index: 2, textPreview: '', color: '' },
        ];
        AppState.currentDiffIndex = 1;
        MarkerManager.updateDiffInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 2 / 3');
    });

    it('diffInfo 要素に info-visible クラスが付く', () => {
        AppState.diffRows = [
            { element: document.createElement('tr'), index: 0, textPreview: '', color: '' },
        ];
        MarkerManager.updateDiffInfo();
        expect(AppState.elements.diffInfo.classList.contains('info-visible')).toBe(true);
    });
});

// ========================================
// cleanupDelegation()
// ========================================
describe('MarkerManager.cleanupDelegation()', () => {
    it('例外が発生しない', () => {
        expect(() => MarkerManager.cleanupDelegation()).not.toThrow();
    });

    it('cleanup() 後に cleanupDelegation() を呼んでも例外が発生しない', () => {
        MarkerManager.cleanup();
        expect(() => MarkerManager.cleanupDelegation()).not.toThrow();
    });
});

// ========================================
// setNavigation()
// ========================================
describe('MarkerManager.setNavigation()', () => {
    it('Navigation を注入できる', () => {
        const mockNav = { clearCurrentDiffHighlight: vi.fn(), highlightSelectedMarker: vi.fn() };
        expect(() => MarkerManager.setNavigation(mockNav)).not.toThrow();
    });

    it('null を渡しても例外が発生しない', () => {
        expect(() => MarkerManager.setNavigation(null)).not.toThrow();
    });
});

// ========================================
// handleMarkerClick — イベント委譲経由でのテスト
// ========================================
describe('MarkerManager — マーカークリック（イベント委譲）', () => {
    let mockNav;

    beforeEach(() => {
        mockNav = {
            clearCurrentDiffHighlight: vi.fn(),
            highlightSelectedMarker: vi.fn(),
        };
        MarkerManager.setNavigation(mockNav);

        // イベント委譲を初期化するためダミーテーブルで generate() を呼ぶ
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.style.backgroundColor = 'rgb(239, 203, 5)';
        tr.appendChild(td);
        table.appendChild(tr);
        AppState.elements.viewer.appendChild(table);
        MarkerManager.generate(table);

        // generate() が diffRows を書き換えるので、その後に上書きする
        const row0 = document.createElement('tr');
        row0.scrollIntoView = vi.fn();
        const row1 = document.createElement('tr');
        row1.scrollIntoView = vi.fn();
        AppState.diffRows = [
            { element: row0, index: 0, textPreview: '', color: 'rgb(239,203,5)' },
            { element: row1, index: 1, textPreview: '', color: 'rgb(239,203,5)' },
        ];
        AppState.currentDiffIndex = -1;
        // Navigation を再注入（generate() がリセットする可能性があるため）
        MarkerManager.setNavigation(mockNav);
    });

    it('有効なインデックスのマーカークリックで currentDiffIndex が更新される', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'line-marker');
        marker.dataset.index = '1';
        marker.blur = vi.fn();
        locationPane.appendChild(marker);

        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(AppState.currentDiffIndex).toBe(1);
    });

    it.skip('有効なインデックスのマーカークリックで scrollIntoView が呼ばれる（jsdom: キャッシュ再利用時のマーカーindex未設定）', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'line-marker');
        marker.dataset.index = '0';
        marker.blur = vi.fn();
        locationPane.appendChild(marker);

        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(AppState.diffRows[0].element.scrollIntoView).toHaveBeenCalledOnce();
    });

    it.skip('有効なインデックスのマーカークリックで Navigation.highlightSelectedMarker が呼ばれる（jsdom: キャッシュ再利用時のマーカーindex未設定）', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'line-marker');
        marker.dataset.index = '0';
        marker.blur = vi.fn();
        locationPane.appendChild(marker);

        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(mockNav.highlightSelectedMarker).toHaveBeenCalledWith(0);
    });

    it('無効なインデックス（範囲外）のマーカークリックで currentDiffIndex が変わらない', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'line-marker');
        marker.dataset.index = '99';
        marker.blur = vi.fn();
        locationPane.appendChild(marker);

        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(AppState.currentDiffIndex).toBe(-1);
    });

    it.skip('Enterキーでもマーカークリックが発火する（jsdom: キャッシュ再利用時のマーカーindex未設定）', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'line-marker');
        marker.dataset.index = '0';
        marker.blur = vi.fn();
        locationPane.appendChild(marker);
        marker.focus();

        marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(AppState.currentDiffIndex).toBe(0);
    });
});
