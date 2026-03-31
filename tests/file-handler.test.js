/**
 * file-handler.js のユニットテスト
 *
 * 検証方針:
 *   validate() の全パターンを網羅:
 *     - null → FileValidationError (NO_FILE)
 *     - 空ファイル名 → FileValidationError (INVALID_NAME)
 *     - 不正拡張子 → FileValidationError (INVALID_EXTENSION)
 *     - サイズ超過 → FileValidationError (FILE_TOO_LARGE)
 *     - 空ファイル(size=0) → FileValidationError (EMPTY_FILE)
 *     - 正常ファイル → true を返す
 *
 *   process(): FileReader への委譲と isProcessing ガードを検証
 *     - isProcessing=true のときは FileReader が起動しない
 *     - validate() 失敗時は ErrorHandler.handle() が呼ばれる
 *     - 正常ファイルで FileReader.readAsText() が呼ばれる
 *
 *   handleLoad() の各ステップ関数:
 *     handleLoad() は6ステップの async チェーンで構成されており、
 *     各モジュール(Navigation/UI/TableProcessor 等)が多い。
 *     ここではステップ関数が呼ぶ依存のモックで検証する。
 *
 *     _stepRead:
 *       - content が空のとき FileProcessingError (read) を投げる
 *       - 正常時に Navigation.resetInterface() が呼ばれる
 *
 *     _stepSanitize:
 *       - HTMLProcessor.sanitize() が空を返すと FileProcessingError (sanitize) を投げる
 *
 *     _stepDetect:
 *       - HTMLProcessor.processTable() が例外を投げると TableProcessingError になる
 *       - 正常時にテーブルが viewer に appendChild される
 *
 *   jumpToNextDiffEnhanced() / jumpToPrevDiffEnhanced():
 *     - ブロックが0件のとき UI.showMessage() が呼ばれる
 *     - BlockMarkerGenerator.jumpToBlock() が呼ばれる
 *     - 末尾から次へ → インデックスが 0 に戻る
 *     - 先頭から前へ → インデックスが末尾に戻る
 */

import { UI } from '../js/ui.js';
import { Navigation } from '../js/navigation.js';
import { BlockMarkerGenerator } from '../js/diff-detector.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HTMLProcessor } from '../js/html-processor.js';

// ========================================
// DOM フィクスチャ
// ========================================
function setupDOM() {
    document.body.innerHTML = `
        <input id="fileInput" />
        <div id="viewer"></div>
        <div id="diffContent"></div>
        <div id="locationPane">
            <div id="locationPaneLeft"></div>
            <div id="locationPaneRight"></div>
        </div>
        <div id="dropArea"></div>
        <button id="resetButton"></button>
        <button id="scrollTopButton"></button>
        <button id="prevDiffButton" class="button-hidden"></button>
        <button id="nextDiffButton" class="button-hidden"></button>
        <div id="diffInfo" class="info-hidden"></div>
        <div id="fixedHeader" class="fixed-header-hidden">
            <table><tr id="fixedHeaderRow"></tr></table>
        </div>
        <div id="toolHeader" class="toolHeader-visible"></div>
    `;
    AppState.init();
}

// ========================================
// モックファイルを生成するヘルパー
// ========================================
function makeFile({ name = 'test.htm', size = 100, type = 'text/html' } = {}) {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
}

// ========================================
// ProgressIndicator の最小モック
// ========================================
function makeProgressMock() {
    return {
        show:               vi.fn(),
        hide:               vi.fn(),
        showError:          vi.fn(),
        updateStepProgress: vi.fn(),
    };
}

