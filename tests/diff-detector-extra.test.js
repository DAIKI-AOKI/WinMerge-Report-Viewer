/**
 * diff-detector.js 追加テスト
 * cleanupDelegation / updateBlockHighlight をカバー
 */

import { BlockMarkerGenerator } from '../js/diff-detector.js';
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

function makeBlock(id = 0, rowCount = 2) {
    const rows = Array.from({ length: rowCount }, () => {
        const tr = document.createElement('tr');
        tr.scrollIntoView = vi.fn();
        return tr;
    });
    return { id, type: 'changed', color: 'rgb(239, 203, 5)',
             startIndex: id * rowCount, endIndex: id * rowCount + rowCount - 1, rows };
}

beforeEach(() => {
    setupDOM();
    AppState.diffBlocks = [];
    AppState.currentDiffIndex = -1;
});

// ========================================
// cleanupDelegation()
// ========================================
describe('BlockMarkerGenerator.cleanupDelegation()', () => {
    it('例外が発生しない', () => {
        expect(() => BlockMarkerGenerator.cleanupDelegation()).not.toThrow();
    });

    it('cleanup() 後に cleanupDelegation() を呼んでも例外が発生しない', () => {
        BlockMarkerGenerator.cleanup();
        expect(() => BlockMarkerGenerator.cleanupDelegation()).not.toThrow();
    });
});

// ========================================
// updateBlockHighlight()
// ========================================
describe('BlockMarkerGenerator.updateBlockHighlight()', () => {
    it('diffBlocks が空のとき例外が発生しない', () => {
        AppState.diffBlocks = [];
        expect(() => BlockMarkerGenerator.updateBlockHighlight()).not.toThrow();
    });

    it('currentDiffIndex が -1 のとき例外が発生しない', () => {
        AppState.diffBlocks = [makeBlock(0)];
        AppState.currentDiffIndex = -1;
        expect(() => BlockMarkerGenerator.updateBlockHighlight()).not.toThrow();
    });

    it('有効なブロックで例外が発生しない', () => {
        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];
        AppState.currentDiffIndex = 0;
        expect(() => BlockMarkerGenerator.updateBlockHighlight()).not.toThrow();
    });
});

// ========================================
// cleanup() の追加確認
// ========================================
describe('BlockMarkerGenerator.cleanup() - 追加', () => {
    it('locationPane 内の block-marker が削除される', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('block-marker');
        locationPane.appendChild(marker);

        BlockMarkerGenerator.cleanup();

        expect(locationPane.querySelectorAll('.block-marker').length).toBe(0);
    });
});
