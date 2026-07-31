/**
 * diff-detector.js のユニットテスト
 *
 * 検証方針:
 *   - detectBlocks() が連続する同色行を1ブロックにまとめるか
 *   - 異なる色が隣接した場合に別ブロックになるか
 *   - 差分なし行をブロックに含めないか
 *   - getBlockStats() がブロック統計を正しく集計するか
 *
 * jsdom は getComputedStyle で背景色を返さないため、
 * インラインスタイル（style.backgroundColor）で色を設定する。
 * TableProcessor.getRowColors() はインラインスタイルの
 * HEX / rgb 両形式をチェックするが、jsdom では rgb 形式で設定すれば
 * getComputedStyle も同じ値を返す。
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ========================================
// テスト用テーブルを生成するヘルパー
// ========================================

/**
 * 指定した色配列から <table> を生成する
 * @param {(string|null)[]} colors - 行ごとの背景色（null = 差分なし行）
 * @returns {HTMLTableElement}
 */
function makeTable(colors) {
    const table = document.createElement('table');
    colors.forEach(color => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        if (color) {
            // jsdom では getComputedStyle が inline style を返すため
            // inline style に直接セットする
            td.style.backgroundColor = color;
        }
        tr.appendChild(td);
        table.appendChild(tr);
    });
    // テーブルを document に追加して getComputedStyle が機能するようにする
    document.body.appendChild(table);
    return table;
}

// WinMerge デフォルト差分色（CONFIG.DIFF_COLOR_MAP と一致）
const COLOR_CHANGED    = 'rgb(239, 203, 5)';
const COLOR_DEL        = 'rgb(255, 160, 160)';
const COLOR_WORD       = 'rgb(241, 226, 173)';
const COLOR_MOVED_FROM = 'rgb(255, 170, 130)';
const COLOR_MOVED_TO   = 'rgb(200, 129, 108)';
const COLOR_SEPARATOR  = 'rgb(192, 192, 192)';

beforeEach(() => {
    document.body.innerHTML = '';
});

// ========================================
// DiffBlockDetector.detectBlocks()
// ========================================
describe('DiffBlockDetector.detectBlocks()', () => {

    it('差分がないテーブルではブロックが0件になる', () => {
        const table = makeTable([null, null, null]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(0);
    });

    it('連続する同色行が1つのブロックにまとめられる', () => {
        const table = makeTable([COLOR_CHANGED, COLOR_CHANGED, COLOR_CHANGED]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].rows).toHaveLength(3);
    });

    it('異なる色が隣接すると別ブロックになる', () => {
        const table = makeTable([COLOR_CHANGED, COLOR_DEL]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(2);
    });

    it('差分なし行を挟むとブロックが分断される', () => {
        const table = makeTable([COLOR_CHANGED, null, COLOR_CHANGED]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(2);
    });

    it('各ブロックに id / type / color / startIndex / endIndex / rows が存在する', () => {
        const table = makeTable([COLOR_CHANGED]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        const b = blocks[0];
        expect(b).toHaveProperty('id');
        expect(b).toHaveProperty('type');
        expect(b).toHaveProperty('color');
        expect(b).toHaveProperty('startIndex');
        expect(b).toHaveProperty('endIndex');
        expect(b).toHaveProperty('rows');
    });

    it('COLOR_CHANGED → type が "changed" になる', () => {
        const table = makeTable([COLOR_CHANGED]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('changed');
    });

    it('COLOR_DEL → type が "del" になる', () => {
        const table = makeTable([COLOR_DEL]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('del');
    });

    it('COLOR_WORD → type が "word" になる', () => {
        const table = makeTable([COLOR_WORD]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('word');
    });

    it('COLOR_MOVED_FROM → type が "moved_from" になる', () => {
        const table = makeTable([COLOR_MOVED_FROM]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('moved_from');
    });

    it('COLOR_MOVED_TO → type が "moved_to" になる', () => {
        const table = makeTable([COLOR_MOVED_TO]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('moved_to');
    });

    it('COLOR_SEPARATOR → type が "separator" になる', () => {
        const table = makeTable([COLOR_SEPARATOR]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('separator');
    });

    it('未知の色 → type が "unknown" になる', () => {
        const table = makeTable(['rgb(1, 2, 3)']);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].type).toBe('unknown');
    });

    it('startIndex / endIndex が行番号と一致する', () => {
        // 0: null, 1: changed, 2: changed, 3: null
        const table = makeTable([null, COLOR_CHANGED, COLOR_CHANGED, null]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks[0].startIndex).toBe(1);
        expect(blocks[0].endIndex).toBe(2);
    });

    it('複数ブロックの id が 0 から連番になる', () => {
        const table = makeTable([COLOR_CHANGED, null, COLOR_DEL, null, COLOR_WORD]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(3);
        blocks.forEach((b, i) => {
            expect(b.id).toBe(i);
        });
    });

    it('テーブル末尾がブロックで終わっても最後のブロックが含まれる', () => {
        const table = makeTable([null, COLOR_DEL, COLOR_DEL]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].rows).toHaveLength(2);
    });

    it('空のテーブルではブロックが0件になる', () => {
        const table = document.createElement('table');
        document.body.appendChild(table);
        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(0);
    });
});

// ========================================
// DiffBlockDetector.getBlockStats()
// ========================================
describe('DiffBlockDetector.getBlockStats()', () => {

    it('ブロックが0件のとき total が 0', () => {
        const stats = DiffBlockDetector.getBlockStats([]);
        expect(stats.total).toBe(0);
        expect(stats.addBlocks).toBe(0);
        expect(stats.delBlocks).toBe(0);
        expect(stats.averageBlockSize).toBe(0);
    });

    it('changed / word タイプは addBlocks にカウントされる', () => {
        const table = makeTable([COLOR_CHANGED, null, COLOR_WORD]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        const stats = DiffBlockDetector.getBlockStats(blocks);
        expect(stats.addBlocks).toBe(2);
        expect(stats.delBlocks).toBe(0);
    });

    it('del / moved_from / moved_to タイプは delBlocks にカウントされる', () => {
        const table = makeTable([COLOR_DEL, null, COLOR_MOVED_FROM, null, COLOR_MOVED_TO]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        const stats = DiffBlockDetector.getBlockStats(blocks);
        expect(stats.delBlocks).toBe(3);
        expect(stats.addBlocks).toBe(0);
    });

    it('totalAddLines が変更系ブロックの行数合計と一致する', () => {
        // changed 2行 + word 1行 = 3行
        const table = makeTable([COLOR_CHANGED, COLOR_CHANGED, null, COLOR_WORD]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        const stats = DiffBlockDetector.getBlockStats(blocks);
        expect(stats.totalAddLines).toBe(3);
    });

    it('averageBlockSize が (追加行数 + 削除行数) / 総ブロック数 になる', () => {
        // changed 2行(1ブロック) + del 1行(1ブロック) = 3行 / 2ブロック = 1.5
        const table = makeTable([COLOR_CHANGED, COLOR_CHANGED, null, COLOR_DEL]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        const stats = DiffBlockDetector.getBlockStats(blocks);
        expect(stats.averageBlockSize).toBeCloseTo(1.5);
    });

    it('separator は addBlocks / delBlocks どちらにもカウントされない', () => {
        const table = makeTable([COLOR_SEPARATOR]);
        const blocks = DiffBlockDetector.detectBlocks(table);
        const stats = DiffBlockDetector.getBlockStats(blocks);
        expect(stats.total).toBe(1);
        expect(stats.addBlocks).toBe(0);
        expect(stats.delBlocks).toBe(0);
    });
});
