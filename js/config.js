/**
 * WinMerge Report Viewer - 設定定数 (改善版 v6.1)
 * 
 * アプリケーション全体で使用する定数を定義
 * 依存: なし
 * 
 * @fileoverview アプリケーション設定の一元管理
 */

'use strict';

/**
 * アプリケーション設定
 */
const CONFIG = {
    // ========================================
    // ファイル関連
    // ========================================
    MAX_FILE_SIZE: 10 * 1024 * 1024,  // 最大ファイルサイズ（10MB）
    SUPPORTED_EXTENSIONS: ['.htm', '.html'],  // サポートする拡張子
    MAX_FILENAME_DISPLAY: 50,  // ファイル名の最大表示文字数
    
    // ========================================
    // HTML処理
    // ========================================
    ALLOWED_TAGS: ['table', 'tr', 'td', 'th', 'span', 'div', 'style'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onfocus', 'onmouseover'],
    
    // ========================================
    // 差分表示
    // ========================================
    /**
     * 差分色の定義（Single Source of Truth）
     * WinMerge の差分色を変更する場合はここだけ編集してください。
     *
     * 色はすべて WinMerge のデフォルトカラースキーム（Default.ini）と一致しています。
     * WinMerge 内部は BGR 形式で保持していますが、HTML レポート出力時に
     * RGB に変換されるため、ここでは RGB 形式で定義しています。
     *
     * ⑥ 将来の動的設定UI向け: loadUserColorConfig() が
     *    localStorage の値でこの配列を上書きします（config.js 末尾参照）。
     */
    DIFF_COLOR_MAP: [
        { color: 'rgb(239, 203, 5)',   type: 'changed',    label: '変更行' },        // #efcb05
        { color: 'rgb(241, 226, 173)', type: 'word',       label: '変更行内差分' },   // #f1e2ad
        { color: 'rgb(255, 160, 160)', type: 'del',        label: '削除・追加行' },   // #ffa0a0
        { color: 'rgb(255, 170, 130)', type: 'moved_from', label: '移動元' },         // #ffaa82
        { color: 'rgb(200, 129, 108)', type: 'moved_to',   label: '移動先' },         // #c8816c
        { color: 'rgb(192, 192, 192)', type: 'separator',  label: '区切り行' },       // #c0c0c0
    ],

    // 後方互換のため残すが DIFF_COLOR_MAP を優先すること
    DIFF_COLORS: ['rgb(239, 203, 5)', 'rgb(255, 160, 160)'],
    
    // ========================================
    // UI関連
    // ========================================
    RIGHT_BAR_WIDTH: 7,  // 右端バーの幅（px）
    MIN_COLUMN_WIDTH: 300,  // カラムの最小幅（px）
    HEADER_ADJUSTMENT: 17.5,  // ヘッダー幅の調整値（px）
    HEADER_VISIBILITY_THRESHOLD: 2,  // ヘッダー表示の閾値（px）
    MIN_MARKER_HEIGHT: 2,  // マーカーの最小高さ（px）
    
    // ★統合: UI_CONSTANTS から移動
    CONTROL_BUTTONS: ['resetButton', 'scrollTopButton', 'prevDiffButton', 'nextDiffButton'],
    
    // ========================================
    // タイミング・遅延（ミリ秒）
    // ========================================
    RENDER_DELAY: 100,  // レンダリング遅延
    RESIZE_DEBOUNCE_DELAY: 150,  // リサイズデバウンス遅延
    NAVIGATION_COMPLETE_DELAY: 1000,  // ナビゲーション完了待機時間
    
    PROGRESS_STEP_DELAY_MS: 50,  // プログレス各ステップ間の待機時間
    PROGRESS_MARKER_DELAY_MS: 100,  // マーカー生成ステップの待機時間
    PROGRESS_COMPLETION_DELAY_MS: 500,  // プログレス完了後の表示時間
    
    SCROLL_TO_TOP_RESET_DELAY_MS: 1500,  // トップへスクロール後のリセット待機時間
    
    // ========================================
    // パフォーマンス
    // ========================================
    MEMORY_THRESHOLD_RATIO: 0.9,  // メモリ使用率の閾値（90%）
    MEMORY_CHECK_INTERVAL: 30000,  // メモリチェック間隔（30秒）
    
    // ========================================
    // スタイル
    // ========================================
    HIGHLIGHT_BOX_SHADOW: '0 0 0 3px rgba(0, 123, 255, 0.6)',
    HIGHLIGHT_BORDER_RADIUS: '4px',

    // ミニマップマーカーの統一色
    // 位置把握が目的のため色分けは行わず1色で統一する
    MARKER_COLOR: '#F2D74E',
    
    // ========================================
    // マーカー表示
    // ========================================
    BLOCK_LABEL_DISPLAY_THRESHOLD: 20,  // この数以下の場合、ブロック番号ラベルを表示
    MARKER_MIN_HEIGHT_PERCENT: 0.5,  // マーカーの最小高さ（%）
    TEXT_PREVIEW_MAX_LENGTH: 100,  // テキストプレビューの最大文字数
    
    // ========================================
    // 説明コメント（開発者向け）
    // ========================================
    // BLOCK_LABEL_DISPLAY_THRESHOLD:
    //   ブロック数がこの値以下の場合、各ブロックマーカーに番号ラベルを表示します。
    //   これより多いと画面が見づらくなるため、ラベルは非表示になります。
    //
    // PROGRESS_STEP_DELAY_MS:
    //   プログレスインジケーターの各ステップ間で待機する時間です。
    //   この待機により、ユーザーは処理の進行状況を視覚的に確認できます。
    //
    // TEXT_PREVIEW_MAX_LENGTH:
    //   差分行のテキストプレビュー（ツールチップやログ用）の最大文字数です。
    //   長すぎるテキストは切り詰められます。
};

/**
 * ドラッグ&ドロップイベント
 */
const DRAG_EVENTS = ['dragenter', 'dragover', 'dragleave', 'drop'];
const HIGHLIGHT_EVENTS = ['dragenter', 'dragover'];
const UNHIGHLIGHT_EVENTS = ['dragleave', 'drop'];

// ========================================
// ⑥ 差分色の動的設定 UI — 準備コード
// ========================================
// 将来の設定画面実装時に活用してください。
// 現在はコメントアウト状態です。有効化しても他のコードに影響はありません。
//
// /**
//  * ユーザーが保存した差分色設定を LocalStorage から読み込み、
//  * CONFIG.DIFF_COLOR_MAP を上書きします。
//  * アプリ起動時（main.js の init() の先頭）で呼び出してください。
//  */
// function loadUserColorConfig() {
//     try {
//         const saved = localStorage.getItem('winmerge_diffColors');
//         if (saved) {
//             const parsed = JSON.parse(saved);
//             // 最低限のバリデーション
//             if (Array.isArray(parsed) && parsed.every(e => e.color && e.type)) {
//                 CONFIG.DIFF_COLOR_MAP = parsed;
//             }
//         }
//     } catch (e) {
//         console.warn('[WinMergeViewer] 差分色設定の読み込みに失敗しました:', e);
//     }
// }
//
// /**
//  * ユーザーが選択した差分色を LocalStorage に保存し、即時反映します。
//  * 設定画面の「保存」ボタンから呼び出してください。
//  * @param {string} addColor - 追加行の色 (例: 'rgb(204, 255, 204)')
//  * @param {string} delColor - 削除行の色 (例: 'rgb(255, 204, 204)')
//  */
// function saveUserColorConfig(addColor, delColor) {
//     const config = [
//         { color: addColor, type: 'add' },
//         { color: delColor, type: 'del' },
//     ];
//     localStorage.setItem('winmerge_diffColors', JSON.stringify(config));
//     CONFIG.DIFF_COLOR_MAP = config;  // 即時反映
// }

export { CONFIG, DRAG_EVENTS, HIGHLIGHT_EVENTS, UNHIGHLIGHT_EVENTS };