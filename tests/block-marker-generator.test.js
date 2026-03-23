/**
 * diff-detector.js - BlockMarkerGenerator のユニットテスト
 */

import { BlockMarkerGenerator } from '../js/diff-detector.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// DOM セットアップ（AppState.elements が必要なテスト用）
// ========================================
function setupDOM() {
    document.body.innerHTML = `
        <div id="locationPane"></div>
        <div id="diffContent">
            <div id="diffInfo"></div>
            <div id="viewer"></div>
            <button id="resetButton"></button>
            <button id="scrollTopButton"></button>
            <button id="prevDiffButton"></button>
            <button id="nextDiffButton"></button>
            <div id="fixedHeader"><table><tr id="fixedHeaderRow"></tr></table></div>
            <div id="toolHeader"></div>
            <div id="dropArea"></div>
            <input id="fileInput" type="file" />
        </div>
    `;
    AppState.init();
}

beforeEach(() => {
    setupDOM();
    AppState.diffBlocks = [];
    AppState.currentDiffIndex = -1;
});

afterEach(() => {
    vi.restoreAllMocks();
    AppState.diffBlocks = [];
    AppState.currentDiffIndex = -1;
});

// ========================================
// テスト用ヘルパー
// ========================================
function makeBlock(id = 0, rowCount = 2) {
    const rows = Array.from({ length: rowCount }, () => {
        const tr = document.createElement('tr');
        tr.scrollIntoView = vi.fn();
        return tr;
    });
    return {
        id,
        type: 'changed',
        color: 'rgb(239, 203, 5)',
        startIndex: id * rowCount,
        endIndex: id * rowCount + rowCount - 1,
        rows,
    };
}

function makeTable(rowCount = 5) {
    const table = document.createElement('table');
    for (let i = 0; i < rowCount; i++) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = `行${i}`;
        tr.appendChild(td);
        table.appendChild(tr);
    }
    AppState.elements.viewer.appendChild(table);
    return table;
}

// ========================================
// updateBlockInfo()
// ========================================
describe('BlockMarkerGenerator.updateBlockInfo()', () => {
    it('diffBlocks が空のとき「差分: 0 / 0」が表示される', () => {
        AppState.diffBlocks = [];
        BlockMarkerGenerator.updateBlockInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 0 / 0');
    });

    it('diffBlocks が3件で currentDiffIndex が -1 のとき「差分: 0 / 3」が表示される', () => {
        AppState.diffBlocks = [makeBlock(0), makeBlock(1), makeBlock(2)];
        AppState.currentDiffIndex = -1;
        BlockMarkerGenerator.updateBlockInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 0 / 3');
    });

    it('currentDiffIndex が 1 のとき「差分: 2 / 3」が表示される', () => {
        AppState.diffBlocks = [makeBlock(0), makeBlock(1), makeBlock(2)];
        AppState.currentDiffIndex = 1;
        BlockMarkerGenerator.updateBlockInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 2 / 3');
    });

    it('currentDiffIndex が末尾のとき正しく表示される', () => {
        AppState.diffBlocks = [makeBlock(0), makeBlock(1)];
        AppState.currentDiffIndex = 1;
        BlockMarkerGenerator.updateBlockInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 2 / 2');
    });
});

// ========================================
// clearBlockMarkers()
// ========================================
describe('BlockMarkerGenerator.clearBlockMarkers()', () => {
    it('block-marker クラスの要素が locationPane から削除される', () => {
        const locationPane = AppState.elements.locationPane;
        const m1 = document.createElement('div');
        m1.classList.add('block-marker');
        const m2 = document.createElement('div');
        m2.classList.add('block-marker');
        locationPane.appendChild(m1);
        locationPane.appendChild(m2);
        expect(locationPane.querySelectorAll('.block-marker').length).toBe(2);
        BlockMarkerGenerator.clearBlockMarkers();
        expect(locationPane.querySelectorAll('.block-marker').length).toBe(0);
    });

    it('block-marker がない場合でも例外が発生しない', () => {
        expect(() => BlockMarkerGenerator.clearBlockMarkers()).not.toThrow();
    });
});

// ========================================
// generateBlockMarkers()
// ========================================
describe('BlockMarkerGenerator.generateBlockMarkers()', () => {
    it('blocks が空のとき locationPane にマーカーが追加されない', () => {
        const table = makeTable();
        BlockMarkerGenerator.generateBlockMarkers([], table);
        const markers = AppState.elements.locationPane.querySelectorAll('.block-marker');
        expect(markers.length).toBe(0);
    });

    it.skip('blocks が2件のとき locationPane に2つのマーカーが追加される（jsdom: scrollHeight=0のためrAF後のマーカー配置不可）', () => {
        const table = makeTable(5);
        const blocks = [makeBlock(0), makeBlock(1)];
        AppState.diffBlocks = blocks;
        BlockMarkerGenerator.generateBlockMarkers(blocks, table);
        const markers = AppState.elements.locationPane.querySelectorAll('.block-marker');
        expect(markers.length).toBe(2);
    });

    it.skip('マーカーに data-block-index が設定される（jsdom: scrollHeight=0のためrAF後のマーカー配置不可）', () => {
        const table = makeTable(5);
        const blocks = [makeBlock(0), makeBlock(1)];
        AppState.diffBlocks = blocks;
        BlockMarkerGenerator.generateBlockMarkers(blocks, table);
        const markers = AppState.elements.locationPane.querySelectorAll('.block-marker');
        expect(markers[0].dataset.blockIndex).toBe('0');
        expect(markers[1].dataset.blockIndex).toBe('1');
    });

    it.skip('マーカーに role=button と tabindex が設定される（jsdom: scrollHeight=0のためrAF後のマーカー配置不可）', () => {
        const table = makeTable(5);
        const blocks = [makeBlock(0)];
        AppState.diffBlocks = blocks;
        BlockMarkerGenerator.generateBlockMarkers(blocks, table);
        const marker = AppState.elements.locationPane.querySelector('.block-marker');
        expect(marker.getAttribute('role')).toBe('button');
        expect(marker.getAttribute('tabindex')).toBe('0');
    });
});

// ========================================
// jumpToBlock()
// ========================================
describe('BlockMarkerGenerator.jumpToBlock()', () => {
    it('ブロックの先頭行の scrollIntoView が呼ばれる', () => {
        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];
        BlockMarkerGenerator.jumpToBlock(0, block);
        expect(block.rows[0].scrollIntoView).toHaveBeenCalledOnce();
    });

    it('currentDiffIndex が更新される', () => {
        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];
        AppState.currentDiffIndex = -1;
        BlockMarkerGenerator.jumpToBlock(0, block);
        expect(AppState.currentDiffIndex).toBe(0);
    });

    it('rows が空のとき例外が発生しない', () => {
        const block = makeBlock(0, 0);
        AppState.diffBlocks = [block];
        expect(() => BlockMarkerGenerator.jumpToBlock(0, block)).not.toThrow();
    });
});

// ========================================
// cleanup()
// ========================================
describe('BlockMarkerGenerator.cleanup()', () => {
    it('locationPane 内の block-marker が削除される', () => {
        const locationPane = AppState.elements.locationPane;
        const marker = document.createElement('div');
        marker.classList.add('block-marker');
        locationPane.appendChild(marker);
        BlockMarkerGenerator.cleanup();
        expect(locationPane.querySelectorAll('.block-marker').length).toBe(0);
    });
});
