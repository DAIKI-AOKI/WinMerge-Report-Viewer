/**
 * DiffBlockDetector & BlockMarkerGenerator (改善版 v6.1)
 * 差分ブロック検出とマーカー生成（青枠リサイズ対応版）
 * 依存: config.js, state.js, utils.js, table-processor.js, navigation.js
 * 
 * @fileoverview 差分ブロックの検出とマーカー生成を行うモジュール
 */

'use strict';
import { CONFIG } from './config.js';
import { AppState, Logger } from './state.js';
import { CSSManager } from './utils.js';
import { TableProcessor } from './table-processor.js';

let _Navigation = null;
function setNavigation(nav) { _Navigation = nav; }

/**
 * @typedef {Object} BlockStats
 * @property {number} total - 総ブロック数
 * @property {number} addBlocks - 追加ブロック数
 * @property {number} delBlocks - 削除ブロック数
 * @property {number} totalAddLines - 追加行の総数
 * @property {number} totalDelLines - 削除行の総数
 * @property {number} averageBlockSize - 平均ブロックサイズ
 */

// ========================================
// DiffBlockDetector - 差分ブロック検出
// ========================================
const DiffBlockDetector = (() => {
    /**
     * テーブルから差分ブロックを検出
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {DiffBlock[]} ブロック配列
     */
    function detectBlocks(table) {
        Logger.log('=== ブロック検出開始 ===');
        
        const rows = table.querySelectorAll('tr');
        const blocks = [];
        let currentBlock = null;
        
        rows.forEach((row, index) => {
            const color = TableProcessor.getRowBackgroundColor(row);
            
            if (color) {
                const type = _colorToType(color);
                
                // 同じタイプで連続している場合は結合
                if (currentBlock && 
                    currentBlock.type === type && 
                    currentBlock.endIndex === index - 1) {
                    currentBlock.endIndex = index;
                    currentBlock.rows.push(row);
                } else {
                    if (currentBlock) {
                        blocks.push(currentBlock);
                    }
                    
                    currentBlock = {
                        id: blocks.length,
                        type: type,
                        color: color,
                        startIndex: index,
                        endIndex: index,
                        rows: [row],
                        // top / height は _placeBlockMarkers() で rAF 後に再計算するため
                        // ここでは offsetTop / offsetHeight を読まない（レイアウト未確定対策）
                    };
                }
            } else {
                // 差分色がない場合、現在のブロックを終了
                if (currentBlock) {
                    blocks.push(currentBlock);
                    currentBlock = null;
                }
            }
        });
        
        if (currentBlock) {
            blocks.push(currentBlock);
        }
        
        Logger.log(`検出されたブロック数: ${blocks.length}`);
        return blocks;
    }
    
    /**
     * 背景色から差分タイプを判定
     * CONFIG.DIFF_COLOR_MAP を参照することで、色設定の変更に自動追従する。
     * ハードコードを排除し Single Source of Truth を維持する。
     * @private
     * @param {string} color - 背景色（rgb形式）
     * @returns {string} 差分タイプ（CONFIG.DIFF_COLOR_MAP の type 値、または 'unknown'）
     */
    function _colorToType(color) {
        const entry = CONFIG.DIFF_COLOR_MAP.find(e => e.color === color);
        return entry ? entry.type : 'unknown';
    }
    
    /**
     * ブロック統計を取得
     * @param {DiffBlock[]} blocks - ブロック配列
     * @returns {BlockStats} 統計情報
     */
    /**
     * 差分タイプをカテゴリに分類するための定数（モジュールスコープ）
     * 呼び出しごとに Set を生成するコストを避けるため、ここで一度だけ定義する。
     *
     * WinMerge の変更系: changed / word（変更行）
     * WinMerge の削除系: del / moved_from / moved_to
     * その他           : separator / unknown
     */
    const _CLASSIFY_ADD_TYPES = new Set(['changed', 'word']);
    const _CLASSIFY_DEL_TYPES = new Set(['del', 'moved_from', 'moved_to']);

    /**
     * 差分タイプをカテゴリに分類する
     * CONFIG.DIFF_COLOR_MAP の type 値に合わせて「変更系」「削除系」「その他」に仕分ける。
     * _colorToType() が旧 'add' を返さなくなったため、CONFIG を参照して判定する。
     * @private
     * @param {string} type - DiffBlock.type 値
     * @returns {'add'|'del'|'other'} 統計カテゴリ（'add' = 変更系、'del' = 削除系）
     */
    function _classifyBlockType(type) {
        if (_CLASSIFY_ADD_TYPES.has(type)) return 'add';
        if (_CLASSIFY_DEL_TYPES.has(type)) return 'del';
        return 'other'; // separator / unknown
    }

    function getBlockStats(blocks) {
        const stats = {
            total: blocks.length,
            addBlocks: 0,
            delBlocks: 0,
            totalAddLines: 0,
            totalDelLines: 0,
            averageBlockSize: 0
        };
        
        blocks.forEach(block => {
            const category = _classifyBlockType(block.type);
            if (category === 'add') {
                stats.addBlocks++;
                stats.totalAddLines += block.rows.length;
            } else if (category === 'del') {
                stats.delBlocks++;
                stats.totalDelLines += block.rows.length;
            }
        });
        
        stats.averageBlockSize = blocks.length > 0 
            ? (stats.totalAddLines + stats.totalDelLines) / blocks.length 
            : 0;
        
        return stats;
    }

    return {
        detectBlocks,
        getBlockStats
    };
})();

