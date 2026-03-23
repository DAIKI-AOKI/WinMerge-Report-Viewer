/**
 * navigation.js のユニットテスト
 *
 * 検証方針:
 *   - jumpToNextDiff / jumpToPrevDiff の境界値動作
 *   - jumpToDiff の正常系・異常系
 *   - clearCurrentDiffHighlight / clearMarkerSelection の DOM 操作
 *   - highlightSelectedMarker のモード別動作
 */

import { Navigation } from '../js/navigation.js';
import { ErrorHandler } from '../js/error-handler.js';
import { MarkerManager } from '../js/marker-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
});

// ========================================
// テスト用ヘルパー
// ========================================

/**
 * 差分行データを作成
 */
function makeDiffRow(index = 0) {
    const el = document.createElement('tr');
    el.scrollIntoView = vi.fn();
    return {
        element: el,
        index,
        textPreview: `差分${index}`,
        color: 'rgb(239, 203, 5)',
    };
}

/**
 * AppState に diffRows をセット
 */
function setupDiffRows(count) {
    AppState.diffRows = Array.from({ length: count }, (_, i) => makeDiffRow(i));
    AppState.currentDiffIndex = -1;
}

// ========================================
// jumpToNextDiff()
// ========================================
describe('Navigation.jumpToNextDiff()', () => {
    beforeEach(() => {
        vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});
        vi.spyOn(MarkerManager, 'updateDiffInfo').mockImplementation(() => {});
    });

    it('diffRows が空のとき ErrorHandler.handle が呼ばれる', () => {
        AppState.diffRows = [];
        Navigation.jumpToNextDiff();
        expect(ErrorHandler.handle).toHaveBeenCalledOnce();
        const err = ErrorHandler.handle.mock.calls[0][0];
        expect(err.name).toBe('NavigationError');
    });

    it('currentDiffIndex が -1 のとき 0 番目にジャンプする', () => {
        setupDiffRows(3);
        AppState.currentDiffIndex = -1;
        Navigation.jumpToNextDiff();
        expect(AppState.currentDiffIndex).toBe(0);
    });

    it('currentDiffIndex が末尾のとき 0 に戻る（ループ）', () => {
        setupDiffRows(3);
        AppState.currentDiffIndex = 2;
        Navigation.jumpToNextDiff();
        expect(AppState.currentDiffIndex).toBe(0);
    });

    it('currentDiffIndex が中間のとき +1 される', () => {
        setupDiffRows(3);
        AppState.currentDiffIndex = 1;
        Navigation.jumpToNextDiff();
        expect(AppState.currentDiffIndex).toBe(2);
    });
});

// ========================================
// jumpToPrevDiff()
// ========================================
describe('Navigation.jumpToPrevDiff()', () => {
    beforeEach(() => {
        vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});
        vi.spyOn(MarkerManager, 'updateDiffInfo').mockImplementation(() => {});
    });

    it('diffRows が空のとき ErrorHandler.handle が呼ばれる', () => {
        AppState.diffRows = [];
        Navigation.jumpToPrevDiff();
        expect(ErrorHandler.handle).toHaveBeenCalledOnce();
        const err = ErrorHandler.handle.mock.calls[0][0];
        expect(err.name).toBe('NavigationError');
    });

    it('currentDiffIndex が 0 のとき末尾に移動する（ループ）', () => {
        setupDiffRows(3);
        AppState.currentDiffIndex = 0;
        Navigation.jumpToPrevDiff();
        expect(AppState.currentDiffIndex).toBe(2);
    });

    it('currentDiffIndex が -1 のとき末尾に移動する', () => {
        setupDiffRows(3);
        AppState.currentDiffIndex = -1;
        Navigation.jumpToPrevDiff();
        expect(AppState.currentDiffIndex).toBe(2);
    });

    it('currentDiffIndex が中間のとき -1 される', () => {
        setupDiffRows(3);
        AppState.currentDiffIndex = 2;
        Navigation.jumpToPrevDiff();
        expect(AppState.currentDiffIndex).toBe(1);
    });
});

