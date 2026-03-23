import { CONFIG, DRAG_EVENTS, HIGHLIGHT_EVENTS, UNHIGHLIGHT_EVENTS } from '../js/config.js';
import { FileValidationError, FileProcessingError, HTMLParsingError, TableProcessingError, NavigationError } from '../js/errors.js';
import { AppState, Logger } from '../js/state.js';
import { Utils, CSSManager } from '../js/utils.js';
import { ErrorHandler } from '../js/error-handler.js';
import { TableProcessor } from '../js/table-processor.js';
import { DiffBlockDetector, BlockMarkerGenerator } from '../js/diff-detector.js';
import { HTMLProcessor } from '../js/html-processor.js';
import { FileHandler } from '../js/file-handler.js';

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
global.TableProcessor = TableProcessor;
global.DiffBlockDetector    = DiffBlockDetector;
global.BlockMarkerGenerator = BlockMarkerGenerator;
global.HTMLProcessor = HTMLProcessor;
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
global.FileHandler = FileHandler;