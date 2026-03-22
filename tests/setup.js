/**
 * tests/setup.js - テスト環境セットアップ（フェーズ2対応版）
 *
 * ESM 移行前の暫定対応として、各ソースファイルを読み込んで
 * グローバルスコープに展開します。
 *
 * 読み込み順序はブラウザでの <script> タグ依存順と同じにすること。
 * 依存順:
 *   config.js → errors.js → state.js（Logger含む）
 *   → utils.js → error-handler.js
 *   → table-processor.js → diff-detector.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsDir = resolve(__dirname, '../js');

function loadGlobal(filepath) {
    const code = readFileSync(filepath, 'utf-8')
        .replace(/^\s*'use strict';\s*/m, '')
        .replace(/\bconst\b/g, 'var')
        .replace(/\blet\b/g, 'var')
        // class 宣言をグローバルへの代入式に変換
        .replace(/\bclass\s+(\w+)(\s+extends\s+[\w.]+)?\s*\{/g, (match, name, ext) => {
            return `globalThis.${name} = class ${name}${ext || ''} {`;
        });
    (0, eval)(code);
}

// 1. config.js
loadGlobal(resolve(jsDir, 'config.js'));
global.CONFIG             = CONFIG;
global.DRAG_EVENTS        = DRAG_EVENTS;
global.HIGHLIGHT_EVENTS   = HIGHLIGHT_EVENTS;
global.UNHIGHLIGHT_EVENTS = UNHIGHLIGHT_EVENTS;

// 2. errors.js
loadGlobal(resolve(jsDir, 'errors.js'));
global.FileValidationError  = FileValidationError;
global.FileProcessingError  = FileProcessingError;
global.HTMLParsingError     = HTMLParsingError;
global.TableProcessingError = TableProcessingError;
global.NavigationError      = NavigationError;

// 3. state.js（Logger を含む）
loadGlobal(resolve(jsDir, 'state.js'));
global.AppState = AppState;
global.Logger   = Logger;

// 4. utils.js
loadGlobal(resolve(jsDir, 'utils.js'));
global.Utils      = Utils;
global.CSSManager = CSSManager;

// 5. error-handler.js
//    UI.showMessage は各テストでモックするためダミーを先に定義
global.UI = {
    showMessage: () => {},
    showLoading: () => {},
    showFileInfo: () => {},
    clearViewer:  () => {},
};
loadGlobal(resolve(jsDir, 'error-handler.js'));
global.ErrorHandler = ErrorHandler;

// 6. table-processor.js
//    IntersectionObserver は jsdom 未実装のためモックを先に定義
global.IntersectionObserver = class {
    constructor(cb) { this._cb = cb; }
    observe()    {}
    unobserve()  {}
    disconnect() {}
};
loadGlobal(resolve(jsDir, 'table-processor.js'));
global.TableProcessor = TableProcessor;

// 7. diff-detector.js
loadGlobal(resolve(jsDir, 'diff-detector.js'));
global.DiffBlockDetector    = DiffBlockDetector;
global.BlockMarkerGenerator = BlockMarkerGenerator;

// ─────────────────────────────────────────────
// 8. html-processor.js（依存: config.js, state.js, errors.js, table-processor.js）
// ─────────────────────────────────────────────
loadGlobal(resolve(jsDir, 'html-processor.js'));
global.HTMLProcessor = HTMLProcessor;

// ─────────────────────────────────────────────
// 9. file-handler.js
//    依存モジュールが多いため、テストファイル側で個別にモックする。
//    ここでは読み込みエラーを防ぐ最小限のスタブを定義する。
// ─────────────────────────────────────────────
global.ProgressIndicator = class {
    show()               {}
    hide()               {}
    showError()          {}
    updateStepProgress() {}
};
global.Navigation = {
    resetInterface:            () => {},
    clearCurrentDiffHighlight: () => {},
    clearMarkerSelection:      () => {},
    jumpToNextDiff:            () => {},
    jumpToPrevDiff:            () => {},
    highlightSelectedMarker:   () => {},
};
global.MarkerModeToggle = {
    initialize: () => {},
    show:       () => {},
    hide:       () => {},
    cleanup:    () => {},
};
global.MarkerManager = {
    generate:          () => {},
    cleanup:           () => {},
    updateDiffInfo:    () => {},
    cleanupDelegation: () => {},
};

loadGlobal(resolve(jsDir, 'file-handler.js'));
global.FileHandler = FileHandler;
