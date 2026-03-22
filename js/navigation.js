/**
 * Navigation - ナビゲーション制御モジュール（メモリリーク完全対策版）
 * 依存: config.js, state.js, utils.js, error-handler.js, ui.js, marker-manager.js, diff-detector.js
 * 
 * @fileoverview ナビゲーション機能とクリーンアップ処理
 */

'use strict';

const Navigation = (() => {
    /**
     * 次の差分へジャンプ
     * @returns {void}
     */
    function jumpToNextDiff() {
        try {
            if (AppState.diffRows.length === 0) {
                throw new NavigationError('差分が見つかりません。');
            }
            clearCurrentDiffHighlight();
            AppState.currentDiffIndex = (AppState.currentDiffIndex + 1) % AppState.diffRows.length;
            jumpToDiff(AppState.currentDiffIndex);
        } catch (error) {
            ErrorHandler.handle(error, 'Next diff navigation');
        }
    }

    /**
     * 前の差分へジャンプ
     * @returns {void}
     */
    function jumpToPrevDiff() {
        try {
            if (AppState.diffRows.length === 0) {
                throw new NavigationError('差分が見つかりません。');
            }
            clearCurrentDiffHighlight();
            AppState.currentDiffIndex = AppState.currentDiffIndex <= 0 
                ? AppState.diffRows.length - 1 
                : AppState.currentDiffIndex - 1;
            jumpToDiff(AppState.currentDiffIndex);
        } catch (error) {
            ErrorHandler.handle(error, 'Previous diff navigation');
        }
    }

    /**
     * 指定インデックスの差分へジャンプ
     * @param {number} index - 差分インデックス
     * @returns {void}
     * @throws {NavigationError} インデックスが無効な場合
     */
    function jumpToDiff(index) {
        try {
            if (index < 0 || index >= AppState.diffRows.length) {
                throw new NavigationError(
                    `無効な差分インデックス: ${index}`,
                    index
                );
            }
            
            const diffRow = AppState.diffRows[index];
            if (!diffRow || !diffRow.element) {
                throw new NavigationError(
                    `差分要素が見つかりません: インデックス ${index}`,
                    index
                );
            }
            
            Logger.log('差分にジャンプ:', diffRow.textPreview);
            AppState.isNavigatingToDiff = true;
            diffRow.element.classList.add('current-diff');
            diffRow.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            highlightSelectedMarker(index);
            
            setTimeout(() => {
                AppState.isNavigatingToDiff = false;
                Logger.log('差分ナビゲーション完了');
            }, CONFIG.NAVIGATION_COMPLETE_DELAY);
            
            MarkerManager.updateDiffInfo();
            
        } catch (error) {
            ErrorHandler.handle(error, 'Diff jump');
        }
    }

    /**
     * 選択されたマーカーをハイライト
     * @param {number} index - マーカーインデックス
     * @returns {void}
     */
    function highlightSelectedMarker(index) {
        clearMarkerSelection();
        
        let marker;
        if (AppState.useBlockMode) {
            marker = document.querySelector(`.block-marker[data-block-index="${index}"]`);
        } else {
            marker = document.querySelector(`.marker[data-index="${index}"]:not(.block-marker)`);
        }
        
        if (marker) {
            marker.classList.add('marker-selected');
            Logger.log('マーカー選択:', index);
        }
    }

    /**
     * マーカーの選択状態をクリア
     * @returns {void}
     */
    function clearMarkerSelection() {
        document.querySelectorAll('.marker-selected').forEach(marker => {
            marker.classList.remove('marker-selected');
        });
    }

    /**
     * 現在の差分ハイライトをクリア
     * @returns {void}
     */
    function clearCurrentDiffHighlight() {
        document.querySelectorAll('.current-diff').forEach(el => {
            el.classList.remove('current-diff');
        });
        
        document.querySelectorAll('.block-highlight-wrapper').forEach(el => {
            el.remove();
        });
        
        // handleMarkerClick() が付与したインラインスタイルも合わせてクリアする。
        // CSS クラスの削除だけではインラインスタイルは残留するため、ここで明示的に除去する。
        document.querySelectorAll('tr[style*="box-shadow"]').forEach(tr => {
            tr.style.boxShadow = '';
            tr.style.borderRadius = '';
        });
        
        clearMarkerSelection();
    }

    /**
     * すべてのマーカーをクリーンアップ（メモリリーク完全対策版）
     * @private
     * @returns {void}
     */
    function cleanupAllMarkers() {
        const locationPane = AppState.elements.locationPane;
        
        if (!locationPane) {
            Logger.warn('locationPane not found during cleanup');
            return;
        }
        
        Logger.log('=== すべてのマーカーをクリーンアップ開始 ===');
        
        // 各モジュールのイベントリスナーをクリーンアップ
        if (typeof MarkerManager !== 'undefined' && MarkerManager.cleanupDelegation) {
            MarkerManager.cleanupDelegation();
            Logger.log('✅ MarkerManager のイベントリスナーを削除');
        }
        
        if (typeof BlockMarkerGenerator !== 'undefined' && BlockMarkerGenerator.cleanupDelegation) {
            BlockMarkerGenerator.cleanupDelegation();
            Logger.log('✅ BlockMarkerGenerator のイベントリスナーを削除');
        }
        
        // DOMからマーカーを削除する前に、個別のイベントリスナーもクリーンアップ
        const allMarkers = locationPane.querySelectorAll('.marker');
        Logger.log(`クリーンアップ対象のマーカー数: ${allMarkers.length}`);
        
        allMarkers.forEach(marker => {
            try {
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
            } catch (e) {
                Logger.warn('マーカー削除失敗:', e);
            }
        });
        
        AppState.markerEventListeners = new WeakMap();
        
        Logger.log('=== すべてのマーカーのクリーンアップ完了 ===');
    }

    /**
     * インターフェースをリセット（メモリリーク対策強化版）
     * @returns {void}
     */
    function resetInterface() {
        Logger.log('=== インターフェースをリセット開始 ===');
        try {
            // ステップ1: イベントハンドラとタイマーのクリーンアップ
            AppState.cleanupTimers();
            AppState.cleanupEventHandlers();
            
            // ステップ2: 状態リセット
            AppState.reset();
            
            // ステップ3: スタイルの削除
            HTMLProcessor.removeImportedStyle();
            
            // ステップ4: すべてのマーカーを統合的にクリーンアップ
            cleanupAllMarkers();
            
            // ステップ5: ビューアをクリア
            UI.clearViewer();
            
            // ステップ6: ドロップエリアを表示
            if (AppState.elements.dropArea) {
                AppState.elements.dropArea.style.display = 'block';
            }
            
            // ステップ7: コントロールボタンを非表示
            // ★改善: UI_CONSTANTS.CONTROL_BUTTONS → CONFIG.CONTROL_BUTTONS
            CONFIG.CONTROL_BUTTONS.forEach(id => {
                if (AppState.elements[id]) {
                    CSSManager.hideElement(AppState.elements[id], 'button-visible', 'button-hidden');
                }
            });
            
            // ステップ8: マーカーモード切替ボタンを非表示
            if (Logger.enabled && typeof MarkerModeToggle !== 'undefined') {
                MarkerModeToggle.hide();
            }
            
            // ステップ9: 差分情報を非表示
            if (AppState.elements.diffInfo) {
                CSSManager.hideElement(AppState.elements.diffInfo, 'info-visible', 'info-hidden');
            }
            
            // ステップ10: 固定ヘッダーを非表示
            if (AppState.elements.fixedHeader) {
                CSSManager.hideElement(AppState.elements.fixedHeader, 'fixed-header-visible', 'fixed-header-hidden');
            }
            
            // ステップ11: ファイル入力をリセット
            if (AppState.elements.fileInput) {
                AppState.elements.fileInput.value = '';
            }
            
            // ステップ12: スクロール位置をリセット
            if (AppState.elements.diffContent) {
                AppState.elements.diffContent.scrollTop = 0;
            }
            
            // ステップ13: ハイライトをクリア
            clearCurrentDiffHighlight();
            
            // ステップ14: ブロックハイライトラッパーを削除
            document.querySelectorAll('.block-highlight-wrapper').forEach(el => {
                el.remove();
            });
            
            // ステップ15: ツールヘッダーを表示
            if (AppState.elements.toolHeader) {
                CSSManager.showElement(AppState.elements.toolHeader, 'toolHeader-visible', 'toolHeader-hidden');
            }
            
            Logger.log('✅ インターフェースリセット完了');
        } catch (error) {
            Logger.error('Reset interface error:', error);
            UI.showMessage('リセット中にエラーが発生しましたが、継続できます。', 'warning');
        }
    }



    // 公開API
    return {
        jumpToNextDiff,
        jumpToPrevDiff,
        jumpToDiff,
        highlightSelectedMarker,
        clearMarkerSelection,
        clearCurrentDiffHighlight,
        resetInterface,
        cleanupAllMarkers
    };
})();

// ★注意: グローバル汚染を避けるため、直接公開しない
// main.js で WinMergeViewer.Navigation としてアクセス可能