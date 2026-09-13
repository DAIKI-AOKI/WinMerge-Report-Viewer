/**
 * WinMerge Report Viewer - HTML処理
 *
 * HTMLのサニタイゼーションとスタイル処理
 * 依存: config.js, state.js, errors.js, table-processor.js, vendor/purify.es.js
 *
 * @fileoverview HTMLの安全な処理とスタイルインポート
 *
 * NOTE: js/vendor/purify.es.js（DOMPurify）はビルドステップなしで直接
 * importできるよう、npm パッケージの ESM ビルドをそのまま同梱している。
 * バージョンを更新する場合は、package.json の dompurify を更新した上で、
 * node_modules/dompurify/dist/purify.es.mjs を js/vendor/purify.es.js に
 * 上書きコピーすること（自動化するビルド手順は現状ない）。
 */

'use strict';
import { CONFIG } from './config.js';
import { AppState, Logger } from './state.js';
import { FileProcessingError, TableProcessingError } from './errors.js';
import { TableProcessor } from './table-processor.js';
import DOMPurify from './vendor/purify.es.js';

// DOMPurifyは許可した属性(style含む)の「値の中身」までは検証しない仕様のため、
// style属性については追加でCSSインジェクションパターンを検証するフックを登録する。
// importStyles()でのCSS安全化と同じ判定基準に揃えている。
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style' && data.attrValue) {
        if (
            /expression\s*\(|javascript\s*:|vbscript\s*:|@import|behavior\s*:|binding\s*:/i.test(
                data.attrValue
            )
        ) {
            data.keepAttr = false;
        }
    }
});

/**
 * HTML処理モジュール
 * @namespace HTMLProcessor
 */
const HTMLProcessor = {
    /**
     * HTMLをサニタイズ（DOMPurify使用）
     *
     * WinMergeが出力するHTMLは、<style>タグの中身を古いブラウザ互換のための
     * `<!-- ... -->` コメントで囲む慣習がある。DOMPurifyはコメントを使った
     * 難読化型XSS（mutation XSS）対策として、コメントを含む<style>ブロックを
     * 丸ごと削除する挙動をするため、DOMPurifyに渡す前にこのコメント記法だけを
     * 除去する（CSSの中身自体は一切変更しない、単純な文字列置換）。
     * @param {string} html - サニタイズするHTML文字列
     * @returns {string} サニタイズされたHTML
     */
    sanitize(html) {
        Logger.log('HTML sanitization started');
        try {
            const preprocessed = this._stripStyleComments(html);

            const clean = DOMPurify.sanitize(preprocessed, {
                WHOLE_DOCUMENT: true,
                ALLOWED_TAGS: CONFIG.ALLOWED_TAGS.concat(['html', 'head', 'body']),
                ALLOWED_ATTR: CONFIG.ALLOWED_ATTR,
            });

            if (!clean || !clean.trim()) {
                throw new Error('DOMPurify returned empty output');
            }

            Logger.log('HTML sanitization completed successfully');
            return clean;
        } catch (error) {
            Logger.error('Sanitize error:', error);
            throw new FileProcessingError(
                'HTMLの安全性を確認できないため、ファイルを表示できません。',
                'sanitize',
                error
            );
        }
    },

    /**
     * <style>タグ内の `<!-- -->` コメント記法を除去する（前処理専用、@private）
     * CSSの中身自体（プロパティ・値）には一切手を加えない。
     * @private
     * @param {string} html - 元のHTML文字列
     * @returns {string} <style>タグ内のコメント記号だけを除去したHTML文字列
     */
    _stripStyleComments(html) {
        return html.replace(
            /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
            (match, open, content, close) => {
                const cleaned = content.replace(/<!--/g, '').replace(/-->/g, '');
                return open + cleaned + close;
            }
        );
    },

    /**
     * スタイルをインポート
     * @param {Document} doc - DOMドキュメント
     * @returns {void}
     */
    importStyles(doc) {
        const styleNodes = doc.querySelectorAll('style');
        if (!styleNodes.length) return;

        AppState.importedStyleElem = document.createElement('style');
        AppState.importedStyleElem.setAttribute('data-imported', 'true');
        let css = '';
        styleNodes.forEach((s) => {
            const styleContent = this._sanitizeStyleText(s.textContent || '');
            if (styleContent) css += styleContent + '\n';
        });
        AppState.importedStyleElem.textContent = this._scopeCss(css);
        document.head.appendChild(AppState.importedStyleElem);
    },

    /**
     * WinMergeレポートのCSSをViewer領域に限定する。
     * @param {string} css - 安全性検査済みのCSS
     * @returns {string} #viewer 配下にスコープしたCSS
     */
    _scopeCss(css) {
        // @import / url() 等は _sanitizeStyleText() で拒否済み。
        // WinMergeの標準レポートは通常のスタイルルールのみで構成されるため、
        // セレクター部分だけを #viewer 配下へ限定する。
        return css.replace(/([^{}]+)\{/g, (match, selectorText) => {
            const selector = selectorText.trim();
            if (!selector || selector.startsWith('@')) return match;

            const scoped = selector
                .split(',')
                .map((part) => {
                    const trimmed = part.trim();
                    if (!trimmed) return trimmed;
                    if (/^(html|body|:root)$/i.test(trimmed)) return '#viewer';
                    if (/^html\s+/i.test(trimmed)) {
                        return '#viewer' + trimmed.replace(/^html/i, '');
                    }
                    if (/^body\s*/i.test(trimmed)) {
                        return '#viewer' + trimmed.replace(/^body/i, '');
                    }
                    return '#viewer ' + trimmed;
                })
                .join(', ');

            return scoped + ' {';
        });
    },

    /**
     * 危険な構文を含むCSSブロックを丸ごと破棄する。
     * CSSパーサーを導入していないため、外部リソース読み込みや旧式実行機能を
     * 含むブロックは部分修正せず拒否する（fail closed）。
     * @param {string} css - 検査対象のCSS
     * @returns {string} 安全と判定したCSS、または空文字列
     */
    _sanitizeStyleText(css) {
        const dangerousPattern =
            /expression\s*\(|javascript\s*:|vbscript\s*:|@import|behavior\s*:|binding\s*:|url\s*\(/i;
        return dangerousPattern.test(css) ? '' : css;
    },

    /**
     * テーブルを処理
     * @param {Document} doc - DOMドキュメント
     * @returns {HTMLTableElement} 処理されたテーブル
     * @throws {TableProcessingError} テーブルが見つからない場合
     */
    processTable(doc) {
        const diffTable = doc.querySelector('table.diff') || doc.querySelector('table');
        if (!diffTable) {
            throw new TableProcessingError(
                '差分テーブルが見つかりません。WinMerge HTMLレポートファイルであることを確認してください。'
            );
        }
        const table = diffTable.cloneNode(true);
        TableProcessor.addRightBars(table);
        return table;
    },

    /**
     * インポートしたスタイルを削除
     * @returns {void}
     */
    removeImportedStyle() {
        if (AppState.importedStyleElem && AppState.importedStyleElem.parentNode) {
            AppState.importedStyleElem.parentNode.removeChild(AppState.importedStyleElem);
            AppState.importedStyleElem = null;
        }
    },
};

export { HTMLProcessor };
