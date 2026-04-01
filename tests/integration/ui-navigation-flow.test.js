/**
 * tests/integration/ui-navigation-flow.test.js
 *
 * 統合テスト: UI・ナビゲーションフロー
 *
 * 検証対象:
 *   EventManager → Navigation → AppState の連携。
 *   ボタンクリックやリセット操作が AppState と DOM に正しく反映されるかを
 *   実モジュールを結合して検証する。
 *
 * モック方針:
 *   - FileHandler.process: ファイル選択イベントの副作用を抑制
 *   - BlockMarkerGenerator.jumpToBlock: DOM 描画の副作用を抑制
 *   - BlockMarkerGenerator.updateBlockInfo: 同上
 *   - BlockMarkerGenerator.cleanupDelegation: クリーンアップ副作用を抑制
 *   - HTMLProcessor.removeImportedStyle: DOM 副作用を抑制
 *   - UI.clearViewer / UI.showMessage: 表示副作用を抑制
 *   それ以外（EventManager / Navigation / AppState）は実装を使用。
 *
 * v2 変更点:
 *   - AppState に diffRows / useBlockMode は存在しない
 *   - ナビゲーションは FileHandler.jumpToNextDiffEnhanced に一元化
 *   - locationPane は locationPaneLeft / locationPaneRight の2ペイン構造
 *   - キーボードナビゲーション（J/K キー）は v2 未実装のためテスト対象外
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventManager } from '../../js/event-manager.js';
import { Navigation } from '../../js/navigation.js';
import { FileHandler } from '../../js/file-handler.js';
import { BlockMarkerGenerator } from '../../js/diff-detector.js';
import { HTMLProcessor } from '../../js/html-processor.js';
import { UI } from '../../js/ui.js';

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
            <div id="viewer"></div>
            <div id="diffInfo" class="info-hidden"></div>
            <button id="resetButton" class="button-hidden"></button>
            <button id="scrollTopButton" class="button-hidden"></button>
            <button id="prevDiffButton" class="button-hidden"></button>
            <button id="nextDiffButton" class="button-hidden"></button>
            <div id="fixedHeader" class="fixed-header-hidden">
                <table><tr id="fixedHeaderRow"></tr></table>
            </div>
            <div id="toolHeader" class="toolHeader-visible"></div>
            <div id="dropArea"></div>
            <input id="fileInput" type="file" />
        </div>
    `;
    AppState.init();
}

/**
 * AppState に差分ブロックをセットして「ファイル読み込み済み」状態を再現する
 */
function setupDiffBlocks(count = 3) {
    AppState.diffBlocks = Array.from({ length: count }, (_, i) => ({
        id: i,
        type: 'changed',
        color: 'rgb(239, 203, 5)',
        rows: [Object.assign(document.createElement('tr'), {
            scrollIntoView: vi.fn()
        })],
        startIndex: i,
        endIndex: i,
    }));
    AppState.currentDiffIndex = -1;
}

beforeEach(() => {
    setupDOM();
    AppState.isProcessing = false;
    AppState.currentDiffIndex = -1;
    AppState.diffBlocks = [];

    // 副作用を抑制するモック
    vi.spyOn(FileHandler, 'process').mockImplementation(() => {});
    vi.spyOn(BlockMarkerGenerator, 'jumpToBlock').mockImplementation(() => {});
    vi.spyOn(BlockMarkerGenerator, 'updateBlockInfo').mockImplementation(() => {});
    vi.spyOn(BlockMarkerGenerator, 'cleanupDelegation').mockImplementation(() => {});
    vi.spyOn(HTMLProcessor, 'removeImportedStyle').mockImplementation(() => {});
    vi.spyOn(UI, 'clearViewer').mockImplementation(() => {});
    vi.spyOn(UI, 'showMessage').mockImplementation(() => {});

    // EventManager を初期化
    EventManager.initializeEventListeners();
});

afterEach(() => {
    EventManager.cleanup();
    vi.restoreAllMocks();
});

