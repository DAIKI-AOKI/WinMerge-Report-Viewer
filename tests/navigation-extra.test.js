/**
 * navigation.js 追加テスト
 * cleanupAllMarkers / resetInterface をカバー
 *
 * v2 変更点:
 *   - locationPane → locationPaneLeft / locationPaneRight の2ペイン構造
 */

import { Navigation } from '../js/navigation.js';
import { HTMLProcessor } from '../js/html-processor.js';
import { UI } from '../js/ui.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
});

function setupDOM() {
    document.body.innerHTML = `
        <div id="locationPane">
            <div id="locationPaneLeft"></div>
            <div id="locationPaneRight"></div>
        </div>
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
            <div id="toolHeader" class="toolHeader-hidden"></div>
            <div id="dropArea"></div>
            <input id="fileInput" type="file" />
        </div>
    `;
    AppState.init();
}

// ========================================
// cleanupAllMarkers()
// ========================================
describe('Navigation.cleanupAllMarkers()', () => {
    beforeEach(() => setupDOM());

    it('locationPaneLeft 内の .marker が削除される', () => {
        const paneLeft = AppState.elements.locationPaneLeft;
        const m1 = document.createElement('div');
        m1.classList.add('marker');
        const m2 = document.createElement('div');
        m2.classList.add('marker');
        paneLeft.appendChild(m1);
        paneLeft.appendChild(m2);

        Navigation.cleanupAllMarkers();

        expect(paneLeft.querySelectorAll('.marker').length).toBe(0);
    });

    it('locationPaneRight 内の .marker が削除される', () => {
        const paneRight = AppState.elements.locationPaneRight;
        const m = document.createElement('div');
        m.classList.add('marker');
        paneRight.appendChild(m);

        Navigation.cleanupAllMarkers();

        expect(paneRight.querySelectorAll('.marker').length).toBe(0);
    });

    it('マーカーが0件でも例外が発生しない', () => {
        expect(() => Navigation.cleanupAllMarkers()).not.toThrow();
    });
});

// ========================================
// resetInterface()
// ========================================
describe('Navigation.resetInterface()', () => {
    beforeEach(() => {
        setupDOM();
        vi.spyOn(HTMLProcessor, 'removeImportedStyle').mockImplementation(() => {});
        vi.spyOn(UI, 'clearViewer').mockImplementation(() => {});
        vi.spyOn(UI, 'showMessage').mockImplementation(() => {});
    });

    it('dropArea が display: block になる', () => {
        AppState.elements.dropArea.style.display = 'none';
        Navigation.resetInterface();
        expect(AppState.elements.dropArea.style.display).toBe('block');
    });

    it('fileInput の value がリセットされる', () => {
        Navigation.resetInterface();
        expect(AppState.elements.fileInput.value).toBe('');
    });

    it('diffContent のスクロール位置がリセットされる', () => {
        AppState.elements.diffContent.scrollTop = 100;
        Navigation.resetInterface();
        expect(AppState.elements.diffContent.scrollTop).toBe(0);
    });

    it('AppState.isProcessing が false になる', () => {
        AppState.isProcessing = true;
        Navigation.resetInterface();
        expect(AppState.isProcessing).toBe(false);
    });

    it('HTMLProcessor.removeImportedStyle が呼ばれる', () => {
        Navigation.resetInterface();
        expect(HTMLProcessor.removeImportedStyle).toHaveBeenCalledOnce();
    });

    it('UI.clearViewer が呼ばれる', () => {
        Navigation.resetInterface();
        expect(UI.clearViewer).toHaveBeenCalledOnce();
    });

    it('block-highlight-wrapper 要素が削除される', () => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('block-highlight-wrapper');
        document.body.appendChild(wrapper);

        Navigation.resetInterface();

        expect(document.querySelector('.block-highlight-wrapper')).toBeNull();
    });

    it('エラーが発生しても UI.showMessage が呼ばれる', () => {
        vi.spyOn(AppState, 'cleanupTimers').mockImplementation(() => {
            throw new Error('テストエラー');
        });
        Navigation.resetInterface();
        expect(UI.showMessage).toHaveBeenCalled();
    });
});
