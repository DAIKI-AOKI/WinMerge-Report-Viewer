/**
 * WinMerge Report Viewer - 状態管理
 * 
 * アプリケーション状態の管理とログ出力
 * 依存: なし
 * 
 * @fileoverview アプリケーション全体の状態管理とロギング機能
 */

'use strict';

/**
 * @typedef {Object} EventHandlers
 * @property {Function|null} keydown - キーボードイベントハンドラ
 * @property {Function|null} smoothUpdateViewport - ビューポート更新ハンドラ
 * @property {Function|null} debouncedResize - リサイズデバウンスハンドラ
 * @property {number|null} scrollAnimationFrame - スクロールアニメーションフレームID
 * @property {number|null} resizeTimeout - リサイズタイムアウトID
 */

/**
 * @typedef {Object} DOMElements
 * @property {HTMLInputElement} fileInput - ファイル入力要素
 * @property {HTMLElement} viewer - ビューワー要素
 * @property {HTMLElement} diffContent - 差分コンテンツ要素
 * @property {HTMLElement} locationPane - ロケーションペイン要素
 * @property {HTMLElement} dropArea - ドロップエリア要素
 * @property {HTMLButtonElement} resetButton - リセットボタン
 * @property {HTMLButtonElement} scrollTopButton - トップへスクロールボタン
 * @property {HTMLButtonElement} prevDiffButton - 前の差分ボタン
 * @property {HTMLButtonElement} nextDiffButton - 次の差分ボタン
 * @property {HTMLElement} diffInfo - 差分情報表示要素
 * @property {HTMLElement} fixedHeader - 固定ヘッダー要素
 * @property {HTMLTableRowElement} fixedHeaderRow - 固定ヘッダー行要素
 * @property {HTMLElement} toolHeader - ツールヘッダー要素
 * @property {HTMLButtonElement} [markerModeToggle] - マーカーモード切替ボタン（オプション）
 */

/**
 * @typedef {Object} DiffRowInfo
 * @property {HTMLTableRowElement} element - 差分行のDOM要素
 * @property {number} index - 差分インデックス
 * @property {string} textPreview - テキストプレビュー
 * @property {string} color - 背景色
 */

/**
 * @typedef {Object} DiffBlock
 * @property {number} id - ブロックID
 * @property {'changed'|'word'|'del'|'moved_from'|'moved_to'|'separator'|'unknown'} type - 差分タイプ（CONFIG.DIFF_COLOR_MAP の type 値に対応）
 * @property {string} color - 背景色
 * @property {number} startIndex - 開始行インデックス
 * @property {number} endIndex - 終了行インデックス
 * @property {HTMLTableRowElement[]} rows - 行要素の配列
 * @property {number} [top] - 上端位置（_placeBlockMarkers() 内の rAF で計算するため省略可）
 * @property {number} [height] - 高さ（同上）
 */

/**
 * @typedef {Object} CachedMarkerData
 * @property {number|null} tableHash - テーブルのハッシュ値
 * @property {DiffRowInfo[]} diffRows - キャッシュされた差分行情報
 * @property {HTMLElement[]} markers - キャッシュされたマーカー要素
 */

/**
 * @typedef {Object} Timers
 * @property {number|null} memoryMonitor - メモリ監視タイマーID
 */

/**
 * アプリケーション状態管理オブジェクト
 * @namespace AppState
 */