beforeEach(() => {
    setupDOM();
    AppState.isProcessing = false;
    AppState.currentDiffIndex = -1;
    AppState.diffBlocks = [];

    // 各テストで共通して必要なモック
    vi.spyOn(UI, 'showMessage').mockImplementation(() => {});
    vi.spyOn(Navigation, 'resetInterface').mockImplementation(() => {});
    vi.spyOn(Navigation, 'clearCurrentDiffHighlight').mockImplementation(() => {});
    vi.spyOn(Navigation, 'highlightSelectedMarker').mockImplementation(() => {});
    vi.spyOn(BlockMarkerGenerator, 'jumpToBlock').mockImplementation(() => {});
    vi.spyOn(BlockMarkerGenerator, 'updateBlockInfo').mockImplementation(() => {});
    global.TableProcessor = {
        setupFixedHeader:            vi.fn(),
        setupIntersectionObserver:   vi.fn(),
        addRightBars:                vi.fn(),
        cleanupIntersectionObserver: vi.fn(),
    };
    global.HTMLProcessor = {
        sanitize:            vi.fn(html => html),
        importStyles:        vi.fn(),
        processTable:        vi.fn(() => {
            const t = document.createElement('table');
            t.innerHTML = '<tr><th>A</th></tr>';
            return t;
        }),
        removeImportedStyle: vi.fn(),
    };
    global.DiffBlockDetector = {
        detectBlocks: vi.fn(() => []),
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ========================================
// FileHandler.validate()
// ========================================
describe('FileHandler.validate()', () => {

    it('null を渡すと NO_FILE エラーを投げる', () => {
        expect(() => FileHandler.validate(null))
            .toThrow(expect.objectContaining({ code: 'NO_FILE' }));
    });

    it('空ファイル名は INVALID_NAME エラーを投げる', () => {
        expect(() => FileHandler.validate({ name: '', size: 100 }))
            .toThrow(expect.objectContaining({ code: 'INVALID_NAME' }));
    });

    it('.txt 拡張子は INVALID_EXTENSION エラーを投げる', () => {
        const file = makeFile({ name: 'report.txt' });
        expect(() => FileHandler.validate(file))
            .toThrow(expect.objectContaining({ code: 'INVALID_EXTENSION' }));
    });

    it('サイズ超過は FILE_TOO_LARGE エラーを投げる', () => {
        const overSize = CONFIG.MAX_FILE_SIZE + 1;
        const file = makeFile({ name: 'big.htm', size: overSize });
        expect(() => FileHandler.validate(file))
            .toThrow(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
    });

    it('size=0 は EMPTY_FILE エラーを投げる', () => {
        const file = makeFile({ name: 'empty.htm', size: 0 });
        expect(() => FileHandler.validate(file))
            .toThrow(expect.objectContaining({ code: 'EMPTY_FILE' }));
    });

    it('.htm ファイルは true を返す', () => {
        const file = makeFile({ name: 'report.htm', size: 500 });
        expect(FileHandler.validate(file)).toBe(true);
    });

    it('.html ファイルは true を返す', () => {
        const file = makeFile({ name: 'report.html', size: 500 });
        expect(FileHandler.validate(file)).toBe(true);
    });

    it('拡張子の大文字小文字を区別しない（.HTM）', () => {
        const file = makeFile({ name: 'REPORT.HTM', size: 500 });
        expect(FileHandler.validate(file)).toBe(true);
    });

    it('ちょうど MAX_FILE_SIZE のファイルは通る', () => {
        const file = makeFile({ name: 'limit.htm', size: CONFIG.MAX_FILE_SIZE });
        expect(FileHandler.validate(file)).toBe(true);
    });

    it('投げられるエラーは FileValidationError のインスタンスである', () => {
        expect(() => FileHandler.validate(null))
            .toThrow(FileValidationError);
    });
});

// ========================================
// FileHandler.process()
// ========================================
describe('FileHandler.process()', () => {

    it('isProcessing=true のときは何もしない', () => {
        AppState.isProcessing = true;
        const readSpy = vi.spyOn(FileReader.prototype, 'readAsText');
        FileHandler.process(makeFile({ name: 'test.htm' }));
        expect(readSpy).not.toHaveBeenCalled();
    });

    it('validate() が失敗すると ErrorHandler.handle() が呼ばれる', () => {
        const handleSpy = vi.spyOn(ErrorHandler, 'handle');
        FileHandler.process(makeFile({ name: 'bad.txt' }));
        expect(handleSpy).toHaveBeenCalledOnce();
        expect(handleSpy.mock.calls[0][0]).toBeInstanceOf(FileValidationError);
    });

    it('正常ファイルで FileReader.readAsText() が呼ばれる', () => {
        const readSpy = vi.spyOn(FileReader.prototype, 'readAsText');
        FileHandler.process(makeFile({ name: 'ok.htm', size: 200 }));
        expect(readSpy).toHaveBeenCalledOnce();
    });

    it('validate() 失敗後も isProcessing は false のまま', () => {
        FileHandler.process(makeFile({ name: 'bad.txt' }));
        expect(AppState.isProcessing).toBe(false);
    });
});

// ========================================
// FileHandler.handleLoad() - _stepRead
// ========================================
describe('FileHandler.handleLoad() - _stepRead', () => {

    it('content が空のとき FileProcessingError (read) が発生する', async () => {
        global.ProgressIndicator = vi.fn(() => makeProgressMock());
        const handleSpy = vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});

        await FileHandler.handleLoad(makeFile(), '');
        expect(handleSpy).toHaveBeenCalledOnce();
        const err = handleSpy.mock.calls[0][0];
        expect(err).toBeInstanceOf(FileProcessingError);
        expect(err.phase).toBe('read');
    });

    it('正常 content のとき Navigation.resetInterface() が呼ばれる', async () => {
        global.ProgressIndicator = vi.fn(() => makeProgressMock());

        const html = '<table class="diff"><tr><th>A</th></tr></table>';
        await FileHandler.handleLoad(makeFile(), html);

        expect(Navigation.resetInterface).toHaveBeenCalled();
    });
});

// ========================================
// FileHandler.handleLoad() - _stepSanitize
// ========================================
describe('FileHandler.handleLoad() - _stepSanitize', () => {

    it('HTMLProcessor.sanitize() が空を返すと FileProcessingError (sanitize) が発生する', async () => {
        global.ProgressIndicator = vi.fn(() => makeProgressMock());
        const handleSpy = vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});
        vi.spyOn(HTMLProcessor, 'sanitize').mockReturnValue('');

        const html = '<table><tr><td>A</td></tr></table>';
        await FileHandler.handleLoad(makeFile(), html);

        expect(handleSpy).toHaveBeenCalledOnce();
        const err = ErrorHandler.handle.mock.calls[0][0];
        expect(err).toBeInstanceOf(FileProcessingError);
        expect(err.phase).toBe('sanitize');
    });
});

