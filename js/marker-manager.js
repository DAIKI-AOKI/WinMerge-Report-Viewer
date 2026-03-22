/**
 * MarkerManager - マーカー管理モジュール（メモリリーク完全対策版）
 * 依存: config.js, state.js, utils.js, table-processor.js
 * 
 * @fileoverview 差分行マーカーの生成と管理を行うモジュール
 */

'use strict';

const MarkerManager = (() => {
    /** @type {boolean} イベント委譲の初期化フラグ */
    let delegatedEventsInitialized = false;
    
    /** @type {Function|null} クリックイベントハンドラの参照 */
    let clickHandler = null;
    
    /** @type {Function|null} キーボードイベントハンドラの参照 */
    let keydownHandler = null;

    /**
     * マーカーを生成
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function generate(table) {
        const tableHash = Utils.computeTableHash(table);
        const displayedRows = table.querySelectorAll('tr');
        const { locationPane, diffContent } = AppState.elements;
        
        // イベント委譲を初期化（最初の一度だけ）
        if (!delegatedEventsInitialized) {
            initializeDelegatedEvents();
            delegatedEventsInitialized = true;
        }
        
        // キャッシュが有効な場合は再利用
        if (AppState.cachedMarkerData.tableHash === tableHash) {
            Logger.log('キャッシュ済みマーカーを再利用:', AppState.cachedMarkerData.markers.length);
            cleanup();
            AppState.diffRows = AppState.cachedMarkerData.diffRows.map(r => ({ ...r }));
            AppState.cachedMarkerData.markers.forEach(marker => {
                locationPane.appendChild(marker);
            });
            // ★キャッシュ再利用時も rAF で位置を再計算する。
            // ウィンドウリサイズ後にキャッシュが再利用された場合、
            // 以前の top/height がレイアウト変更前の値のままになるため。
            requestAnimationFrame(() => {
                _placeLineMarkers(AppState.cachedMarkerData.markers, diffContent);
            });
            updateDiffInfo();
            return;
        }
        
        cleanup();
        AppState.diffRows = [];
        const newMarkers = [];
        
        // 差分行の収集（色判定のみ、offsetTop は rAF 後に読む）
        displayedRows.forEach((row) => {
            const usedColor = TableProcessor.getRowBackgroundColor(row);
            if (!usedColor) return;
            
            const diffInfo = {
                element: row,
                index: AppState.diffRows.length,
                textPreview: row.textContent
                    .replace(/\s+/g, ' ')
                    .substring(0, CONFIG.TEXT_PREVIEW_MAX_LENGTH),
                color: usedColor
            };
            AppState.diffRows.push(diffInfo);
            
            const marker = document.createElement('div');
            marker.classList.add('marker', 'line-marker');
            // top / height は rAF 後に確定させる（仮置き）
            marker.style.top = '0%';
            marker.style.height = '0%';
            marker.style.backgroundColor = CONFIG.MARKER_COLOR;
            marker.dataset.index = diffInfo.index;
            marker.setAttribute('tabindex', '0');
            marker.setAttribute('role', 'button');
            marker.setAttribute('aria-label', `差分 ${diffInfo.index + 1} へジャンプ`);
            
            locationPane.appendChild(marker);
            newMarkers.push(marker);
        });
        
        // ★rAF: レイアウト確定後に offsetTop / offsetHeight を読んで位置を確定する
        // BlockMarkerGenerator と同じパターンを採用し、初期レンダリング遅延環境での
        // マーカー位置ずれを防ぐ
        requestAnimationFrame(() => {
            _placeLineMarkers(newMarkers, diffContent);
        });
        
        // キャッシュを更新
        AppState.cachedMarkerData = {
            tableHash: tableHash,
            diffRows: AppState.diffRows.map(r => ({ ...r })),
            markers: newMarkers
        };
        
        Logger.log('マーカー生成完了(キャッシュ更新)', AppState.diffRows.length);
        updateDiffInfo();
    }

    /**
     * イベント委譲を初期化（一度だけ実行）
     * @private
     * @returns {void}
     */
    function initializeDelegatedEvents() {
        const locationPane = AppState.elements.locationPane;
        
        // ★メモリリーク対策1: 既存のハンドラを削除
        if (clickHandler) {
            locationPane.removeEventListener('click', clickHandler);
            Logger.log('既存のline-marker clickハンドラを削除');
        }
        if (keydownHandler) {
            locationPane.removeEventListener('keydown', keydownHandler);
            Logger.log('既存のline-marker keydownハンドラを削除');
        }
        
        // ★メモリリーク対策2: ハンドラ参照を保持（削除時に使用）
        clickHandler = (e) => {
            const marker = e.target.closest('.marker.line-marker');
            if (marker) {
                handleMarkerClick(marker);
            }
        };
        
        keydownHandler = (e) => {
            const marker = e.target.closest('.marker.line-marker');
            if (marker && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleMarkerClick(marker);
            }
        };
        
        locationPane.addEventListener('click', clickHandler);
        locationPane.addEventListener('keydown', keydownHandler);
        
        Logger.log('✅ Line-marker event delegation initialized');
    }

    /**
     * マーカークリック処理
     * @private
     * @param {HTMLElement} marker - クリックされたマーカー
     * @returns {void}
     */
    function handleMarkerClick(marker) {
        const index = parseInt(marker.dataset.index, 10);
        if (isNaN(index) || index < 0 || index >= AppState.diffRows.length) {
            Logger.warn('Invalid marker index:', index);
            return;
        }
        
        const diffInfo = AppState.diffRows[index];
        if (!diffInfo || !diffInfo.element) {
            Logger.warn('Diff info not found for index:', index);
            return;
        }
        
        // 前回のハイライト（.current-diff クラス + インラインスタイル）を一括クリア。
        // clearCurrentDiffHighlight() は .current-diff のみ対象のため、
        // インラインスタイルの boxShadow は先にここで明示的にクリアする。
        document.querySelectorAll('tr[style*="box-shadow"]').forEach(tr => {
            tr.style.boxShadow = '';
            tr.style.borderRadius = '';
        });
        Navigation.clearCurrentDiffHighlight();
        AppState.currentDiffIndex = index;
        
        const row = diffInfo.element;
        row.classList.remove('current-diff');
        // clear の後にセットすることで、自己消去を防ぐ
        row.style.boxShadow = CONFIG.HIGHLIGHT_BOX_SHADOW;
        row.style.borderRadius = CONFIG.HIGHLIGHT_BORDER_RADIUS;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        Navigation.highlightSelectedMarker(index);
        marker.blur();
        
        AppState.isNavigatingToDiff = true;
        setTimeout(() => {
            AppState.isNavigatingToDiff = false;
        }, CONFIG.NAVIGATION_COMPLETE_DELAY);
        
        updateDiffInfo();
    }

    /**
     * ラインマーカーの top / height をレイアウト確定後に設定する
     * rAF コールバック内から呼び出すことで offsetTop の早期読み取りを防ぐ。
     * @private
     * @param {HTMLElement[]} markers - 配置済みマーカー要素の配列
     * @param {HTMLElement} diffContent - スクロールコンテナ
     * @returns {void}
     */
    function _placeLineMarkers(markers, diffContent, retryCount = 0) {
        const MAX_RETRY = 10; // 隠しタブ等でDOMが表示されない場合の無限ループを防ぐ上限
        const contentHeight = diffContent.scrollHeight;
        if (contentHeight === 0) {
            if (retryCount >= MAX_RETRY) {
                Logger.warn(`_placeLineMarkers: scrollHeight が ${MAX_RETRY} フレーム後も 0 のため配置をスキップ`);
                return;
            }
            // レイアウトがまだ確定していない場合は次フレームに再試行
            requestAnimationFrame(() => _placeLineMarkers(markers, diffContent, retryCount + 1));
            return;
        }
        markers.forEach(marker => {
            const index = parseInt(marker.dataset.index, 10);
            const diffInfo = AppState.diffRows[index];
            if (!diffInfo || !diffInfo.element) return;
            const row = diffInfo.element;
            marker.style.top    = `${(row.offsetTop    / contentHeight) * 100}%`;
            marker.style.height = `${Math.max(
                CONFIG.MARKER_MIN_HEIGHT_PERCENT,
                (row.offsetHeight / contentHeight) * 100
            )}%`;
        });
        Logger.log('✅ ラインマーカーの位置を rAF 後に確定');
    }

    /**
     * すべてのマーカーをクリーンアップ
     * @returns {void}
     */
    function cleanup() {
        const locationPane = AppState.elements.locationPane;
        
        // ★メモリリーク対策: DOMから削除する前に個別リスナーもチェック
        locationPane.querySelectorAll('.marker.line-marker').forEach(marker => {
            // WeakMapに登録されている個別リスナーがあれば削除
            const listeners = AppState.markerEventListeners?.get(marker);
            if (listeners) {
                if (listeners.click) {
                    marker.removeEventListener('click', listeners.click);
                }
                if (listeners.keydown) {
                    marker.removeEventListener('keydown', listeners.keydown);
                }
                AppState.markerEventListeners.delete(marker);
            }
            
            marker.remove();
        });
        
        // WeakMapを再初期化
        AppState.markerEventListeners = new WeakMap();
        
        Logger.log('✅ Line markers cleaned up');
    }

    /**
     * 差分情報表示を更新
     * @returns {void}
     */
    function updateDiffInfo() {
        if (AppState.diffRows.length === 0) {
            AppState.elements.diffInfo.textContent = '差分: 0 / 0';
            CSSManager.showElement(AppState.elements.diffInfo, 'info-visible', 'info-hidden');
            return;
        }
        CSSManager.showElement(AppState.elements.diffInfo, 'info-visible', 'info-hidden');
        const current = AppState.currentDiffIndex >= 0 ? AppState.currentDiffIndex + 1 : 0;
        AppState.elements.diffInfo.textContent = `差分: ${current} / ${AppState.diffRows.length}`;
    }

    /**
     * イベント委譲のクリーンアップ（メモリリーク対策の要）
     * @returns {void}
     */
    function cleanupDelegation() {
        const locationPane = AppState.elements.locationPane;
        
        if (!locationPane) {
            Logger.warn('locationPane not found during line-marker cleanup');
            return;
        }
        
        // ★メモリリーク対策: イベントリスナーを確実に削除
        if (clickHandler) {
            locationPane.removeEventListener('click', clickHandler);
            clickHandler = null;
            Logger.log('✅ line-marker clickハンドラを削除しました');
        }
        
        if (keydownHandler) {
            locationPane.removeEventListener('keydown', keydownHandler);
            keydownHandler = null;
            Logger.log('✅ line-marker keydownハンドラを削除しました');
        }
        
        delegatedEventsInitialized = false;
        Logger.log('✅ Line-marker event delegation cleaned up');
    }

    // 公開API
    return {
        generate,
        cleanup,
        updateDiffInfo,
        cleanupDelegation
    };
})();

// ★注意: グローバル汚染を避けるため、直接公開しない
// main.js で WinMergeViewer.MarkerManager としてアクセス可能