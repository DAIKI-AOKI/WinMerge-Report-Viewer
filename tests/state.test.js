/**
 * state.js のユニットテスト
 *
 * 検証方針:
 *   - 初期値が仕様通りか
 *   - reset() で状態が完全に戻るか
 *   - cleanupTimers() でタイマーが解放されるか
 *   - cleanupEventHandlers() でハンドラが解放されるか
 *   - Logger の enabled 判定が正しいか
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ========================================
// テスト用 HTML fixture
// AppState.init() が document.getElementById を呼ぶため
// jsdom 上に必要な要素を用意する
// ========================================
function setupDOM() {
    document.body.innerHTML = `
        <input id="fileInput" />
        <div id="viewer"></div>
        <div id="diffContent"></div>
        <div id="locationPane"></div>
        <div id="dropArea"></div>
        <button id="resetButton"></button>
        <button id="scrollTopButton"></button>
        <button id="prevDiffButton"></button>
        <button id="nextDiffButton"></button>
        <div id="diffInfo"></div>
        <div id="fixedHeader"></div>
        <div id="fixedHeader">
            <table><tr id="fixedHeaderRow"></tr></table>
        </div>
        <div id="toolHeader"></div>
    `;
}

// ========================================
// AppState - 初期値
// ========================================
describe('AppState - 初期値', () => {
    it('isProcessing の初期値が false である', () => {
        expect(AppState.isProcessing).toBe(false);
    });

    it('currentDiffIndex の初期値が -1 である', () => {
        expect(AppState.currentDiffIndex).toBe(-1);
    });

    it('diffRows の初期値が空配列である', () => {
        expect(Array.isArray(AppState.diffRows)).toBe(true);
        expect(AppState.diffRows).toHaveLength(0);
    });

    it('diffBlocks の初期値が空配列である', () => {
        expect(Array.isArray(AppState.diffBlocks)).toBe(true);
        expect(AppState.diffBlocks).toHaveLength(0);
    });

    it('useBlockMode の初期値が false である', () => {
        expect(AppState.useBlockMode).toBe(false);
    });

    it('cachedMarkerData の初期値が正しい構造を持つ', () => {
        expect(AppState.cachedMarkerData.tableHash).toBeNull();
        expect(AppState.cachedMarkerData.diffRows).toHaveLength(0);
        expect(AppState.cachedMarkerData.markers).toHaveLength(0);
    });

    it('isNavigatingToDiff の初期値が false である', () => {
        expect(AppState.isNavigatingToDiff).toBe(false);
    });

    it('isScrollingToTop の初期値が false である', () => {
        expect(AppState.isScrollingToTop).toBe(false);
    });
});

// ========================================
// AppState.init()
// ========================================
describe('AppState.init()', () => {
    beforeEach(() => {
        setupDOM();
        AppState.init();
    });

    it('elements が null でなくなる', () => {
        expect(AppState.elements).not.toBeNull();
    });

    it('主要な DOM 要素がすべて取得できる', () => {
        const keys = [
            'fileInput', 'viewer', 'diffContent', 'locationPane',
            'dropArea', 'resetButton', 'scrollTopButton',
            'prevDiffButton', 'nextDiffButton', 'diffInfo',
            'fixedHeader', 'fixedHeaderRow', 'toolHeader'
        ];
        keys.forEach(key => {
            expect(AppState.elements[key], `elements.${key} が null`).not.toBeNull();
        });
    });
});

// ========================================
// AppState.reset()
// ========================================
describe('AppState.reset()', () => {
    beforeEach(() => {
        setupDOM();
        AppState.init();
        // 意図的に汚染した状態を作る
        AppState.isProcessing = true;
        AppState.currentDiffIndex = 5;
        AppState.isNavigatingToDiff = true;
        AppState.useBlockMode = true;
        AppState.diffBlocks = [{ id: 0 }];
        AppState.diffRows = [{ element: document.createElement('tr'), index: 0 }];
    });

    it('isProcessing が false にリセットされる', () => {
        AppState.reset();
        expect(AppState.isProcessing).toBe(false);
    });

    it('currentDiffIndex が -1 にリセットされる', () => {
        AppState.reset();
        expect(AppState.currentDiffIndex).toBe(-1);
    });

    it('isNavigatingToDiff が false にリセットされる', () => {
        AppState.reset();
        expect(AppState.isNavigatingToDiff).toBe(false);
    });

    it('useBlockMode が false にリセットされる', () => {
        AppState.reset();
        expect(AppState.useBlockMode).toBe(false);
    });

    it('diffBlocks が空配列にリセットされる', () => {
        AppState.reset();
        expect(AppState.diffBlocks).toHaveLength(0);
    });

    it('diffRows が空配列にリセットされる', () => {
        AppState.reset();
        expect(AppState.diffRows).toHaveLength(0);
    });

    it('cachedMarkerData が初期状態にリセットされる', () => {
        AppState.cachedMarkerData = { tableHash: 123, diffRows: [{}], markers: [{}] };
        AppState.reset();
        expect(AppState.cachedMarkerData.tableHash).toBeNull();
        expect(AppState.cachedMarkerData.diffRows).toHaveLength(0);
        expect(AppState.cachedMarkerData.markers).toHaveLength(0);
    });

    it('IntersectionObserver が disconnect される', () => {
        const mockDisconnect = vi.fn();
        AppState.intersectionObserver = { disconnect: mockDisconnect };
        AppState.reset();
        expect(mockDisconnect).toHaveBeenCalledOnce();
        expect(AppState.intersectionObserver).toBeNull();
    });
});

// ========================================
// AppState.cleanupTimers()
// ========================================
describe('AppState.cleanupTimers()', () => {
    it('実行中のタイマーが clearInterval で解放される', () => {
        const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
        const fakeId = setInterval(() => {}, 99999);
        AppState.timers.memoryMonitor = fakeId;

        AppState.cleanupTimers();

        expect(clearIntervalSpy).toHaveBeenCalledWith(fakeId);
        expect(AppState.timers.memoryMonitor).toBeNull();
        clearIntervalSpy.mockRestore();
    });

    it('タイマーが null の場合は何もしない', () => {
        AppState.timers.memoryMonitor = null;
        expect(() => AppState.cleanupTimers()).not.toThrow();
    });
});

// ========================================
// AppState.cleanupEventHandlers()
// ========================================
describe('AppState.cleanupEventHandlers()', () => {
    beforeEach(() => {
        setupDOM();
        AppState.init();
    });

    it('keydown ハンドラが document から削除される', () => {
        const handler = vi.fn();
        document.addEventListener('keydown', handler);
        AppState.eventHandlers.keydown = handler;

        AppState.cleanupEventHandlers();

        expect(AppState.eventHandlers.keydown).toBeNull();
    });

    it('resizeTimeout が clearTimeout で解放される', () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const fakeId = setTimeout(() => {}, 99999);
        AppState.eventHandlers.resizeTimeout = fakeId;

        AppState.cleanupEventHandlers();

        expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeId);
        expect(AppState.eventHandlers.resizeTimeout).toBeNull();
        clearTimeoutSpy.mockRestore();
    });

    it('ハンドラがすべて null でも例外が発生しない', () => {
        Object.keys(AppState.eventHandlers).forEach(k => {
            AppState.eventHandlers[k] = null;
        });
        expect(() => AppState.cleanupEventHandlers()).not.toThrow();
    });
});

// ========================================
// Logger
// ========================================
describe('Logger', () => {
    it('enabled が boolean を返す', () => {
        expect(typeof Logger.enabled).toBe('boolean');
    });

    it('テスト環境（localhost）では enabled が true になる', () => {
        // jsdom のデフォルト hostname は 'localhost'
        expect(Logger.enabled).toBe(true);
    });

    it('log() を呼んでも例外が発生しない', () => {
        expect(() => Logger.log('test')).not.toThrow();
    });

    it('warn() を呼んでも例外が発生しない', () => {
        expect(() => Logger.warn('test')).not.toThrow();
    });

    it('error() を呼んでも例外が発生しない', () => {
        expect(() => Logger.error('test')).not.toThrow();
    });
});
