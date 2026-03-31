/**
 * navigation.js のユニットテスト
 *
 * 検証方針:
 *   - clearCurrentDiffHighlight / clearMarkerSelection の DOM 操作
 *   - highlightSelectedMarker のブロックモード動作
 *   - resetInterface / cleanupAllMarkers は navigation-extra.test.js でカバー
 *
 * v2 変更点:
 *   - jumpToNextDiff / jumpToPrevDiff / jumpToDiff は v2 で削除
 *     （ナビゲーションは file-handler.js の jumpToNextDiffEnhanced に一元化）
 *   - AppState.useBlockMode は v2 で削除（常にブロックモード）
 *   - MarkerManager は _legacy/ に隔離済みのため import 不可
 */

import { Navigation } from '../js/navigation.js';
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
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
    it('block-marker に marker-selected クラスが付く', () => {
        const marker = document.createElement('div');
        marker.classList.add('block-marker');
        marker.dataset.blockIndex = '2';
        document.body.appendChild(marker);

        Navigation.highlightSelectedMarker(2);

        expect(marker.classList.contains('marker-selected')).toBe(true);
        marker.remove();
    });

    it('既存の marker-selected が先にクリアされる', () => {
        const old = document.createElement('div');
        old.classList.add('marker-selected');
        document.body.appendChild(old);

        const marker = document.createElement('div');
        marker.classList.add('block-marker');
        marker.dataset.blockIndex = '0';
        document.body.appendChild(marker);

        Navigation.highlightSelectedMarker(0);

        expect(old.classList.contains('marker-selected')).toBe(false);
        old.remove();
        marker.remove();
    });
});