// ========================================
// 統合テスト: ナビゲーションボタン
// ========================================
describe('UIナビゲーションフロー - 次の差分・前の差分', () => {

    it('nextDiffButton クリックで BlockMarkerGenerator.jumpToBlock が呼ばれる', () => {
        setupDiffBlocks(3);
        // _stepRender で登録される onclick を手動で設定
        AppState.elements.nextDiffButton.onclick = FileHandler.jumpToNextDiffEnhanced;

        AppState.elements.nextDiffButton.click();

        expect(BlockMarkerGenerator.jumpToBlock).toHaveBeenCalledOnce();
    });

    it('prevDiffButton クリックで BlockMarkerGenerator.jumpToBlock が呼ばれる', () => {
        setupDiffBlocks(3);
        AppState.elements.prevDiffButton.onclick = FileHandler.jumpToPrevDiffEnhanced;
        AppState.currentDiffIndex = 1;

        AppState.elements.prevDiffButton.click();

        expect(BlockMarkerGenerator.jumpToBlock).toHaveBeenCalledOnce();
    });

    it('次へ → 次へ の順で jumpToBlock が2回呼ばれる', () => {
        setupDiffBlocks(3);
        AppState.elements.nextDiffButton.onclick = FileHandler.jumpToNextDiffEnhanced;

        AppState.elements.nextDiffButton.click();
        AppState.elements.nextDiffButton.click();

        expect(BlockMarkerGenerator.jumpToBlock).toHaveBeenCalledTimes(2);
    });

    it('diffBlocks が空のとき nextDiffButton クリックで UI.showMessage が呼ばれる', () => {
        AppState.diffBlocks = [];
        AppState.elements.nextDiffButton.onclick = FileHandler.jumpToNextDiffEnhanced;

        AppState.elements.nextDiffButton.click();

        expect(UI.showMessage).toHaveBeenCalledOnce();
    });

    it('diffBlocks が空のとき prevDiffButton クリックで UI.showMessage が呼ばれる', () => {
        AppState.diffBlocks = [];
        AppState.elements.prevDiffButton.onclick = FileHandler.jumpToPrevDiffEnhanced;

        AppState.elements.prevDiffButton.click();

        expect(UI.showMessage).toHaveBeenCalledOnce();
    });
});

// ========================================
// 統合テスト: リセットボタン
// ========================================
describe('UIナビゲーションフロー - リセット', () => {

    it('resetButton クリックで Navigation.resetInterface が呼ばれる', () => {
        vi.spyOn(Navigation, 'resetInterface').mockImplementation(() => {});

        AppState.elements.resetButton.click();

        expect(Navigation.resetInterface).toHaveBeenCalledOnce();
    });

    it('resetButton クリック後に AppState がリセットされる', () => {
        // resetInterface の実装を通す（モックしない）
        AppState.currentDiffIndex = 2;
        AppState.isProcessing = false;

        AppState.elements.resetButton.click();

        expect(AppState.currentDiffIndex).toBe(-1);
    });

    it('resetButton クリック後に dropArea が表示される', () => {
        AppState.elements.dropArea.style.display = 'none';

        AppState.elements.resetButton.click();

        expect(AppState.elements.dropArea.style.display).toBe('block');
    });
});

// ========================================
// 統合テスト: ドロップエリア
// ========================================
describe('UIナビゲーションフロー - ドロップエリア', () => {

    it('dropArea クリックで fileInput.click が呼ばれる', () => {
        const clickSpy = vi.spyOn(AppState.elements.fileInput, 'click').mockImplementation(() => {});

        AppState.elements.dropArea.click();

        expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('isProcessing=true のとき dropArea クリックで fileInput.click が呼ばれない', () => {
        const clickSpy = vi.spyOn(AppState.elements.fileInput, 'click').mockImplementation(() => {});
        AppState.isProcessing = true;

        AppState.elements.dropArea.click();

        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('ファイルドロップで FileHandler.process が呼ばれる', () => {
        // jsdom では DragEvent / DataTransfer が未定義のため、
        // EventManager.handleDrop() を直接呼び出してドロップ処理を検証する
        const file = new File(['test'], 'test.htm', { type: 'text/html' });
        const fakeEvent = { dataTransfer: { files: [file] } };

        EventManager.handleDrop(fakeEvent);

        expect(FileHandler.process).toHaveBeenCalledWith(file);
    });
});

// ========================================
// 統合テスト: AppState との連携
// ========================================
describe('UIナビゲーションフロー - AppState 連携', () => {

    it('EventManager 初期化後に cleanup しても例外が発生しない', () => {
        expect(() => EventManager.cleanup()).not.toThrow();
    });

    it('cleanup 後に再初期化しても例外が発生しない', () => {
        EventManager.cleanup();
        expect(() => EventManager.initializeEventListeners()).not.toThrow();
    });
});
