/**
 * error-handler.js のユニットテスト
 *
 * 検証方針:
 *   - 各エラー型に対して正しいハンドラが呼ばれるか
 *   - handle() の後に AppState.isProcessing が false になるか
 *   - UI.showMessage に渡されるメッセージ・typeが正しいか
 *   - logError() が必要な情報を含むか
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ========================================
// UI.showMessage のモック
// ErrorHandler は UI.showMessage を呼ぶため差し替える
// ========================================
function setupUIMock() {
    global.UI = {
        showMessage: vi.fn(),
    };
}

// ========================================
// ErrorHandler.handle() - エラー型ごとの振り分け
// ========================================
describe('ErrorHandler.handle() - エラー型の振り分け', () => {
    beforeEach(() => {
        setupUIMock();
        AppState.isProcessing = true; // handle() 後に false になることを確認
    });

    it('FileValidationError → handleFileValidationError が呼ばれる', () => {
        const spy = vi.spyOn(ErrorHandler, 'handleFileValidationError');
        const err = new FileValidationError('テスト', 'NO_FILE');
        ErrorHandler.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
    });

    it('FileProcessingError → handleFileProcessingError が呼ばれる', () => {
        const spy = vi.spyOn(ErrorHandler, 'handleFileProcessingError');
        const err = new FileProcessingError('テスト', 'read');
        ErrorHandler.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
    });

    it('HTMLParsingError → handleHTMLParsingError が呼ばれる', () => {
        const spy = vi.spyOn(ErrorHandler, 'handleHTMLParsingError');
        const err = new HTMLParsingError('テスト');
        ErrorHandler.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
    });

    it('TableProcessingError → handleTableProcessingError が呼ばれる', () => {
        const spy = vi.spyOn(ErrorHandler, 'handleTableProcessingError');
        const err = new TableProcessingError('テスト');
        ErrorHandler.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
    });

    it('NavigationError → handleNavigationError が呼ばれる', () => {
        const spy = vi.spyOn(ErrorHandler, 'handleNavigationError');
        const err = new NavigationError('テスト', 3);
        ErrorHandler.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
    });

    it('未知のエラー → handleUnknownError が呼ばれる', () => {
        const spy = vi.spyOn(ErrorHandler, 'handleUnknownError');
        const err = new Error('予期しないエラー');
        ErrorHandler.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
    });

    it('handle() 後に AppState.isProcessing が false になる', () => {
        ErrorHandler.handle(new Error('テスト'));
        expect(AppState.isProcessing).toBe(false);
    });
});

// ========================================
// FileValidationError のメッセージ表示
// ========================================
describe('ErrorHandler.handleFileValidationError()', () => {
    beforeEach(() => setupUIMock());

    it('UI.showMessage を warning タイプで呼ぶ', () => {
        const err = new FileValidationError('ファイルが選択されていません。', 'NO_FILE');
        ErrorHandler.handleFileValidationError(err);
        expect(UI.showMessage).toHaveBeenCalledWith(err.message, 'warning');
    });
});

// ========================================
// FileProcessingError - フェーズ別メッセージ
// ========================================
describe('ErrorHandler.handleFileProcessingError()', () => {
    beforeEach(() => setupUIMock());

    const phases = ['read', 'sanitize', 'parse', 'detect', 'marker', 'render'];

    phases.forEach(phase => {
        it(`phase="${phase}" で UI.showMessage が呼ばれる`, () => {
            const err = new FileProcessingError('失敗', phase);
            ErrorHandler.handleFileProcessingError(err);
            expect(UI.showMessage).toHaveBeenCalledOnce();
            // メッセージ末尾にコンソール誘導文が付く
            const [msg] = UI.showMessage.mock.calls[0];
            expect(msg).toContain('コンソール');
        });
    });

    it('未知の phase でもデフォルトメッセージが表示される', () => {
        const err = new FileProcessingError('失敗', 'unknown_phase');
        ErrorHandler.handleFileProcessingError(err);
        expect(UI.showMessage).toHaveBeenCalledOnce();
    });
});

// ========================================
// HTMLParsingError / TableProcessingError
// ========================================
describe('ErrorHandler.handleHTMLParsingError()', () => {
    beforeEach(() => setupUIMock());

    it('UI.showMessage を error タイプで呼ぶ', () => {
        ErrorHandler.handleHTMLParsingError(new HTMLParsingError('失敗'));
        const [, type] = UI.showMessage.mock.calls[0];
        expect(type).toBe('error');
    });
});

describe('ErrorHandler.handleTableProcessingError()', () => {
    beforeEach(() => setupUIMock());

    it('UI.showMessage を error タイプで呼ぶ', () => {
        ErrorHandler.handleTableProcessingError(new TableProcessingError('失敗'));
        const [, type] = UI.showMessage.mock.calls[0];
        expect(type).toBe('error');
    });
});

// ========================================
// NavigationError
// ========================================
describe('ErrorHandler.handleNavigationError()', () => {
    beforeEach(() => setupUIMock());

    it('UI.showMessage を warning タイプで呼ぶ', () => {
        const err = new NavigationError('差分が見つかりません。');
        ErrorHandler.handleNavigationError(err);
        expect(UI.showMessage).toHaveBeenCalledWith(err.message, 'warning');
    });
});

// ========================================
// logError() - 付加情報の記録
// ========================================
describe('ErrorHandler.logError()', () => {
    it('Logger.error が呼ばれる', () => {
        const spy = vi.spyOn(Logger, 'error').mockImplementation(() => {});
        ErrorHandler.logError(new Error('テスト'), 'ctx');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('originalError を持つ FileProcessingError の情報が含まれる', () => {
        const captured = [];
        const spy = vi.spyOn(Logger, 'error').mockImplementation((...args) => captured.push(args));

        const original = new Error('元エラー');
        const err = new FileProcessingError('失敗', 'parse', original);
        ErrorHandler.logError(err, 'parse-ctx');

        const info = captured[0][1]; // logError は ('Error occurred:', errorInfo) で呼ぶ
        expect(info.phase).toBe('parse');
        expect(info.originalError.message).toBe('元エラー');
        spy.mockRestore();
    });

    it('FileValidationError の code が記録される', () => {
        const captured = [];
        const spy = vi.spyOn(Logger, 'error').mockImplementation((...args) => captured.push(args));

        ErrorHandler.logError(new FileValidationError('失敗', 'FILE_TOO_LARGE'), 'validation');
        const info = captured[0][1];
        expect(info.code).toBe('FILE_TOO_LARGE');
        spy.mockRestore();
    });
});
