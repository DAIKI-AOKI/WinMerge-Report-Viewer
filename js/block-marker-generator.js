/**
 * BlockMarkerGenerator (改善版 v6.1)
 * 差分ブロックのマーカー生成・ナビゲーション（青枠リサイズ対応版）
 * 依存: config.js, state.js, utils.js
 *
 * @fileoverview ミニマップ上のブロックマーカー生成とジャンプ操作を行うモジュール
 * @remark 元々 diff-detector.js に同居していたが、DiffBlockDetector と相互依存が
 *         なかったため、責務分離のため別ファイルに分割した。
 */

'use strict';
import { CONFIG } from './config.js';
import { AppState, Logger } from './state.js';
import { CSSManager } from './utils.js';

// ========================================
// BlockMarkerGenerator - ブロックマーカー生成（青枠リサイズ対応版）
// ========================================
const BlockMarkerGenerator = (() => {
    // _Navigation は BlockMarkerGenerator のみが使用するため、IIFE スコープ内に閉じ込める。
    // DiffBlockDetector は _Navigation を参照しないため、モジュールスコープに置く必要はない。
    /** @type {Object|null} Navigation モジュールへの参照（循環依存回避のため遅延注入） */
    let _Navigation = null;

    /**
     * Navigation モジュールを注入する（main.js の初期化時に呼び出す）
     * @param {Object} nav - Navigation モジュール
     * @returns {void}
     */
    function setNavigation(nav) {
        _Navigation = nav;
    }

    /** @type {boolean} イベント委譲の初期化フラグ */
    let delegatedEventsInitialized = false;

    // ★競合対策: generateBlockMarkers() が短時間に連続で呼ばれた場合
    // （例: ファイル読み込み直後、初回描画がまだ完了しないうちに
    // ウィンドウがリサイズされ markerResizeCallback が発火するケース）、
    // 古い呼び出しの _placeBlockMarkers() リトライチェーンが後から完了し、
    // マーカーが重複して配置されることがあった。
    // 呼び出しごとに世代番号を発行し、実行時点で最新の世代でなければ
    // 何もしないことで、古いチェーンの結果を無効化する。
    let markerGeneration = 0;

    /** @type {Function|null} クリックイベントハンドラの参照 */
    let clickHandler = null;

    /** @type {Function|null} キーボードイベントハンドラの参照 */
    let keydownHandler = null;

    /** @type {Function|null} マウスオーバーイベントハンドラの参照 */
    let mouseoverHandler = null;

    /** @type {Function|null} マウスアウトイベントハンドラの参照 */
    let mouseoutHandler = null;

    /**
     * ブロックマーカーを生成
     * @param {DiffBlock[]} blocks - ブロック配列
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {void}
     */
    function generateBlockMarkers(blocks, _table) {
        Logger.log('=== ブロックマーカー生成開始 ===');

        const { diffContent } = AppState.elements;

        // イベント委譲を初期化（最初の一度だけ）
        if (!delegatedEventsInitialized) {
            initializeDelegatedEvents();
            delegatedEventsInitialized = true;
        }

        clearBlockMarkers();

        // この呼び出し専用の世代番号を発行する。
        // 実行時（rAF後）に markerGeneration と一致しなければ、
        // より新しい generateBlockMarkers() 呼び出しに割り込まれた
        // ということなので、_placeBlockMarkers() 側で処理を中断する。
        markerGeneration += 1;
        const myGeneration = markerGeneration;

        // requestAnimationFrame でレイアウト確定後にマーカーを配置
        requestAnimationFrame(() => _placeBlockMarkers(blocks, diffContent, 0, myGeneration));
    }

    /**
     * ブロックマーカーを DOM に配置する（内部処理）
     * generateBlockMarkers() の requestAnimationFrame コールバックから呼ばれる。
     * scrollHeight が 0 の場合は次フレームに再試行し、
     * CONFIG.MARKER_PLACEMENT_MAX_RETRY 回で打ち切る
     * （非表示タブ等での無限ループを防止）。
     * @private
     * @param {DiffBlock[]} blocks - ブロック配列
     * @param {HTMLElement} diffContent - スクロール対象要素
     * @param {number} [retryCount=0] - 再試行回数
     * @param {number} generation - この呼び出しの世代番号（generateBlockMarkers()参照）
     * @returns {void}
     */
    function _placeBlockMarkers(blocks, diffContent, retryCount = 0, generation) {
        // より新しい generateBlockMarkers() 呼び出しに割り込まれていたら、
        // このチェーンは古い結果になるため何もしない（マーカー重複防止）
        if (generation !== markerGeneration) {
            Logger.log('_placeBlockMarkers: より新しい呼び出しに置き換えられたため中断');
            return;
        }

        const contentHeight = diffContent.scrollHeight;

        if (contentHeight === 0) {
            if (retryCount >= CONFIG.MARKER_PLACEMENT_MAX_RETRY) {
                Logger.warn(
                    `_placeBlockMarkers: scrollHeight が ${CONFIG.MARKER_PLACEMENT_MAX_RETRY} フレーム後も 0 のため配置をスキップ`
                );
                return;
            }
            requestAnimationFrame(() =>
                _placeBlockMarkers(blocks, diffContent, retryCount + 1, generation)
            );
            return;
        }

        const paneLeft = AppState.elements.locationPaneLeft;
        const paneRight = AppState.elements.locationPaneRight;

        // ペインの実際の高さを取得（ヘッダー込みの全体高さ）
        const paneHeight = (paneLeft || paneRight)?.clientHeight || 0;
        if (paneHeight === 0) {
            Logger.warn('_placeBlockMarkers: paneHeight が 0');
            return;
        }

        // .minimap-header (position:sticky) が上部 16px を占有するため
        // マーカー(position:absolute)はその下のエリアにマッピングする:
        //   topPx    = 16 + (rowOffsetTop / contentH) * (paneH - 16)
        //   heightPx = (rowHeight / contentH) * (paneH - 16)  ← 最小値保証あり
        const HEADER_H = 16;
        const availH = paneHeight - HEADER_H;

        blocks.forEach((block, index) => {
            const firstRow = block.rows[0];
            const lastRow = block.rows[block.rows.length - 1];
            const top = firstRow.offsetTop;
            const height = lastRow.offsetTop + lastRow.offsetHeight - top;

            const topPct = HEADER_H + (top / contentHeight) * availH;
            const heightPct = Math.max(
                (height / contentHeight) * availH,
                (CONFIG.MARKER_MIN_HEIGHT_PERCENT / 100) * availH
            );

            const showLabel = blocks.length <= CONFIG.BLOCK_LABEL_DISPLAY_THRESHOLD;

            // 左ペイン: block に保存した旧ファイル側の実際の色をそのまま使用
            if (block.leftColor && paneLeft) {
                const m = _createBlockMarkerEl(
                    index,
                    block,
                    topPct,
                    heightPct,
                    block.leftColor,
                    showLabel
                );
                paneLeft.appendChild(m);
            }

            // 右ペイン: block に保存した新ファイル側の実際の色をそのまま使用
            if (block.rightColor && paneRight) {
                const m = _createBlockMarkerEl(
                    index,
                    block,
                    topPct,
                    heightPct,
                    block.rightColor,
                    showLabel
                );
                paneRight.appendChild(m);
            }
        });

        Logger.log(
            `✅ ブロックマーカー配置完了: ${blocks.length}個 / scrollHeight: ${contentHeight}`
        );
    }

    /**
     * ブロックマーカーDOM要素を生成（左右共通）
     * @private
     */
    function _createBlockMarkerEl(index, block, topPct, heightPct, color, showLabel) {
        const marker = document.createElement('div');
        marker.classList.add('marker', 'block-marker');
        marker.dataset.blockId = block.id;
        marker.dataset.blockIndex = index;
        marker.style.top = `${topPct}px`; // px直接指定（ヘッダー16px回避済）
        marker.style.height = `${heightPct}px`;
        marker.style.backgroundColor = color;

        if (showLabel) {
            const label = document.createElement('span');
            label.className = 'block-marker-label';
            label.textContent = index + 1;
            marker.appendChild(label);
        }

        marker.setAttribute('tabindex', '0');
        marker.setAttribute('role', 'button');
        marker.setAttribute(
            'aria-label',
            `差分ブロック ${index + 1} (${block.rows.length}行) へジャンプ`
        );

        return marker;
    }

    /**
     * イベント委譲を初期化（一度だけ実行）
     * @private
     * @returns {void}
     */
    function initializeDelegatedEvents() {
        const paneLeft = AppState.elements.locationPaneLeft;
        const paneRight = AppState.elements.locationPaneRight;

        // メモリリーク対策: 既存のハンドラを削除
        if (clickHandler) {
            paneLeft?.removeEventListener('click', clickHandler);
            paneRight?.removeEventListener('click', clickHandler);
            Logger.log('既存のblock-marker clickハンドラを削除');
        }
        if (keydownHandler) {
            paneLeft?.removeEventListener('keydown', keydownHandler);
            paneRight?.removeEventListener('keydown', keydownHandler);
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

        // ホバー時: 同じ data-block-index を持つ左右マーカーをまとめてハイライト
        mouseoverHandler = (e) => {
            const m = e.target.closest('.marker.block-marker');
            if (!m) return;
            const idx = m.dataset.blockIndex;
            document
                .querySelectorAll(`.block-marker[data-block-index="${idx}"]`)
                .forEach((el) => el.classList.add('block-marker-hover'));
        };
        mouseoutHandler = (e) => {
            const m = e.target.closest('.marker.block-marker');
            if (!m) return;
            const idx = m.dataset.blockIndex;
            // 同じブロック内の別マーカーへの移動は解除しない
            if (e.relatedTarget?.closest(`.block-marker[data-block-index="${idx}"]`)) return;
            document
                .querySelectorAll(`.block-marker[data-block-index="${idx}"]`)
                .forEach((el) => el.classList.remove('block-marker-hover'));
        };

        paneLeft?.addEventListener('click', clickHandler);
        paneLeft?.addEventListener('keydown', keydownHandler);
        paneLeft?.addEventListener('mouseover', mouseoverHandler);
        paneLeft?.addEventListener('mouseout', mouseoutHandler);
        paneRight?.addEventListener('click', clickHandler);
        paneRight?.addEventListener('keydown', keydownHandler);
        paneRight?.addEventListener('mouseover', mouseoverHandler);
        paneRight?.addEventListener('mouseout', mouseoutHandler);

        Logger.log('✅ Block-marker event delegation initialized (click/keydown/hover)');
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

        // NOTE: _createBlockHighlight() は wrapper.dataset.blockIndex に
        // AppState.currentDiffIndex を書き込む。以前はこの代入が _createBlockHighlight()
        // の「後」にあったため、生成された wrapper には常に「1つ前の」currentDiffIndex
        // （初回ジャンプ時は -1）が記録されてしまい、リサイズ時の updateBlockHighlight() が
        // 誤ったブロック（または blockIndex < 0 で何もしない）を参照するバグがあった。
        // 必ず _createBlockHighlight() より前に更新すること。
        AppState.currentDiffIndex = index;

        _createBlockHighlight(block);

        const firstRow = block.rows[0];

        try {
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
            Logger.error('スクロールエラー:', error);
        }

        AppState.isNavigatingToDiff = true;

        // 左右両ペインのマーカーをまとめて選択状態にする
        document
            .querySelectorAll('.marker-selected')
            .forEach((m) => m.classList.remove('marker-selected'));
        document
            .querySelectorAll(`.block-marker[data-block-index="${index}"]`)
            .forEach((m) => m.classList.add('marker-selected'));

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

        const current =
            AppState.currentDiffIndex >= 0 && AppState.currentDiffIndex < AppState.diffBlocks.length
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
        const paneLeft = AppState.elements.locationPaneLeft;
        const paneRight = AppState.elements.locationPaneRight;

        // イベント委譲モデルのため、マーカー要素への個別リスナー登録は行っていない。
        // DOM から remove() するだけでよい。
        [paneLeft, paneRight].forEach((pane) => {
            if (!pane) return;
            pane.querySelectorAll('.block-marker').forEach((marker) => marker.remove());
        });

        Logger.log('✅ Block markers cleared (left + right panes)');
    }

    /**
     * イベント委譲のクリーンアップ（メモリリーク対策の要）
     * @returns {void}
     */
    function cleanupDelegation() {
        const paneLeft = AppState.elements.locationPaneLeft;
        const paneRight = AppState.elements.locationPaneRight;

        if (!paneLeft && !paneRight) {
            Logger.warn('locationPane (left/right) not found during block-marker cleanup');
            return;
        }

        if (clickHandler) {
            paneLeft?.removeEventListener('click', clickHandler);
            paneRight?.removeEventListener('click', clickHandler);
            clickHandler = null;
            Logger.log('✅ block-marker clickハンドラを削除しました');
        }

        if (keydownHandler) {
            paneLeft?.removeEventListener('keydown', keydownHandler);
            paneRight?.removeEventListener('keydown', keydownHandler);
            keydownHandler = null;
            Logger.log('✅ block-marker keydownハンドラを削除しました');
        }

        if (mouseoverHandler) {
            paneLeft?.removeEventListener('mouseover', mouseoverHandler);
            paneRight?.removeEventListener('mouseover', mouseoverHandler);
            mouseoverHandler = null;
            Logger.log('✅ block-marker mouseoverハンドラを削除しました');
        }

        if (mouseoutHandler) {
            paneLeft?.removeEventListener('mouseout', mouseoutHandler);
            paneRight?.removeEventListener('mouseout', mouseoutHandler);
            mouseoutHandler = null;
            Logger.log('✅ block-marker mouseoutハンドラを削除しました');
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
        setNavigation,
    };
})();

export { BlockMarkerGenerator };