// ========================================
// BlockMarkerGenerator - ブロックマーカー生成（青枠リサイズ対応版）
// ========================================
const BlockMarkerGenerator = (() => {
    /** @type {boolean} イベント委譲の初期化フラグ */
    let delegatedEventsInitialized = false;
    
    /** @type {Function|null} クリックイベントハンドラの参照 */
    let clickHandler = null;
    
    /** @type {Function|null} キーボードイベントハンドラの参照 */
    let keydownHandler = null;

    /**
     * ブロックマーカーを生成
     * @param {DiffBlock[]} blocks - ブロック配列
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function generateBlockMarkers(blocks, table) {
        Logger.log('=== ブロックマーカー生成開始 ===');
        
        const { locationPane, diffContent } = AppState.elements;
        
        // イベント委譲を初期化（最初の一度だけ）
        if (!delegatedEventsInitialized) {
            initializeDelegatedEvents();
            delegatedEventsInitialized = true;
        }
        
        clearBlockMarkers();

        // requestAnimationFrame でレイアウト確定後にマーカーを配置
        // DOM 追加直後は offsetTop / scrollHeight が 0 になる場合があるため
        // 1フレーム待機してブラウザのレイアウト計算完了を保証する。
        requestAnimationFrame(() => {
            const contentHeight = diffContent.scrollHeight;

            if (contentHeight === 0) {
                // フォールバック: scrollHeight がまだ 0 の場合はもう 1 フレーム待機
                Logger.warn('generateBlockMarkers: scrollHeight が 0 のため追加フレームを待機');
                requestAnimationFrame(() => _placeBlockMarkers(blocks, locationPane, diffContent));
                return;
            }
            _placeBlockMarkers(blocks, locationPane, diffContent);
        });
    }

    /**
     * ブロックマーカーを DOM に配置する（内部処理）
     * generateBlockMarkers() の requestAnimationFrame コールバックから呼ばれる。
     * @private
     * @param {DiffBlock[]} blocks - ブロック配列
     * @param {HTMLElement} locationPane - ミニマップ要素
     * @param {HTMLElement} diffContent - スクロール対象要素
     * @returns {void}
     */
    function _placeBlockMarkers(blocks, locationPane, diffContent) {
        const contentHeight = diffContent.scrollHeight;

        if (contentHeight === 0) {
            Logger.warn('_placeBlockMarkers: scrollHeight が依然 0 のためマーカーを配置できません');
            return;
        }

        blocks.forEach((block, index) => {
            const marker = document.createElement('div');
            marker.classList.add('marker', 'block-marker');
            marker.dataset.blockId = block.id;
            marker.dataset.blockIndex = index;
            
            const firstRow = block.rows[0];
            const lastRow = block.rows[block.rows.length - 1];
            const top = firstRow.offsetTop;
            const height = lastRow.offsetTop + lastRow.offsetHeight - top;
            
            marker.style.top = `${(top / contentHeight) * 100}%`;
            
            const heightPercent = (height / contentHeight) * 100;
            marker.style.height = `${Math.max(heightPercent, CONFIG.MARKER_MIN_HEIGHT_PERCENT)}%`;
            
            marker.style.backgroundColor = CONFIG.MARKER_COLOR;
            
            if (blocks.length <= CONFIG.BLOCK_LABEL_DISPLAY_THRESHOLD) {
                const label = document.createElement('span');
                label.className = 'block-marker-label';
                label.textContent = index + 1;
                marker.appendChild(label);
            }
            
            marker.setAttribute('tabindex', '0');
            marker.setAttribute('role', 'button');
            marker.setAttribute('aria-label', 
                `${block.type === 'add' ? '追加' : '削除'}ブロック ${index + 1} (${block.rows.length}行) へジャンプ`);
            
            locationPane.appendChild(marker);
        });
        
        Logger.log(`✅ ブロックマーカー配置完了: ${blocks.length}個 / scrollHeight: ${contentHeight}`);
    }
    
    /**
     * イベント委譲を初期化（一度だけ実行）
     * @private
     * @returns {void}
     */
    function initializeDelegatedEvents() {
        const locationPane = AppState.elements.locationPane;
        
        // メモリリーク対策: 既存のハンドラを削除
        if (clickHandler) {
            locationPane.removeEventListener('click', clickHandler);
            Logger.log('既存のblock-marker clickハンドラを削除');
        }
        if (keydownHandler) {
            locationPane.removeEventListener('keydown', keydownHandler);
            Logger.log('既存のblock-marker keydownハンドラを削除');
        }
        
        // ハンドラ参照を保持（削除時に使用）
        clickHandler = (e) => {
            const marker = e.target.closest('.marker.block-marker');
            if (marker) {
                handleBlockMarkerClick(marker);
            }
        };
        
        keydownHandler = (e) => {
            const marker = e.target.closest('.marker.block-marker');
            if (marker && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleBlockMarkerClick(marker);
            }
        };
        
        locationPane.addEventListener('click', clickHandler);
        locationPane.addEventListener('keydown', keydownHandler);
        
        Logger.log('✅ Block-marker event delegation initialized');
    }

    /**
     * ブロックマーカークリック処理
     * @private
     * @param {HTMLElement} marker - クリックされたマーカー
     * @returns {void}
     */
    function handleBlockMarkerClick(marker) {
        const index = parseInt(marker.dataset.blockIndex, 10);
        if (isNaN(index) || index < 0 || index >= AppState.diffBlocks.length) {
            Logger.warn('Invalid block marker index:', index);
            return;
        }
        
        const block = AppState.diffBlocks[index];
        jumpToBlock(index, block);
    }
    
    /**
     * 指定ブロックにジャンプ
     * @private
     * @param {number} index - ブロックインデックス
     * @param {DiffBlock} block - ブロックオブジェクト
     * @returns {void}
     */
    function jumpToBlock(index, block) {
        Logger.log(`ブロック ${index + 1} にジャンプ`);
        
        if (!block || !block.rows || block.rows.length === 0) {
            Logger.error('無効なブロックデータ:', index);
            return;
        }
        
        _Navigation?.clearCurrentDiffHighlight();
        
        _createBlockHighlight(block);
        
        const firstRow = block.rows[0];
        
        try {
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
            Logger.error('スクロールエラー:', error);
        }
        
        AppState.currentDiffIndex = index;
        AppState.isNavigatingToDiff = true;
        
        _Navigation?.highlightSelectedMarker(index);
        
        setTimeout(() => {
            AppState.isNavigatingToDiff = false;
        }, CONFIG.NAVIGATION_COMPLETE_DELAY);
        
        updateBlockInfo();
    }
    
    /**
     * ブロックハイライトを作成
     * @private
     * @param {DiffBlock} block - ブロックオブジェクト
     * @returns {void}
     */
    function _createBlockHighlight(block) {
        const firstRow = block.rows[0];
        const lastRow = block.rows[block.rows.length - 1];
        
        const table = firstRow.closest('table');
        if (!table) return;
        
        const container = table.parentElement;
        if (!container) return;
        
        // 既存のハイライトを削除
        const oldWrapper = container.querySelector('.block-highlight-wrapper');
        if (oldWrapper) oldWrapper.remove();
        
        const containerPosition = window.getComputedStyle(container).position;
        if (containerPosition === 'static') {
            container.style.position = 'relative';
        }
        
        const tableRect = table.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const firstRowRect = firstRow.getBoundingClientRect();
        const lastRowRect = lastRow.getBoundingClientRect();
        
        const top = firstRowRect.top - containerRect.top + container.scrollTop;
        const height = lastRowRect.bottom - firstRowRect.top;
        const left = tableRect.left - containerRect.left;
        const width = tableRect.width;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'block-highlight-wrapper';
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${left}px`;
        wrapper.style.top = `${top}px`;
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.pointerEvents = 'none';
        wrapper.style.zIndex = '5';
        
        // ブロック情報を data 属性に保存（リサイズ時に使用）
        wrapper.dataset.blockIndex = AppState.currentDiffIndex;
        
        container.appendChild(wrapper);
    }
    
    /**
     * ブロックハイライトを更新（リサイズ時用）
     * @returns {void}
     */
    function updateBlockHighlight() {
        const wrapper = document.querySelector('.block-highlight-wrapper');
        if (!wrapper) return;
        
        const blockIndex = parseInt(wrapper.dataset.blockIndex, 10);
        if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= AppState.diffBlocks.length) {
            return;
        }
        
        const block = AppState.diffBlocks[blockIndex];
        if (!block || !block.rows || block.rows.length === 0) {
            return;
        }
        
        const firstRow = block.rows[0];
        const lastRow = block.rows[block.rows.length - 1];
        const table = firstRow.closest('table');
        if (!table) return;
        
        const container = table.parentElement;
        if (!container) return;
        
        const tableRect = table.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const firstRowRect = firstRow.getBoundingClientRect();
        const lastRowRect = lastRow.getBoundingClientRect();
        
        const top = firstRowRect.top - containerRect.top + container.scrollTop;
        const height = lastRowRect.bottom - firstRowRect.top;
        const left = tableRect.left - containerRect.left;
        const width = tableRect.width;
        
        wrapper.style.left = `${left}px`;
        wrapper.style.top = `${top}px`;
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        
        Logger.log('✅ ブロックハイライトの位置・サイズを更新');
    }
    
    /**
     * ブロック情報表示を更新
     * @private
     * @returns {void}
     */
    function updateBlockInfo() {
        if (!AppState.diffBlocks || AppState.diffBlocks.length === 0) {
            AppState.elements.diffInfo.textContent = '差分: 0 / 0';
            CSSManager.showElement(AppState.elements.diffInfo, 'info-visible', 'info-hidden');
            return;
        }
        
        CSSManager.showElement(AppState.elements.diffInfo, 'info-visible', 'info-hidden');
        
        const current = (AppState.currentDiffIndex >= 0 && 
                        AppState.currentDiffIndex < AppState.diffBlocks.length) 
            ? AppState.currentDiffIndex + 1 
            : 0;
        
        AppState.elements.diffInfo.textContent = `差分: ${current} / ${AppState.diffBlocks.length}`;
    }
    
    /**
     * ブロックマーカーをクリア
     * @private
     * @returns {void}
     */
    function clearBlockMarkers() {
        const locationPane = AppState.elements.locationPane;
        
        // メモリリーク対策: DOMから削除する前に個別リスナーもチェック
        locationPane.querySelectorAll('.block-marker').forEach(marker => {
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
        
        Logger.log('✅ Block markers cleared');
    }

    /**
     * イベント委譲のクリーンアップ（メモリリーク対策の要）
     * @returns {void}
     */
    function cleanupDelegation() {
        const locationPane = AppState.elements.locationPane;
        
        if (!locationPane) {
            Logger.warn('locationPane not found during block-marker cleanup');
            return;
        }
        
        // メモリリーク対策: イベントリスナーを確実に削除
        if (clickHandler) {
            locationPane.removeEventListener('click', clickHandler);
            clickHandler = null;
            Logger.log('✅ block-marker clickハンドラを削除しました');
        }
        
        if (keydownHandler) {
            locationPane.removeEventListener('keydown', keydownHandler);
            keydownHandler = null;
            Logger.log('✅ block-marker keydownハンドラを削除しました');
        }
        
        delegatedEventsInitialized = false;
        Logger.log('✅ Block-marker event delegation cleaned up');
    }

    /**
     * 完全クリーンアップ（マーカー削除 + イベントリスナー削除）
     * @returns {void}
     */
    function cleanup() {
        clearBlockMarkers();
        cleanupDelegation();
        Logger.log('✅ BlockMarkerGenerator completely cleaned up');
    }

    return {
        generateBlockMarkers,
        cleanup,
        cleanupDelegation,
        updateBlockHighlight,
        jumpToBlock,
        updateBlockInfo,
        clearBlockMarkers,
        setNavigation
    };
})();

// ★注意: グローバル汚染を避けるため、直接公開しない
// main.js で WinMergeViewer.DiffBlockDetector と WinMergeViewer.BlockMarkerGenerator としてアクセス可能

export { DiffBlockDetector, BlockMarkerGenerator };