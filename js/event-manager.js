/**
 * EventManager - イベント管理モジュール（メモリリーク完全対策版）
 * ドラッグ&ドロップ、マーカーモード切替、その他のイベントハンドラ
 * 依存: config.js, state.js, file-handler.js, navigation.js, diff-detector.js
 * 
 * @fileoverview イベントリスナーの管理とドラッグ&ドロップ処理
 */

'use strict';
import { CONFIG } from './config.js';
import { AppState, Logger } from './state.js';
import { CSSManager } from './utils.js';
import { FileHandler } from './file-handler.js';
import { Navigation } from './navigation.js';
import { DiffBlockDetector, BlockMarkerGenerator } from './diff-detector.js';
import { MarkerManager } from './marker-manager.js';

const EventManager = (() => {
    /** @type {string[]} ドラッグ&ドロップイベント名の配列 */
    const DRAG_EVENTS = ['dragenter', 'dragover', 'dragleave', 'drop'];
    /** @type {string[]} ハイライトイベント名の配列 */
    const HIGHLIGHT_EVENTS = ['dragenter', 'dragover'];
    /** @type {string[]} ハイライト解除イベント名の配列 */
    const UNHIGHLIGHT_EVENTS = ['dragleave', 'drop'];

    // ★メモリリーク対策: イベントハンドラの参照を保持
    /** @type {Object.<string, Function>} イベントハンドラの参照マップ */
    const eventHandlers = {
        fileInputChange: null,
        resetButtonClick: null,
        scrollTopButtonClick: null,
        dropAreaClick: null,
        dragPreventDefaults: null,
        dragHighlight: null,
        dragUnhighlight: null,
        drop: null
    };

    /**
     * 現在のモードでの差分総数を返す
     * ブロックモードと行モードで同じ分岐を各所に書く代わりに、
     * このヘルパーを使うことで将来のモード追加時の修正箇所を1か所に集約します。
     * @returns {number} 差分の総数
     */
    function getTotalDiffCount() {
        return AppState.useBlockMode
            ? (AppState.diffBlocks?.length ?? 0)
            : AppState.diffRows.length;
    }

    /**
     * ドラッグ&ドロップのデフォルト動作を防止
     * @param {Event} e - イベントオブジェクト
     * @returns {void}
     */
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * ドロップエリアをハイライト
     * @returns {void}
     */
    function highlight() {
        if (!AppState.isProcessing) {
            AppState.elements.dropArea.classList.add('drag-over');
        }
    }

    /**
     * ドロップエリアのハイライトを解除
     * @returns {void}
     */
    function unhighlight() {
        AppState.elements.dropArea.classList.remove('drag-over');
    }

    /**
     * ファイルドロップ処理
     * @param {DragEvent} e - ドラッグイベント
     * @returns {void}
     */
    function handleDrop(e) {
        if (AppState.isProcessing) return;
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            FileHandler.process(files[0]);
        }
    }

    /**
     * 初期イベントリスナーを登録（メモリリーク対策版）
     * @returns {void}
     */
    function initializeEventListeners() {
        const elements = AppState.elements;
        
        // ★修正: 既存のリスナーを先に削除（二重登録を防止）
        cleanup();
        
        // ★メモリリーク対策: ハンドラを変数に保存（クリーンアップ時に使用）
        
        // ファイル選択
        eventHandlers.fileInputChange = (e) => {
            const file = e.target.files[0];
            if (file) FileHandler.process(file);
        };
        elements.fileInput.addEventListener('change', eventHandlers.fileInputChange);
        
        // リセットボタン
        eventHandlers.resetButtonClick = () => Navigation.resetInterface();
        elements.resetButton.addEventListener('click', eventHandlers.resetButtonClick);
        
        // トップへスクロールボタン
        eventHandlers.scrollTopButtonClick = () => {
            AppState.isScrollingToTop = true;
            Navigation.clearCurrentDiffHighlight();
            Navigation.clearMarkerSelection();
            AppState.currentDiffIndex = -1;

            // ③ モード分岐の重複を getTotalDiffCount() で統一
            const total = getTotalDiffCount();
            if (total > 0) {
                elements.diffInfo.textContent = `差分: 0 / ${total}`;
            }

            elements.diffContent.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                AppState.currentDiffIndex = -1;
                AppState.isScrollingToTop = false;
            }, CONFIG.SCROLL_TO_TOP_RESET_DELAY_MS);
        };
        elements.scrollTopButton.addEventListener('click', eventHandlers.scrollTopButtonClick);
        
        // ドロップエリアクリック
        eventHandlers.dropAreaClick = () => {
            if (!AppState.isProcessing) {
                elements.fileInput.click();
            }
        };
        elements.dropArea.addEventListener('click', eventHandlers.dropAreaClick);
        
        // ドラッグ&ドロップイベント
        eventHandlers.dragPreventDefaults = preventDefaults;
        DRAG_EVENTS.forEach(eventName => {
            elements.dropArea.addEventListener(eventName, eventHandlers.dragPreventDefaults, false);
            document.body.addEventListener(eventName, eventHandlers.dragPreventDefaults, false);
        });
        
        eventHandlers.dragHighlight = highlight;
        HIGHLIGHT_EVENTS.forEach(eventName => {
            elements.dropArea.addEventListener(eventName, eventHandlers.dragHighlight, false);
        });
        
        eventHandlers.dragUnhighlight = unhighlight;
        UNHIGHLIGHT_EVENTS.forEach(eventName => {
            elements.dropArea.addEventListener(eventName, eventHandlers.dragUnhighlight, false);
        });
        
        eventHandlers.drop = handleDrop;
        elements.dropArea.addEventListener('drop', eventHandlers.drop, false);
        
        Logger.log('✅ Event listeners initialized with cleanup support');
    }

    /**
     * すべてのイベントリスナーをクリーンアップ（メモリリーク対策の要）
     * @returns {void}
     */
    function cleanup() {
        const elements = AppState.elements;
        
        if (!elements) {
            Logger.warn('Elements not found during EventManager cleanup');
            return;
        }
        
        Logger.log('=== EventManager クリーンアップ開始 ===');
        
        // ファイル選択
        if (eventHandlers.fileInputChange && elements.fileInput) {
            elements.fileInput.removeEventListener('change', eventHandlers.fileInputChange);
            eventHandlers.fileInputChange = null;
            Logger.log('✅ fileInput changeハンドラを削除');
        }
        
        // リセットボタン
        if (eventHandlers.resetButtonClick && elements.resetButton) {
            elements.resetButton.removeEventListener('click', eventHandlers.resetButtonClick);
            eventHandlers.resetButtonClick = null;
            Logger.log('✅ resetButton clickハンドラを削除');
        }
        
        // トップへスクロールボタン
        if (eventHandlers.scrollTopButtonClick && elements.scrollTopButton) {
            elements.scrollTopButton.removeEventListener('click', eventHandlers.scrollTopButtonClick);
            eventHandlers.scrollTopButtonClick = null;
            Logger.log('✅ scrollTopButton clickハンドラを削除');
        }
        
        // ドロップエリアクリック
        if (eventHandlers.dropAreaClick && elements.dropArea) {
            elements.dropArea.removeEventListener('click', eventHandlers.dropAreaClick);
            eventHandlers.dropAreaClick = null;
            Logger.log('✅ dropArea clickハンドラを削除');
        }
        
        // ドラッグ&ドロップイベント
        if (eventHandlers.dragPreventDefaults && elements.dropArea) {
            DRAG_EVENTS.forEach(eventName => {
                elements.dropArea.removeEventListener(eventName, eventHandlers.dragPreventDefaults, false);
                document.body.removeEventListener(eventName, eventHandlers.dragPreventDefaults, false);
            });
            eventHandlers.dragPreventDefaults = null;
            Logger.log('✅ drag preventDefaults ハンドラを削除');
        }
        
        if (eventHandlers.dragHighlight && elements.dropArea) {
            HIGHLIGHT_EVENTS.forEach(eventName => {
                elements.dropArea.removeEventListener(eventName, eventHandlers.dragHighlight, false);
            });
            eventHandlers.dragHighlight = null;
            Logger.log('✅ drag highlight ハンドラを削除');
        }
        
        if (eventHandlers.dragUnhighlight && elements.dropArea) {
            UNHIGHLIGHT_EVENTS.forEach(eventName => {
                elements.dropArea.removeEventListener(eventName, eventHandlers.dragUnhighlight, false);
            });
            eventHandlers.dragUnhighlight = null;
            Logger.log('✅ drag unhighlight ハンドラを削除');
        }
        
        if (eventHandlers.drop && elements.dropArea) {
            elements.dropArea.removeEventListener('drop', eventHandlers.drop, false);
            eventHandlers.drop = null;
            Logger.log('✅ drop ハンドラを削除');
        }
        
        Logger.log('=== EventManager クリーンアップ完了 ===');
    }

    // 公開API
    return {
        initializeEventListeners,
        cleanup,
        preventDefaults,
        highlight,
        unhighlight,
        handleDrop
    };
})();

