/**
 * TableProcessor - テーブル処理モジュール（IntersectionObserver メモリリーク対策版 + リサイズ対応）
 * 依存: config.js, state.js, utils.js
 * 
 * @fileoverview テーブルの加工と固定ヘッダー管理
 */

'use strict';
import { CONFIG } from './config.js';
import { AppState, Logger } from './state.js';
import { CSSManager } from './utils.js';

const TableProcessor = (() => {
    /**
     * テーブルの各行に右端バーを追加
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function addRightBars(table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const isHeaderRow = row.querySelector('th');
            const rightBarCell = document.createElement(isHeaderRow ? 'th' : 'td');
            rightBarCell.className = 'added-right-bar';
            rightBarCell.innerHTML = '&nbsp;';
            row.appendChild(rightBarCell);
        });
    }

    /**
     * 固定ヘッダーをセットアップ
     * @param {HTMLTableElement} table - 元のテーブル
     * @returns {void}
     */
    function setupFixedHeader(table) {
        const firstRow = table.querySelector('tr');
        if (!firstRow) return;
        
        AppState.elements.fixedHeaderRow.innerHTML = '';
        firstRow.querySelectorAll('th').forEach((originalTh) => {
            const newTh = document.createElement('th');
            newTh.textContent = originalTh.textContent;
            
            const allowedAttributes = ['class', 'colspan', 'rowspan'];
            allowedAttributes.forEach(attrName => {
                if (originalTh.hasAttribute(attrName)) {
                    const attrValue = originalTh.getAttribute(attrName);
                    const sanitizedValue = attrValue
                        .replace(/[<>'"]/g, '')
                        .replace(/javascript:/gi, '')
                        .replace(/on\w+/gi, '')
                        .trim();
                    if (sanitizedValue && sanitizedValue.length < 200) {
                        newTh.setAttribute(attrName, sanitizedValue);
                    }
                }
            });
            
            newTh.setAttribute('scope', 'col');
            
            Array.from(originalTh.attributes).forEach(attr => {
                if (attr.name.startsWith('aria-') || attr.name.startsWith('data-')) {
                    let attrValue = attr.value;
                    const sanitizedValue = attrValue.replace(/[<>'"]/g, '').trim();
                    newTh.setAttribute(attr.name, sanitizedValue);
                }
            });
            
            AppState.elements.fixedHeaderRow.appendChild(newTh);
        });
    }

    /**
     * 固定ヘッダーの位置を更新
     * @param {HTMLTableElement} originalTable - 元のテーブル
     * @returns {void}
     */
    function updateFixedHeaderPosition(originalTable) {
        const fixedTable = AppState.elements.fixedHeader.querySelector('table');
        if (!originalTable || !fixedTable) return;
        
        const tableRect = originalTable.getBoundingClientRect();
        CSSManager.setVariable('fixed-header-left', `${tableRect.left}px`);
        CSSManager.setVariable('fixed-header-width', `${tableRect.width}px`);
        
        const originalThs = originalTable.querySelectorAll('tr:first-child th');
        const fixedThs = fixedTable.querySelectorAll('tr:first-child th');
        
        originalThs.forEach((originalTh, index) => {
            if (!fixedThs[index]) return;
            if (index === originalThs.length - 1 && originalTh.classList.contains('added-right-bar')) {
                fixedThs[index].style.width = `${CONFIG.RIGHT_BAR_WIDTH}px`;
            } else {
                const thRect = originalTh.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                let adjustedWidth;
                if (windowWidth <= 600) {
                    adjustedWidth = thRect.width;
                } else if (windowWidth <= 750) {
                    adjustedWidth = thRect.width - 17;
                } else {
                    adjustedWidth = Math.max(CONFIG.MIN_COLUMN_WIDTH, thRect.width - CONFIG.HEADER_ADJUSTMENT);
                }
                fixedThs[index].style.width = `${adjustedWidth}px`;
            }
        });
    }

    /**
     * IntersectionObserver を完全にクリーンアップ（メモリリーク対策）
     * @private
     * @returns {void}
     */
    function cleanupIntersectionObserver() {
        if (AppState.intersectionObserver) {
            try {
                // ★メモリリーク対策1: すべての監視を解除
                AppState.intersectionObserver.disconnect();
                
                // ★メモリリーク対策2: 参照をクリア
                AppState.intersectionObserver = null;
                
                Logger.log('✅ IntersectionObserver cleaned up completely');
            } catch (error) {
                Logger.warn('IntersectionObserver cleanup error:', error);
                // エラーが発生しても参照はクリア
                AppState.intersectionObserver = null;
            }
        }
    }

    /**
     * IntersectionObserverをセットアップして、ヘッダーの表示/非表示を制御
     * （メモリリーク対策強化版 + リサイズ対応）
     * @returns {void}
     */
    function setupIntersectionObserver() {
        // ★メモリリーク対策3: 既存の observer を完全にクリーンアップ
        cleanupIntersectionObserver();
        
        try {
            // ★メモリリーク対策4: コールバック関数を変数に保存（デバッグ用）
            const observerCallback = (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // ヘッダー行が見えている → 固定ヘッダーを非表示
                        CSSManager.hideElement(
                            AppState.elements.fixedHeader, 
                            'fixed-header-visible', 
                            'fixed-header-hidden'
                        );
                        entry.target.style.visibility = 'visible';
                    } else {
                        // ヘッダー行が見えていない → 固定ヘッダーを表示
                        const firstTable = AppState.elements.viewer.querySelector('table');
                        if (firstTable && entry.target === firstTable.querySelector('tr')) {
                            updateFixedHeaderPosition(firstTable);
                            CSSManager.showElement(
                                AppState.elements.fixedHeader, 
                                'fixed-header-visible', 
                                'fixed-header-hidden'
                            );
                            entry.target.style.visibility = 'hidden';
                        }
                    }
                });
            };
            
            const observerOptions = {
                root: AppState.elements.diffContent,
                rootMargin: `-${CONFIG.HEADER_VISIBILITY_THRESHOLD}px 0px 0px 0px`,
                threshold: 0
            };
            
            // ★メモリリーク対策5: 新しい observer を作成
            AppState.intersectionObserver = new IntersectionObserver(
                observerCallback,
                observerOptions
            );
            
            // ★メモリリーク対策6: 監視対象を登録
            const firstTable = AppState.elements.viewer.querySelector('table');
            if (firstTable) {
                const headerRow = firstTable.querySelector('tr');
                if (headerRow) {
                    AppState.intersectionObserver.observe(headerRow);
                    Logger.log('✅ IntersectionObserver observing header row');
                } else {
                    Logger.warn('Header row not found for IntersectionObserver');
                    cleanupIntersectionObserver();
                }
            } else {
                Logger.warn('Table not found for IntersectionObserver');
                cleanupIntersectionObserver();
            }
            
            // ★修正: ウィンドウリサイズ時に固定ヘッダーの幅を更新
            setupResizeHandler(firstTable);
            
        } catch (error) {
            Logger.error('IntersectionObserver setup failed:', error);
            // エラーが発生した場合は observer をクリーンアップ
            cleanupIntersectionObserver();
        }
    }
    
    /**
     * リサイズハンドラーをセットアップ
     * @private
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function setupResizeHandler(table) {
        if (!table) return;
        
        // 既存のリサイズハンドラーをクリーンアップ
        if (AppState.eventHandlers.debouncedResize) {
            window.removeEventListener('resize', AppState.eventHandlers.debouncedResize);
            AppState.eventHandlers.debouncedResize = null;
        }
        
        if (AppState.eventHandlers.resizeTimeout) {
            clearTimeout(AppState.eventHandlers.resizeTimeout);
            AppState.eventHandlers.resizeTimeout = null;
        }
        
        // デバウンス付きリサイズハンドラー
        AppState.eventHandlers.debouncedResize = () => {
            if (AppState.eventHandlers.resizeTimeout) {
                clearTimeout(AppState.eventHandlers.resizeTimeout);
            }
            
            AppState.eventHandlers.resizeTimeout = setTimeout(() => {
                // 固定ヘッダーが表示されている場合のみ更新
                const fixedHeader = AppState.elements.fixedHeader;
                if (fixedHeader && fixedHeader.classList.contains('fixed-header-visible')) {
                    const currentTable = AppState.elements.viewer.querySelector('table');
                    if (currentTable) {
                        updateFixedHeaderPosition(currentTable);
                        Logger.log('✅ 固定ヘッダーの幅をリサイズに合わせて更新');
                    }
                }
                
                // ★修正: ブロックハイライトも更新（ブロックモード時）
                if (AppState.useBlockMode && typeof BlockMarkerGenerator !== 'undefined') {
                    if (BlockMarkerGenerator.updateBlockHighlight) {
                        BlockMarkerGenerator.updateBlockHighlight();
                    }
                }
            }, CONFIG.RESIZE_DEBOUNCE_DELAY);
        };
        
        window.addEventListener('resize', AppState.eventHandlers.debouncedResize);
        Logger.log('✅ リサイズハンドラーを設定しました');
    }

    /**
     * 行の背景色を取得（差分検出用）
     *
     * 修正内容:
     *   旧版は querySelectorAll('td, td *') で全子孫要素を走査し、
     *   条件を満たす色をすべて上書きしていたため、行末の span（コメント等）の
     *   色が最終結果として採用されるバグがあった。
     *   新版は td 要素の背景色を優先して確認し、最初に見つかった時点で即リターン
     *   することで、子要素の span による誤上書きを防ぐ。
     *   また、file:// 環境で getComputedStyle が HEX 形式を返す場合に備え、
     *   インラインスタイルの HEX 値も直接チェックする。
     *
     * @param {HTMLTableRowElement} row - 対象行
     * @returns {string|null} 背景色（rgb形式）またはnull
     */
    function getRowBackgroundColor(row) {
        /**
         * HEX カラーコードを RGB 文字列に変換
         * @param {string} hex - "#efcb05" 形式
         * @returns {{r:number, g:number, b:number}|null}
         */
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        /**
         * 中立色（白・薄グレー）かどうかを判定
         * @param {number} r
         * @param {number} g
         * @param {number} b
         * @returns {boolean}
         */
        function isNeutralColor(r, g, b) {
            return (r === 255 && g === 255 && b === 255) || // 白
                   (r >= 240 && g >= 240 && b >= 240) ||   // 薄グレー (#f0f0f0以上)
                   (r >= 248 && g >= 248 && b >= 248);     // テーブル背景
        }

        // td 要素の背景色を優先して確認し、最初に見つかった時点で即リターン。
        // これにより子要素 span（コメント等）による誤上書きを防ぐ。
        for (const td of row.querySelectorAll('td')) {
            if (td.classList.contains('added-right-bar')) continue;

            // ① インラインスタイルの HEX を直接チェック（file:// 環境対応）
            const inlineBg = td.style.backgroundColor;
            if (inlineBg && inlineBg.startsWith('#')) {
                const rgb = hexToRgb(inlineBg);
                if (rgb && !isNeutralColor(rgb.r, rgb.g, rgb.b)) {
                    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                }
            }

            // ② getComputedStyle による RGB 形式チェック（通常環境）
            const bg = window.getComputedStyle(td).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                const rgbMatch = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (rgbMatch) {
                    const r = parseInt(rgbMatch[1]);
                    const g = parseInt(rgbMatch[2]);
                    const b = parseInt(rgbMatch[3]);
                    if (!isNeutralColor(r, g, b)) {
                        return bg;
                    }
                }
            }
        }

        return null;
    }

    // 公開API
    return {
        addRightBars,
        setupFixedHeader,
        updateFixedHeaderPosition,
        setupIntersectionObserver,
        setupResizeHandler,
        cleanupIntersectionObserver,
        getRowBackgroundColor
    };
})();

// ★注意: グローバル汚染を避けるため、直接公開しない
// main.js で WinMergeViewer.TableProcessor としてアクセス可能

export { TableProcessor };