const AppState = {
    /** @type {EventHandlers} イベントハンドラの管理 */
    eventHandlers: {
        keydown: null,
        smoothUpdateViewport: null,
        debouncedResize: null,
        scrollAnimationFrame: null,
        resizeTimeout: null
    },
    
    /** @type {DOMElements|null} DOM要素への参照 */
    elements: null,
    
    /** @type {HTMLStyleElement|null} インポートされたスタイル要素 */
    importedStyleElem: null,
    
    /** @type {boolean} ファイル処理中フラグ */
    isProcessing: false,
    
    /** @type {DiffRowInfo[]} 差分行情報の配列 */
    diffRows: [],
    
    /** @type {DiffBlock[]} 差分ブロック情報の配列 */
    diffBlocks: [],
    
    /** @type {boolean} ブロックモード使用フラグ */
    useBlockMode: false,
    
    /** @type {CachedMarkerData} キャッシュされたマーカーデータ */
    cachedMarkerData: {
        tableHash: null,
        diffRows: [],
        markers: []
    },
    
    /** @type {WeakMap<HTMLElement, Object>} マーカーイベントリスナーの管理 */
    markerEventListeners: new WeakMap(),
    
    /** @type {number} 現在の差分インデックス */
    currentDiffIndex: -1,
    
    /** @type {boolean} 差分へのナビゲーション中フラグ */
    isNavigatingToDiff: false,
    
    /** @type {boolean} トップへスクロール中フラグ */
    isScrollingToTop: false,
    
    /** @type {IntersectionObserver|null} Intersection Observer インスタンス */
    intersectionObserver: null,
    
    /** @type {Timers} タイマー管理 */
    timers: {
        memoryMonitor: null
    },

    /**
     * アプリケーション状態を初期化
     * @returns {void}
     */
    init() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            viewer: document.getElementById('viewer'),
            diffContent: document.getElementById('diffContent'),
            locationPane: document.getElementById('locationPane'),
            dropArea: document.getElementById('dropArea'),
            resetButton: document.getElementById('resetButton'),
            scrollTopButton: document.getElementById('scrollTopButton'),
            prevDiffButton: document.getElementById('prevDiffButton'),
            nextDiffButton: document.getElementById('nextDiffButton'),
            diffInfo: document.getElementById('diffInfo'),
            fixedHeader: document.getElementById('fixedHeader'),
            fixedHeaderRow: document.getElementById('fixedHeaderRow'),
            toolHeader: document.getElementById('toolHeader')
        };
    },

    /**
     * タイマーをクリーンアップ
     * file-handler.js / navigation.js / main.js で重複定義されていたため
     * AppState に集約した。各モジュールはこのメソッドを呼び出すこと。
     * @returns {void}
     */
    cleanupTimers() {
        Object.keys(this.timers).forEach(key => {
            if (this.timers[key]) {
                clearInterval(this.timers[key]);
                this.timers[key] = null;
            }
        });
        Logger.log('✅ すべてのタイマーをクリーンアップ');
    },

    /**
     * アプリケーション状態をリセット
     * @returns {void}
     */
    reset() {
        this.isProcessing = false;
        this.currentDiffIndex = -1;
        this.isNavigatingToDiff = false;
        this.diffBlocks = [];
        this.useBlockMode = false;
        
        // 差分行のクリーンアップ
        if (Array.isArray(this.diffRows)) {
            this.diffRows.forEach(row => {
                if (row && typeof row === 'object') {
                    if (row.element) row.element = null;
                    Object.keys(row).forEach(key => { row[key] = null; });
                }
            });
            this.diffRows.length = 0;
            this.diffRows = [];
        }

        // キャッシュデータのクリーンアップ
        if (this.cachedMarkerData) {
            if (this.cachedMarkerData.markers && Array.isArray(this.cachedMarkerData.markers)) {
                const lp = this.elements?.locationPane;
                if (lp) {
                    this.cachedMarkerData.markers.forEach(marker => {
                        if (marker && marker.remove) {
                            try {
                                const listeners = this.markerEventListeners?.get(marker);
                                if (listeners) {
                                    marker.removeEventListener('click', listeners.click);
                                    marker.removeEventListener('keydown', listeners.keydown);
                                    this.markerEventListeners.delete(marker);
                                }
                                if (lp.contains(marker)) marker.remove();
                            } catch (e) {
                                Logger.warn('Marker removal failed:', e);
                            }
                        }
                    });
                }
            }

            if (this.cachedMarkerData.diffRows) {
                this.cachedMarkerData.diffRows.forEach(row => {
                    if (row && row.element) row.element = null;
                });
            }

            this.cachedMarkerData = {
                tableHash: null,
                diffRows: [],
                markers: []
            };
        }

        // IntersectionObserverのクリーンアップ
        if (this.intersectionObserver) {
            try {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
            } catch (e) {
                Logger.warn('IntersectionObserver cleanup failed:', e);
            }
        }

        Logger.log('AppState reset completed');
    },

    /**
     * イベントハンドラをクリーンアップ
     * @returns {void}
     */
    cleanupEventHandlers() {
        try {
            // スクロールイベントハンドラの削除
            if (this.eventHandlers.smoothUpdateViewport && this.elements?.diffContent) {
                this.elements.diffContent.removeEventListener('scroll', this.eventHandlers.smoothUpdateViewport);
                this.eventHandlers.smoothUpdateViewport = null;
            }

            // アニメーションフレームのキャンセル
            if (this.eventHandlers.scrollAnimationFrame) {
                cancelAnimationFrame(this.eventHandlers.scrollAnimationFrame);
                this.eventHandlers.scrollAnimationFrame = null;
            }

            // リサイズイベントハンドラの削除
            if (this.eventHandlers.debouncedResize) {
                window.removeEventListener('resize', this.eventHandlers.debouncedResize);
                this.eventHandlers.debouncedResize = null;
            }

            // リサイズタイムアウトのクリア
            if (this.eventHandlers.resizeTimeout) {
                clearTimeout(this.eventHandlers.resizeTimeout);
                this.eventHandlers.resizeTimeout = null;
            }

            // キーボードイベントハンドラの削除
            if (this.eventHandlers.keydown) {
                document.removeEventListener('keydown', this.eventHandlers.keydown);
                this.eventHandlers.keydown = null;
            }

            // IntersectionObserverの切断
            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
            }

            Logger.log('All event handlers cleaned up');
        } catch (error) {
            Logger.error('Cleanup event handlers error:', error);
        }
    }
};

/**
 * ログ出力管理オブジェクト
 * @namespace Logger
 */
const Logger = {
    /**
     * デバッグモードが有効かどうかを判定
     * ★修正3: localStorage による判定を除去。
     *   理由: 社内PCで過去に localStorage.debug = 'true' がセットされた
     *   ブラウザでは意図せずデバッグモードが有効になり、
     *   通常非表示の「ブロック表示」切替ボタン等が露出してしまう。
     *   判定は localhost / 127.0.0.1 か URLパラメータ debug=true のみとする。
     *   手動でデバッグを有効にしたい場合は URL に ?debug=true を付与すること。
     * @returns {boolean} デバッグモードが有効な場合true
     */
    get enabled() {
        return window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=true');
    },
    
    /**
     * デバッグログを出力（デバッグモード時のみ）
     * @param {...*} args - 出力する引数
     * @returns {void}
     */
    log(...args) {
        if (this.enabled) console.log(...args);
    },
    
    /**
     * 警告ログを出力
     * @param {...*} args - 出力する引数
     * @returns {void}
     */
    warn(...args) {
        console.warn(...args);
    },
    
    /**
     * エラーログを出力
     * @param {...*} args - 出力する引数
     * @returns {void}
     */
    error(...args) {
        console.error(...args);
    }
};

export { AppState, Logger };