// ========================================
// jumpToDiff()
// ========================================
describe('Navigation.jumpToDiff()', () => {
    beforeEach(() => {
        vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});
        vi.spyOn(MarkerManager, 'updateDiffInfo').mockImplementation(() => {});
    });

    it('有効なインデックスで scrollIntoView が呼ばれる', () => {
        setupDiffRows(3);
        Navigation.jumpToDiff(1);
        expect(AppState.diffRows[1].element.scrollIntoView).toHaveBeenCalledOnce();
    });

    it('有効なインデックスで current-diff クラスが付く', () => {
        setupDiffRows(3);
        Navigation.jumpToDiff(1);
        expect(AppState.diffRows[1].element.classList.contains('current-diff')).toBe(true);
    });

    it('インデックスが範囲外のとき ErrorHandler.handle が呼ばれる', () => {
        setupDiffRows(3);
        Navigation.jumpToDiff(5);
        expect(ErrorHandler.handle).toHaveBeenCalledOnce();
        const err = ErrorHandler.handle.mock.calls[0][0];
        expect(err.name).toBe('NavigationError');
    });

    it('インデックスが負のとき ErrorHandler.handle が呼ばれる', () => {
        setupDiffRows(3);
        Navigation.jumpToDiff(-1);
        expect(ErrorHandler.handle).toHaveBeenCalledOnce();
    });
});

// ========================================
// clearMarkerSelection()
// ========================================
describe('Navigation.clearMarkerSelection()', () => {
    it('marker-selected クラスが除去される', () => {
        const marker = document.createElement('div');
        marker.classList.add('marker-selected');
        document.body.appendChild(marker);

        Navigation.clearMarkerSelection();

        expect(marker.classList.contains('marker-selected')).toBe(false);
        marker.remove();
    });
});

// ========================================
// clearCurrentDiffHighlight()
// ========================================
describe('Navigation.clearCurrentDiffHighlight()', () => {
    it('current-diff クラスが除去される', () => {
        const row = document.createElement('tr');
        row.classList.add('current-diff');
        document.body.appendChild(row);

        Navigation.clearCurrentDiffHighlight();

        expect(row.classList.contains('current-diff')).toBe(false);
        row.remove();
    });

    it('block-highlight-wrapper 要素が削除される', () => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('block-highlight-wrapper');
        document.body.appendChild(wrapper);

        Navigation.clearCurrentDiffHighlight();

        expect(document.querySelector('.block-highlight-wrapper')).toBeNull();
    });

    it('box-shadow インラインスタイルがクリアされる', () => {
        const row = document.createElement('tr');
        row.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.6)';
        document.body.appendChild(row);

        Navigation.clearCurrentDiffHighlight();

        expect(row.style.boxShadow).toBe('');
        row.remove();
    });
});

// ========================================
// highlightSelectedMarker()
// ========================================
describe('Navigation.highlightSelectedMarker()', () => {
    it('ラインモード時: 該当マーカーに marker-selected クラスが付く', () => {
        AppState.useBlockMode = false;
        const marker = document.createElement('div');
        marker.classList.add('marker');
        marker.dataset.index = '1';
        document.body.appendChild(marker);

        Navigation.highlightSelectedMarker(1);

        expect(marker.classList.contains('marker-selected')).toBe(true);
        marker.remove();
    });

    it('ブロックモード時: block-marker に marker-selected クラスが付く', () => {
        AppState.useBlockMode = true;
        const marker = document.createElement('div');
        marker.classList.add('block-marker');
        marker.dataset.blockIndex = '2';
        document.body.appendChild(marker);

        Navigation.highlightSelectedMarker(2);

        expect(marker.classList.contains('marker-selected')).toBe(true);
        marker.remove();
    });
});
