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
     * html/body/:root を #viewer に読み替えた結果、そのルールが
     * 「#viewer要素そのもの」を（コンビネータを介さず直接）選択しうるかどうかを判定する。
     * 例: "#viewer", "#viewer:hover", "#viewer::before", "#viewer[data-x]" → true
     *     "#viewer div", "#viewer > div", "#viewer.foo" 相当のコンビネータ付きは false
     * #viewer自体が選択される場合、display/visibility等でビューア表示領域そのものを
     * 消し去られてしまうため、そうしたプロパティだけは別途除去する。
     * @private
     * @param {string} scopedSelector - スコープ変換後の単一セレクター
     * @returns {boolean}
     */
    _isViewerRootSelector(scopedSelector) {
        // スペース／子・隣接・一般兄弟コンビネータが含まれていれば「#viewer自身」ではなく
        // その配下・周辺の別要素を指すセレクターなので対象外。
        if (/[\s>+~]/.test(scopedSelector)) return false;
        // 単一コンパウンドセレクターとして #viewer から始まっているか
        // （疑似クラス・疑似要素・属性セレクターの付加は許容し、依然として#viewer自身を指す）
        return /^#viewer(?:$|[:.[])/.test(scopedSelector);
    },

    /**
     * #viewer要素そのものに対して、表示・操作を無効化しうるプロパティだけを
     * 宣言ブロックから除去する（それ以外の装飾プロパティはそのまま残す）。
     * @private
     * @param {string} declText - `{` と `}` の間の宣言ブロック文字列
     * @returns {string} 危険なプロパティを除去した宣言ブロック文字列
     */
    _stripViewerHidingDeclarations(declText) {
        // NOTE: `all: unset` / `all: initial` 等のショートハンドは意図的にブロックリストに
        // 含めていない。これらは値を「初期状態」に戻す方向にのみ働き、display を none にする
        // 効果は持たないため、#viewer を非表示にする攻撃の再現経路にはならない。
        const DANGEROUS_PROPS = new Set([
            'display',
            'visibility',
            'opacity',
            'pointer-events',
            'clip',
            'clip-path',
            'transform',
            'filter',
            'position',
            'top',
            'left',
            'right',
            'bottom',
            'z-index',
            'width',
            'height',
            'min-width',
            'min-height',
            'max-width',
            'max-height',
            'overflow',
            'overflow-x',
            'overflow-y',
        ]);

        return declText
            .split(';')
            .filter((decl) => {
                const propMatch = decl.split(':')[0];
                if (propMatch === undefined) return true;
                // ベンダープレフィックス（-webkit-transform 等）を剥がして判定する
                const prop = propMatch
                    .trim()
                    .toLowerCase()
                    .replace(/^-[a-z]+-/, '');
                return !DANGEROUS_PROPS.has(prop);
            })
            .join(';');
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
        // ここでは宣言ブロック（{ と } の間）も併せて取得し、html/body/:root 由来で
        // #viewer要素そのものを指してしまうセレクターについては、表示/操作を無効化
        // しうるプロパティだけを追加で除去する（CSSスコープエスケープ対策）。
        return css.replace(/([^{}]+)\{([^{}]*)\}/g, (match, selectorText, declText) => {
            const selector = selectorText.trim();
            if (!selector || selector.startsWith('@')) return match;

            const normalSelectors = [];
            const restrictedRules = [];

            selector.split(',').forEach((part) => {
                const trimmed = part.trim();
                if (!trimmed) return;

                let scoped;
                if (/^(html|body|:root)$/i.test(trimmed)) {
                    scoped = '#viewer';
                } else if (/^html\s+/i.test(trimmed)) {
                    scoped = '#viewer' + trimmed.replace(/^html/i, '');
                } else if (/^body\s*/i.test(trimmed)) {
                    scoped = '#viewer' + trimmed.replace(/^body/i, '');
                } else {
                    scoped = '#viewer ' + trimmed;
                }

                if (this._isViewerRootSelector(scoped)) {
                    const filtered = this._stripViewerHidingDeclarations(declText);
                    if (filtered.trim() === declText.trim()) {
                        // 危険なプロパティを含まないので通常どおり結合してよい
                        normalSelectors.push(scoped);
                    } else if (filtered.trim()) {
                        // 一部のプロパティのみ除去したものを個別ルールとして出力する
                        restrictedRules.push(`${scoped} {${filtered}}`);
                    }
                    // filtered が空文字列 = 危険なプロパティしかなかったのでルール自体を破棄
                } else {
                    normalSelectors.push(scoped);
                }
            });

            let result = '';
            if (normalSelectors.length) {
                result += normalSelectors.join(', ') + ' {' + declText + '}';
            }
            if (restrictedRules.length) {
                result += (result ? '\n' : '') + restrictedRules.join('\n');
            }
            return result;
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