// ========================================
// MarkerModeToggle - マーカーモード切替（メモリリーク対策版）
// ========================================
const MarkerModeToggle = (() => {
    /** @type {HTMLButtonElement|null} 切替ボタンの参照 */
    let toggleButton = null;
    
    /** @type {Function|null} クリックイベントハンドラの参照 */
    let clickHandler = null;
    
    /**
     * 切替ボタンを初期化
     * @returns {void}
     */
    function initialize() {
        _createToggleButton();
    }
    
    /**
     * 切替ボタンを作成
     * @private
     * @returns {void}
     */
    function _createToggleButton() {
        const existingBtn = document.getElementById('markerModeToggle');
        if (existingBtn) {
            // ★メモリリーク対策: 既存ボタンのイベントリスナーを削除
            if (clickHandler) {
                existingBtn.removeEventListener('click', clickHandler);
            }
            existingBtn.remove();
        }
        
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'markerModeToggle';
        toggleBtn.className = 'floating-button button-hidden';
        toggleBtn.innerHTML = '<i class="fas fa-layer-group icon" aria-hidden="true"></i>ブロック表示';
        
        toggleBtn.setAttribute('aria-label', 'マーカー表示モードを切り替え');
        toggleBtn.setAttribute('title', '行単位/ブロック単位を切り替え');
        
        // ★メモリリーク対策: ハンドラ参照を保持
        clickHandler = () => {
            toggleMode();
        };
        toggleBtn.addEventListener('click', clickHandler);
        
        AppState.elements.diffContent.appendChild(toggleBtn);
        AppState.elements.markerModeToggle = toggleBtn;
        toggleButton = toggleBtn;
        
        // 初期状態のCSSクラスを設定（mode-block / mode-line の背景色を適用するため）
        _updateToggleButton();
        
        Logger.log('✅ 切り替えボタンを作成');
    }
    
    /**
     * マーカーモードを切り替え
     * @returns {void}
     */
    function toggleMode() {
        const table = AppState.elements.viewer.querySelector('table');
        if (!table) {
            Logger.warn('テーブルが見つかりません');
            return;
        }
        
        AppState.useBlockMode = !AppState.useBlockMode;
        
        Logger.log(`マーカーモード切り替え: ${AppState.useBlockMode ? 'ブロック' : '行'}単位`);
        
        Navigation.clearCurrentDiffHighlight();
        AppState.currentDiffIndex = -1;
        
        if (AppState.useBlockMode) {
            _switchToBlockMode(table);
        } else {
            _switchToLineMode(table);
        }
        
        _updateToggleButton();
    }
    
    /**
     * ブロックモードに切替
     * @private
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function _switchToBlockMode(table) {
        MarkerManager.cleanup();
        AppState.diffBlocks = DiffBlockDetector.detectBlocks(table);
        BlockMarkerGenerator.generateBlockMarkers(AppState.diffBlocks, table);
        AppState.currentDiffIndex = -1;
        BlockMarkerGenerator.updateBlockInfo();
        
        Logger.log(`ブロックモード: ${AppState.diffBlocks.length}個のブロック`);
    }
    
    /**
     * 行単位モードに切替
     * @private
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function _switchToLineMode(table) {
        BlockMarkerGenerator.clearBlockMarkers();
        MarkerManager.generate(table);
        
        Logger.log(`行単位モード: ${AppState.diffRows.length}個の差分行`);
    }
    
    /**
     * ボタンの表示を更新
     * @private
     * @returns {void}
     */
    function _updateToggleButton() {
        const btn = AppState.elements.markerModeToggle;
        if (!btn) return;

        // style 直接操作をやめ、CSSクラスの付け替えで状態を表現
        btn.classList.toggle('mode-block', AppState.useBlockMode);
        btn.classList.toggle('mode-line',  !AppState.useBlockMode);

        if (AppState.useBlockMode) {
            btn.innerHTML = '<i class="fas fa-list icon" aria-hidden="true"></i>行表示';
        } else {
            btn.innerHTML = '<i class="fas fa-layer-group icon" aria-hidden="true"></i>ブロック表示';
        }
    }
    
    /**
     * ボタンを表示
     * @returns {void}
     */
    function show() {
        if (AppState.elements.markerModeToggle) {
            CSSManager.showElement(AppState.elements.markerModeToggle, 'button-visible', 'button-hidden');
        }
    }
    
    /**
     * ボタンを非表示
     * @returns {void}
     */
    function hide() {
        if (AppState.elements.markerModeToggle) {
            CSSManager.hideElement(AppState.elements.markerModeToggle, 'button-visible', 'button-hidden');
        }
    }

    /**
     * クリーンアップ（メモリリーク対策）
     * @returns {void}
     */
    function cleanup() {
        if (toggleButton && clickHandler) {
            toggleButton.removeEventListener('click', clickHandler);
            clickHandler = null;
            Logger.log('✅ MarkerModeToggle clickハンドラを削除');
        }
        
        if (toggleButton && toggleButton.parentNode) {
            toggleButton.remove();
            toggleButton = null;
            Logger.log('✅ MarkerModeToggle ボタンを削除');
        }
    }

    // 公開API
    return {
        initialize,
        toggleMode,
        show,
        hide,
        cleanup
    };
})();

// ★注意: グローバル汚染を避けるため、直接公開しない
// main.js で WinMergeViewer.EventManager と WinMergeViewer.MarkerModeToggle としてアクセス可能

export { EventManager, MarkerModeToggle };