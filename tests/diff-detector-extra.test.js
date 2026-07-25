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
    return {
        id, type: 'changed', color: 'rgb(239, 203, 5)',
        startIndex: id * rowCount, endIndex: id * rowCount + rowCount - 1, rows
    };
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
        const paneLeft = AppState.elements.locationPaneLeft;
        const marker = document.createElement('div');
        marker.classList.add('block-marker');
        paneLeft.appendChild(marker);
        BlockMarkerGenerator.cleanup();
        expect(paneLeft.querySelectorAll('.block-marker').length).toBe(0);
    });
});

// ========================================
// マーカークリック委譲 (handleBlockMarkerClick)
// ========================================
describe('BlockMarkerGenerator - マーカークリック委譲', () => {
    it('marker をクリックすると該当ブロックへジャンプする', () => {
        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];
        BlockMarkerGenerator.cleanup();
        BlockMarkerGenerator.generateBlockMarkers([], null);

        const paneLeft = AppState.elements.locationPaneLeft;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'block-marker');
        marker.dataset.blockIndex = '0';
        paneLeft.appendChild(marker);

        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(AppState.currentDiffIndex).toBe(0);
    });

    it('無効な index の marker をクリックしても例外が発生しない', () => {
        AppState.diffBlocks = [makeBlock(0, 2)];
        BlockMarkerGenerator.cleanup();
        BlockMarkerGenerator.generateBlockMarkers([], null);

        const paneLeft = AppState.elements.locationPaneLeft;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'block-marker');
        marker.dataset.blockIndex = '99';
        paneLeft.appendChild(marker);

        expect(() => marker.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
        expect(AppState.currentDiffIndex).toBe(-1);
    });
});

// ========================================
// ホバー時のハイライト (mouseover/mouseout)
// ========================================
describe('BlockMarkerGenerator - ホバー時のハイライト', () => {
    it('mouseover で左右両ペインの同じ index のマーカーに block-marker-hover が付く', () => {
        BlockMarkerGenerator.cleanup();
        BlockMarkerGenerator.generateBlockMarkers([], null);

        const paneLeft = AppState.elements.locationPaneLeft;
        const paneRight = AppState.elements.locationPaneRight;

        const markerLeft = document.createElement('div');
        markerLeft.classList.add('marker', 'block-marker');
        markerLeft.dataset.blockIndex = '0';
        paneLeft.appendChild(markerLeft);

        const markerRight = document.createElement('div');
        markerRight.classList.add('marker', 'block-marker');
        markerRight.dataset.blockIndex = '0';
        paneRight.appendChild(markerRight);

        markerLeft.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        expect(markerLeft.classList.contains('block-marker-hover')).toBe(true);
        expect(markerRight.classList.contains('block-marker-hover')).toBe(true);
    });

    it('mouseout で block-marker-hover が外れる', () => {
        BlockMarkerGenerator.cleanup();
        BlockMarkerGenerator.generateBlockMarkers([], null);

        const paneLeft = AppState.elements.locationPaneLeft;
        const marker = document.createElement('div');
        marker.classList.add('marker', 'block-marker', 'block-marker-hover');
        marker.dataset.blockIndex = '0';
        paneLeft.appendChild(marker);

        marker.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

        expect(marker.classList.contains('block-marker-hover')).toBe(false);
    });
});

// ========================================
// cleanupDelegation() - パネル不在時の警告
// ========================================
describe('BlockMarkerGenerator.cleanupDelegation() - パネル不在', () => {
    it('locationPaneLeft/Right が両方とも存在しない場合は警告して早期リターンする', () => {
        AppState.elements.locationPaneLeft = null;
        AppState.elements.locationPaneRight = null;
        expect(() => BlockMarkerGenerator.cleanupDelegation()).not.toThrow();
    });
});
