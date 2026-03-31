/**
 * event-manager.js のユニットテスト
 *
 * 検証方針:
 *   EventManager:
 *     - getTotalDiffCount(): ブロック/ラインモードで正しい件数を返す
 *     - preventDefaults(): preventDefault/stopPropagation が呼ばれる
 *     - highlight(): drag-over クラスが付く
 *     - unhighlight(): drag-over クラスが取れる
 *     - handleDrop(): FileHandler.process が呼ばれる
 *     - initializeEventListeners(): イベントが登録される
 *     - cleanup(): イベントが削除される
 *   MarkerModeToggle:
 *     - show() / hide(): ボタンの表示切替
 *     - cleanup(): 例外なし
 */

import { EventManager } from '../js/event-manager.js';
import { FileHandler } from '../js/file-handler.js';
import { Navigation } from '../js/navigation.js';
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
    AppState.diffBlocks = [];
    AppState.isProcessing = false;
});

// ========================================
// preventDefaults()
// ========================================
describe('EventManager.preventDefaults()', () => {
    it('preventDefault と stopPropagation が呼ばれる', () => {
        const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
        EventManager.preventDefaults(e);
        expect(e.preventDefault).toHaveBeenCalledOnce();
        expect(e.stopPropagation).toHaveBeenCalledOnce();
    });
});

// ========================================
// highlight() / unhighlight()
// ========================================
describe('EventManager.highlight() / unhighlight()', () => {
    it('highlight() で dropArea に drag-over クラスが付く', () => {
        AppState.isProcessing = false;
        EventManager.highlight();
        expect(AppState.elements.dropArea.classList.contains('drag-over')).toBe(true);
    });

    it('isProcessing=true のとき highlight() は何もしない', () => {
        AppState.isProcessing = true;
        EventManager.highlight();
        expect(AppState.elements.dropArea.classList.contains('drag-over')).toBe(false);
    });

    it('unhighlight() で drag-over クラスが取れる', () => {
        AppState.elements.dropArea.classList.add('drag-over');
        EventManager.unhighlight();
        expect(AppState.elements.dropArea.classList.contains('drag-over')).toBe(false);
    });
});

// ========================================
// handleDrop()
// ========================================
describe('EventManager.handleDrop()', () => {
    it('ファイルがあるとき FileHandler.process が呼ばれる', () => {
        vi.spyOn(FileHandler, 'process').mockImplementation(() => {});
        const file = new File(['test'], 'test.htm', { type: 'text/html' });
        const e = { dataTransfer: { files: [file] } };
        EventManager.handleDrop(e);
        expect(FileHandler.process).toHaveBeenCalledWith(file);
    });

    it('isProcessing=true のとき FileHandler.process が呼ばれない', () => {
        vi.spyOn(FileHandler, 'process').mockImplementation(() => {});
        AppState.isProcessing = true;
        const file = new File(['test'], 'test.htm', { type: 'text/html' });
        const e = { dataTransfer: { files: [file] } };
        EventManager.handleDrop(e);
        expect(FileHandler.process).not.toHaveBeenCalled();
    });

    it('ファイルが空のとき FileHandler.process が呼ばれない', () => {
        vi.spyOn(FileHandler, 'process').mockImplementation(() => {});
        const e = { dataTransfer: { files: [] } };
        EventManager.handleDrop(e);
        expect(FileHandler.process).not.toHaveBeenCalled();
    });
});

// ========================================
// initializeEventListeners() / cleanup()
// ========================================
describe('EventManager.initializeEventListeners() / cleanup()', () => {
    it('initializeEventListeners() が例外なく実行される', () => {
        expect(() => EventManager.initializeEventListeners()).not.toThrow();
    });

    it('cleanup() が例外なく実行される', () => {
        EventManager.initializeEventListeners();
        expect(() => EventManager.cleanup()).not.toThrow();
    });

    it('cleanup() 後に再度 cleanup() を呼んでも例外が発生しない', () => {
        EventManager.initializeEventListeners();
        EventManager.cleanup();
        expect(() => EventManager.cleanup()).not.toThrow();
    });

    it('resetButton クリックで Navigation.resetInterface が呼ばれる', () => {
        vi.spyOn(Navigation, 'resetInterface').mockImplementation(() => {});
        EventManager.initializeEventListeners();
        AppState.elements.resetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(Navigation.resetInterface).toHaveBeenCalledOnce();
    });

    it('dropArea クリックで fileInput.click が呼ばれる', () => {
        const clickSpy = vi.spyOn(AppState.elements.fileInput, 'click').mockImplementation(() => {});
        EventManager.initializeEventListeners();
        AppState.elements.dropArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('isProcessing=true のとき dropArea クリックで fileInput.click が呼ばれない', () => {
        const clickSpy = vi.spyOn(AppState.elements.fileInput, 'click').mockImplementation(() => {});
        AppState.isProcessing = true;
        EventManager.initializeEventListeners();
        AppState.elements.dropArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickSpy).not.toHaveBeenCalled();
    });
});