// ========================================
// FileHandler.handleLoad() - _stepDetect
// ========================================
describe('FileHandler.handleLoad() - _stepDetect', () => {

    it('HTMLProcessor.processTable() が例外を投げると TableProcessingError が発生する', async () => {
        global.ProgressIndicator = vi.fn(() => makeProgressMock());
        const handleSpy = vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});
        global.HTMLProcessor.sanitize = vi.fn(html => html);
        global.HTMLProcessor.processTable = vi.fn(() => {
            throw new Error('テーブルなし');
        });

        const html = '<html><body><p>テーブルなし</p></body></html>';
        await FileHandler.handleLoad(makeFile(), html);

        expect(handleSpy).toHaveBeenCalledOnce();
        const err = handleSpy.mock.calls[0][0];
        expect(err).toBeInstanceOf(TableProcessingError);
    });

    it('正常時にテーブルが viewer に appendChild される', async () => {
        global.ProgressIndicator = vi.fn(() => makeProgressMock());

        const html = '<table class="diff"><tr><th>A</th></tr></table>';
        await FileHandler.handleLoad(makeFile(), html);

        const table = AppState.elements.viewer.querySelector('table');
        expect(table).not.toBeNull();
    });
});

// ========================================
// FileHandler.jumpToNextDiffEnhanced()
// ========================================
describe('FileHandler.jumpToNextDiffEnhanced()', () => {

    it('ブロックが0件のとき UI.showMessage が呼ばれる', () => {
        AppState.diffBlocks = [];
        FileHandler.jumpToNextDiffEnhanced();
        expect(UI.showMessage).toHaveBeenCalledOnce();
    });

    it('BlockMarkerGenerator.jumpToBlock() が呼ばれる', () => {
        AppState.currentDiffIndex = -1;
        AppState.diffBlocks = [{
            id: 0, type: 'changed', color: 'rgb(239,203,5)',
            rows: [document.createElement('tr')]
        }];
        FileHandler.jumpToNextDiffEnhanced();
        expect(BlockMarkerGenerator.jumpToBlock).toHaveBeenCalledOnce();
    });

    it('末尾から次へ → インデックスが 0 に戻る', () => {
        const rows = [document.createElement('tr')];
        AppState.diffBlocks = [
            { id: 0, rows },
            { id: 1, rows },
        ];
        AppState.currentDiffIndex = 1; // 末尾
        FileHandler.jumpToNextDiffEnhanced();
        // jumpToBlock に渡された第1引数が 0 であることを確認
        expect(BlockMarkerGenerator.jumpToBlock.mock.calls[0][0]).toBe(0);
    });
});

// ========================================
// FileHandler.jumpToPrevDiffEnhanced()
// ========================================
describe('FileHandler.jumpToPrevDiffEnhanced()', () => {

    it('ブロックが0件のとき UI.showMessage が呼ばれる', () => {
        AppState.diffBlocks = [];
        FileHandler.jumpToPrevDiffEnhanced();
        expect(UI.showMessage).toHaveBeenCalledOnce();
    });

    it('BlockMarkerGenerator.jumpToBlock() が呼ばれる', () => {
        AppState.currentDiffIndex = 1;
        AppState.diffBlocks = [
            { id: 0, rows: [document.createElement('tr')] },
            { id: 1, rows: [document.createElement('tr')] },
        ];
        FileHandler.jumpToPrevDiffEnhanced();
        expect(BlockMarkerGenerator.jumpToBlock).toHaveBeenCalledOnce();
    });

    it('先頭から前へ → インデックスが末尾に戻る', () => {
        const rows = [document.createElement('tr')];
        AppState.diffBlocks = [
            { id: 0, rows },
            { id: 1, rows },
        ];
        AppState.currentDiffIndex = 0; // 先頭
        FileHandler.jumpToPrevDiffEnhanced();
        // jumpToBlock に渡された第1引数が 1（末尾）であることを確認
        expect(BlockMarkerGenerator.jumpToBlock.mock.calls[0][0]).toBe(1);
    });
});
