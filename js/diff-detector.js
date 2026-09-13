/**
 * DiffBlockDetector (改善版 v6.1)
 * 差分ブロック検出
 * 依存: config.js, state.js, table-processor.js
 *
 * @fileoverview 差分ブロックの検出を行うモジュール
 * @remark マーカー生成・ナビゲーションは block-marker-generator.js に分離した。
 */

'use strict';
import { CONFIG } from './config.js';
import { Logger } from './state.js';
import { TableProcessor } from './table-processor.js';

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
            // 左列(旧ファイル)・右列(新ファイル)の色を個別に取得
            const { left: leftColor, right: rightColor } = TableProcessor.getRowColors(row);
            const color = leftColor || rightColor; // どちらかに色があれば差分行

            if (color) {
                const type = _colorToType(color);

                // 同じタイプで連続している場合は結合
                if (
                    currentBlock &&
                    currentBlock.type === type &&
                    currentBlock.endIndex === index - 1
                ) {
                    currentBlock.endIndex = index;
                    currentBlock.rows.push(row);
                } else {
                    if (currentBlock) {
                        blocks.push(currentBlock);
                    }
                    // prettier-ignore
                    currentBlock = {
                        id: blocks.length,
                        type: type,
                        color: color,       // 後方互換用（代表色）
                        leftColor,          // 旧ファイル側の色（ミニマップ左ペイン用）
                        rightColor,         // 新ファイル側の色（ミニマップ右ペイン用）
                        startIndex: index,
                        endIndex: index,
                        rows: [row],
                    };
                }
            } else {
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
        const entry = CONFIG.DIFF_COLOR_MAP.find((e) => e.color === color);
        return entry ? entry.type : 'unknown';
    }

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

    /**
     * ブロック統計を取得
     * @param {DiffBlock[]} blocks - ブロック配列
     * @returns {BlockStats} 統計情報
     */
    function getBlockStats(blocks) {
        const stats = {
            total: blocks.length,
            addBlocks: 0,
            delBlocks: 0,
            totalAddLines: 0,
            totalDelLines: 0,
            averageBlockSize: 0,
        };

        blocks.forEach((block) => {
            const category = _classifyBlockType(block.type);
            if (category === 'add') {
                stats.addBlocks++;
                stats.totalAddLines += block.rows.length;
            } else if (category === 'del') {
                stats.delBlocks++;
                stats.totalDelLines += block.rows.length;
            }
        });

        stats.averageBlockSize =
            blocks.length > 0 ? (stats.totalAddLines + stats.totalDelLines) / blocks.length : 0;

        return stats;
    }

    return {
        detectBlocks,
        getBlockStats,
    };
})();

export { DiffBlockDetector };
