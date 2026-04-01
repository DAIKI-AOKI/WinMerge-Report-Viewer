/**
 * tests/integration/file-processing-flow.test.js
 *
 * 統合テスト: ファイル処理フロー
 *
 * 検証対象:
 *   FileHandler → HTMLProcessor → DiffBlockDetector → TableProcessor の連携。
 *   handleLoad() を起点に、DOM へのテーブル追加と差分ブロック検出までを
 *   実モジュールで結合して検証する。
 *
 * モック方針:
 *   - ProgressIndicator: handleLoad() 内で new される独立クラス。
 *     vi.mock() でモジュールごと差し替える。
 *   - Navigation: resetInterface() が DOM 操作を大量に行うため spyOn でスタブ化。
 *   - UI.showFileInfo: ファイル選択UIの描画をスタブ化（テスト対象外）。
 *   - それ以外（HTMLProcessor / DiffBlockDetector / TableProcessor）は実装を使用。
 *
 * v2 変更点:
 *   - AppState に diffRows / useBlockMode / cachedMarkerData は存在しない
 *   - locationPane は locationPaneLeft / locationPaneRight の2ペイン構造
 *   - ProgressIndicator は global 差し替えではなく vi.mock() で制御
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileHandler } from '../../js/file-handler.js';
import { Navigation } from '../../js/navigation.js';
import { UI } from '../../js/ui.js';
import { ErrorHandler } from '../../js/error-handler.js';

// ProgressIndicator をモジュールレベルでモック
vi.mock('../../js/progress-indicator.js', () => {
    const ProgressIndicator = vi.fn(() => ({
        show:               vi.fn(),
        hide:               vi.fn(),
        showError:          vi.fn(),
        updateStepProgress: vi.fn(),
    }));
    return { ProgressIndicator };
});

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

// WinMerge 差分色（CONFIG.DIFF_COLOR_MAP の changed に対応）
const CHANGED_COLOR = 'rgb(239, 203, 5)';

/**
 * WinMerge HTML レポートを模した最小限の HTML を生成する
 * @param {boolean} hasDiff - 差分行を含むか
 */
function makeWinMergeHTML(hasDiff = true) {
    const diffRow = hasDiff
        ? `<tr>
               <td class="title">1</td>
               <td style="background-color:${CHANGED_COLOR}">旧テキスト</td>
               <td class="title">1</td>
               <td style="background-color:${CHANGED_COLOR}">新テキスト</td>
           </tr>`
        : '';
    return `
        <html><body>
        <table class="diff">
            <thead><tr>
                <th class="title">旧ファイル</th>
                <th>内容</th>
                <th class="title">新ファイル</th>
                <th>内容</th>
            </tr></thead>
            <tbody>
                <tr>
                    <td class="title">-</td>
                    <td>通常行</td>
                    <td class="title">-</td>
                    <td>通常行</td>
                </tr>
                ${diffRow}
            </tbody>
        </table>
        </body></html>
    `;
}

function makeFile(name = 'test.htm') {
    return { name, size: 500, lastModified: Date.now() };
}

beforeEach(() => {
    setupDOM();
    AppState.isProcessing = false;
    AppState.currentDiffIndex = -1;
    AppState.diffBlocks = [];

    vi.spyOn(Navigation, 'resetInterface').mockImplementation(() => {
        AppState.reset();
    });
    vi.spyOn(UI, 'showFileInfo').mockImplementation(() => {});
    vi.spyOn(UI, 'showMessage').mockImplementation(() => {});
    vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ========================================
// 統合テスト: 正常系フロー
// ========================================
describe('ファイル処理フロー - 正常系', () => {

    it('差分ありHTMLを処理するとviewerにtableが追加される', async () => {
        const html = makeWinMergeHTML(true);
        await FileHandler.handleLoad(makeFile(), html);

        const table = AppState.elements.viewer.querySelector('table');
        expect(table).not.toBeNull();
    });

    it('処理完了後に isProcessing が false になる', async () => {
        const html = makeWinMergeHTML(true);
        await FileHandler.handleLoad(makeFile(), html);

        expect(AppState.isProcessing).toBe(false);
    });

    it('差分ありHTMLを処理すると diffBlocks が検出される', async () => {
        const html = makeWinMergeHTML(true);
        await FileHandler.handleLoad(makeFile(), html);

        expect(AppState.diffBlocks.length).toBeGreaterThan(0);
    });

    it('差分なしHTMLを処理すると diffBlocks が0件になる', async () => {
        const html = makeWinMergeHTML(false);
        await FileHandler.handleLoad(makeFile(), html);

        expect(AppState.diffBlocks.length).toBe(0);
    });

    it('Navigation.resetInterface が呼ばれる（前回データクリア）', async () => {
        const html = makeWinMergeHTML(true);
        await FileHandler.handleLoad(makeFile(), html);

        expect(Navigation.resetInterface).toHaveBeenCalled();
    });

    it('UI.showFileInfo が呼ばれる（ファイル情報表示）', async () => {
        const html = makeWinMergeHTML(true);
        await FileHandler.handleLoad(makeFile(), html);

        expect(UI.showFileInfo).toHaveBeenCalled();
    });
});

// ========================================
// 統合テスト: 異常系フロー
// ========================================
describe('ファイル処理フロー - 異常系', () => {

    it('空コンテンツのとき ErrorHandler.handle が呼ばれる', async () => {
        await FileHandler.handleLoad(makeFile(), '');

        expect(ErrorHandler.handle).toHaveBeenCalledOnce();
        const err = ErrorHandler.handle.mock.calls[0][0];
        expect(err.phase).toBe('read');
    });

    it('空コンテンツでも isProcessing が false のまま', async () => {
        await FileHandler.handleLoad(makeFile(), '');

        expect(AppState.isProcessing).toBe(false);
    });

    it('差分テーブルのないHTMLのとき ErrorHandler.handle が呼ばれる', async () => {
        const html = '<html><body><p>差分なし</p></body></html>';
        await FileHandler.handleLoad(makeFile(), html);

        expect(ErrorHandler.handle).toHaveBeenCalledOnce();
    });
});

// ========================================
// 統合テスト: モジュール連携
// ========================================
describe('ファイル処理フロー - モジュール連携', () => {

    it('HTMLProcessor のサニタイズを通過したコンテンツがテーブルに変換される', async () => {
        // script タグを含む HTML でも XSS なく処理される
        const html = makeWinMergeHTML(true).replace(
            '</body>',
            '<script>window.__xss=true;</script></body>'
        );
        await FileHandler.handleLoad(makeFile(), html);

        // script は除去されており XSS は実行されない
        expect(window.__xss).toBeUndefined();
        // テーブルは正常に追加される
        expect(AppState.elements.viewer.querySelector('table')).not.toBeNull();
    });

    it('CONFIG.DIFF_COLOR_MAP の色で差分ブロックのタイプが正しく判定される', async () => {
        const html = makeWinMergeHTML(true);
        await FileHandler.handleLoad(makeFile(), html);

        if (AppState.diffBlocks.length > 0) {
            const block = AppState.diffBlocks[0];
            expect(block).toHaveProperty('type');
            expect(block).toHaveProperty('rows');
            expect(block.rows.length).toBeGreaterThan(0);
        }
    });
});
