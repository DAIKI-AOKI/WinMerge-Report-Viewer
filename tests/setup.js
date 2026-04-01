import { CONFIG, DRAG_EVENTS, HIGHLIGHT_EVENTS, UNHIGHLIGHT_EVENTS } from '../js/config.js';
import { FileValidationError, FileProcessingError, HTMLParsingError, TableProcessingError, NavigationError } from '../js/errors.js';
import { AppState, Logger } from '../js/state.js';
import { Utils, CSSManager } from '../js/utils.js';
import { ErrorHandler } from '../js/error-handler.js';
import { TableProcessor } from '../js/table-processor.js';
import { DiffBlockDetector, BlockMarkerGenerator } from '../js/diff-detector.js';
import { HTMLProcessor } from '../js/html-processor.js';
import { FileHandler } from '../js/file-handler.js';
import { Navigation } from '../js/navigation.js';
import { EventManager } from '../js/event-manager.js';

// グローバルに登録
global.CONFIG             = CONFIG;
global.DRAG_EVENTS        = DRAG_EVENTS;
global.HIGHLIGHT_EVENTS   = HIGHLIGHT_EVENTS;
global.UNHIGHLIGHT_EVENTS = UNHIGHLIGHT_EVENTS;

global.FileValidationError  = FileValidationError;
global.FileProcessingError  = FileProcessingError;
global.HTMLParsingError     = HTMLParsingError;
global.TableProcessingError = TableProcessingError;
global.NavigationError      = NavigationError;

global.AppState   = AppState;
global.Logger     = Logger;
global.Utils      = Utils;
global.CSSManager = CSSManager;

// UI はユニットテストではスタブ、統合テストでは vi.spyOn で上書きする
global.UI = {
    showMessage: () => {},
    showLoading: () => {},
    showFileInfo: () => {},
    clearViewer:  () => {},
};

global.ErrorHandler = ErrorHandler;

global.IntersectionObserver = class {
    constructor(cb) { this._cb = cb; }
    observe()    {}
    unobserve()  {}
    disconnect() {}
};

global.TableProcessor       = TableProcessor;
global.DiffBlockDetector    = DiffBlockDetector;
global.BlockMarkerGenerator = BlockMarkerGenerator;
global.HTMLProcessor        = HTMLProcessor;

global.ProgressIndicator = class {
    show()               {}
    hide()               {}
    showError()          {}
    updateStepProgress() {}
};

// Navigation: 実装モジュールをグローバルに登録する。
// ユニットテストでは vi.spyOn で個別にスタブ化、統合テストでは実装をそのまま使用。
global.Navigation = Navigation;

// EventManager: 統合テストで直接使用
global.EventManager = EventManager;

// MarkerModeToggle: v2 で削除済み。後方互換のためスタブを残す
global.MarkerModeToggle = {
    initialize: () => {},
    show:       () => {},
    hide:       () => {},
    cleanup:    () => {},
};

// MarkerManager: _legacy/ に隔離済み。後方互換のためスタブを残す
global.MarkerManager = {
    generate:          () => {},
    cleanup:           () => {},
    updateDiffInfo:    () => {},
    cleanupDelegation: () => {},
};

global.FileHandler = FileHandler;
