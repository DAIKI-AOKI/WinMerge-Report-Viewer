/**
 * tests/diff-detector-coverage.test.js
 *
 * diff-detector.js のカバレッジ向上テスト
 *
 * 対象: 既存テストで未カバーの分岐
 *   - _createBlockMarkerEl(): showLabel true/false のラベル表示分岐
 *   - _createBlockHighlight(): DOM 操作の各ケース
 *   - updateBlockHighlight(): 各異常系分岐
 *   - handleBlockMarkerClick(): 異常系（無効インデックス）
 *   - jumpToBlock(): rows が空のケース・highlight 生成
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// DOM フィクスチャ
// ========================================
function setupDOM() {
    document.body.innerHTML = `
        <div id="locationPane">
            <div id="locationPaneLeft"></div>
            <div id="locationPaneRight"></div>
        </div>
        <div id="diffContent">
            <div id="viewer"></div>
            <div id="diffInfo" class="info-hidden"></div>
            <button id="resetButton" class="button-hidden"></button>
            <button id="scrollTopButton" class="button-hidden"></button>
            <button id="prevDiffButton" class="button-hidden"></button>
            <button id="nextDiffButton" class="button-hidden"></button>
            <div id="fixedHeader" class="fixed-header-hidden">
                <table><tr id="fixedHeaderRow"></tr></table>
            </div>
            <div id="toolHeader"></div>
            <div id="dropArea"></div>
            <input id="fileInput" type="file" />
        </div>
    `;
    AppState.init();
}

/**
 * テスト用差分ブロックを生成
 */
function makeBlock(id = 0, rowCount = 2) {
    const rows = Array.from({ length: rowCount }, () => {
        const tr = document.createElement('tr');
        tr.scrollIntoView = vi.fn();
        return tr;
    });
    return {
        id,
        type: 'changed',
        color: 'rgb(239, 203, 5)',
        leftColor: 'rgb(239, 203, 5)',
        rightColor: 'rgb(239, 203, 5)',
        startIndex: id * rowCount,
        endIndex: id * rowCount + rowCount - 1,
        rows,
    };
}

/**
 * テーブルを viewer に追加して DOM に配置する
 */
function makeTableInViewer(rowCount = 3) {
    const table = document.createElement('table');
    for (let i = 0; i < rowCount; i++) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = `行${i}`;
        tr.appendChild(td);
        table.appendChild(tr);
    }
    AppState.elements.viewer.appendChild(table);
    return table;
}

beforeEach(() => {
    setupDOM();
    AppState.diffBlocks = [];
    AppState.currentDiffIndex = -1;
});

afterEach(() => {
    vi.restoreAllMocks();
    AppState.diffBlocks = [];
    AppState.currentDiffIndex = -1;
    // block-highlight-wrapper を削除
    document.querySelectorAll('.block-highlight-wrapper').forEach((el) => el.remove());
});

// ========================================
// updateBlockInfo() - 追加ケース
// ========================================
describe('BlockMarkerGenerator.updateBlockInfo() - 追加ケース', () => {
    it('currentDiffIndex が diffBlocks の範囲外のとき「差分: 0 / N」が表示される', () => {
        AppState.diffBlocks = [makeBlock(0), makeBlock(1)];
        AppState.currentDiffIndex = 5; // 範囲外
        BlockMarkerGenerator.updateBlockInfo();
        expect(AppState.elements.diffInfo.textContent).toBe('差分: 0 / 2');
    });
});

// ========================================
// jumpToBlock() - 追加ケース
// ========================================
describe('BlockMarkerGenerator.jumpToBlock() - 追加ケース', () => {
    it('currentDiffIndex が jumpToBlock 後に更新される', () => {
        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];
        AppState.currentDiffIndex = -1;

        BlockMarkerGenerator.jumpToBlock(0, block);

        expect(AppState.currentDiffIndex).toBe(0);
    });

    it('isNavigatingToDiff が一時的に true になる', () => {
        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];

        BlockMarkerGenerator.jumpToBlock(0, block);

        // jumpToBlock 直後は true（setTimeout で false に戻る）
        expect(AppState.isNavigatingToDiff).toBe(true);
    });

    it('複数ブロックで2番目にジャンプできる', () => {
        const blocks = [makeBlock(0, 2), makeBlock(1, 2)];
        AppState.diffBlocks = blocks;

        BlockMarkerGenerator.jumpToBlock(1, blocks[1]);

        expect(AppState.currentDiffIndex).toBe(1);
        expect(blocks[1].rows[0].scrollIntoView).toHaveBeenCalledOnce();
    });
});

// ========================================
// _createBlockHighlight() - DOM 操作ケース
// ========================================
describe('BlockMarkerGenerator._createBlockHighlight() 経由 jumpToBlock()', () => {
    it('jumpToBlock 後に .block-highlight-wrapper が DOM に追加される', () => {
        const table = makeTableInViewer(3);
        const block = makeBlock(0, 1);
        // rows に実際の DOM 要素を使う
        block.rows = [table.querySelectorAll('tr')[0]];
        AppState.diffBlocks = [block];

        BlockMarkerGenerator.jumpToBlock(0, block);

        const wrapper = document.querySelector('.block-highlight-wrapper');
        expect(wrapper).not.toBeNull();
    });

    // 回帰テスト: 以前は _createBlockHighlight() が AppState.currentDiffIndex を
    // 更新前（＝1つ前の値。初回ジャンプ時は -1）に読んでいたため、
    // wrapper.dataset.blockIndex に誤った値が書き込まれるバグがあった。
    it('初回ジャンプ（currentDiffIndex: -1→0）でも wrapper.dataset.blockIndex が正しく現在のindexになる', () => {
        const table = makeTableInViewer(3);
        const block = makeBlock(0, 1);
        block.rows = [table.querySelectorAll('tr')[0]];
        AppState.diffBlocks = [block];
        expect(AppState.currentDiffIndex).toBe(-1); // beforeEachでの初期値を前提とする

        BlockMarkerGenerator.jumpToBlock(0, block);

        const wrapper = document.querySelector('.block-highlight-wrapper');
        expect(wrapper.dataset.blockIndex).toBe('0');
    });

    it('2回 jumpToBlock を呼ぶと .block-highlight-wrapper は1件だけになる', () => {
        const table = makeTableInViewer(3);
        const rows = table.querySelectorAll('tr');
        const block0 = { ...makeBlock(0, 1), rows: [rows[0]] };
        const block1 = { ...makeBlock(1, 1), rows: [rows[1]] };
        AppState.diffBlocks = [block0, block1];

        BlockMarkerGenerator.jumpToBlock(0, block0);
        BlockMarkerGenerator.jumpToBlock(1, block1);

        const wrappers = document.querySelectorAll('.block-highlight-wrapper');
        expect(wrappers.length).toBe(1);
    });
});

// ========================================
// updateBlockHighlight() - 各異常系分岐
// ========================================
describe('BlockMarkerGenerator.updateBlockHighlight() - 異常系', () => {
    it('.block-highlight-wrapper がない場合は例外が発生しない', () => {
        AppState.diffBlocks = [makeBlock(0)];
        AppState.currentDiffIndex = 0;
        expect(() => BlockMarkerGenerator.updateBlockHighlight()).not.toThrow();
    });

    it('blockIndex が NaN の wrapper がある場合も例外が発生しない', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'block-highlight-wrapper';
        wrapper.dataset.blockIndex = 'NaN';
        document.body.appendChild(wrapper);

        expect(() => BlockMarkerGenerator.updateBlockHighlight()).not.toThrow();
        wrapper.remove();
    });

    it('blockIndex が範囲外の wrapper がある場合も例外が発生しない', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'block-highlight-wrapper';
        wrapper.dataset.blockIndex = '99';
        document.body.appendChild(wrapper);

        AppState.diffBlocks = [makeBlock(0)]; // index 99 は存在しない

        expect(() => BlockMarkerGenerator.updateBlockHighlight()).not.toThrow();
        wrapper.remove();
    });
});

// ========================================
// updateBlockHighlight() - 正常系（実際に座標を再計算するケース）
// ========================================
// NOTE: 以前は「有効なブロックで例外が発生しない」というテストがあったが、
// DOM に .block-highlight-wrapper が一度も生成されていなかったため
// 先頭の `if (!wrapper) return;` で毎回早期returnしており、
// 座標再計算ロジック本体（535, 537-563行目）は一度も実行されていなかった。
// ここでは jumpToBlock() 経由で実際に .block-highlight-wrapper を生成させたうえで、
// getBoundingClientRect をモックして座標が正しく再計算されることを検証する。
describe('BlockMarkerGenerator.updateBlockHighlight() - 正常系', () => {
    it('リサイズ後の座標（left/top/width/height）が再計算されてwrapperに反映される', () => {
        const table = makeTableInViewer(2);
        const rows = table.querySelectorAll('tr');
        const block = makeBlock(0, 2);
        block.rows = [rows[0], rows[1]];
        AppState.diffBlocks = [block];

        // jumpToBlock() 経由で _createBlockHighlight() を呼び、
        // 実際に .block-highlight-wrapper を DOM に生成させる
        BlockMarkerGenerator.jumpToBlock(0, block);
        const wrapper = document.querySelector('.block-highlight-wrapper');
        expect(wrapper).not.toBeNull();

        const container = table.parentElement;
        container.scrollTop = 3;

        // リサイズが起きて座標が変わった状況を再現する
        vi.spyOn(table, 'getBoundingClientRect').mockReturnValue({
            top: 0,
            left: 15,
            right: 215,
            bottom: 0,
            width: 200,
            height: 0,
        });
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            top: 10,
            left: 5,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
        });
        vi.spyOn(rows[0], 'getBoundingClientRect').mockReturnValue({
            top: 20,
            left: 0,
            right: 0,
            bottom: 40,
            width: 0,
            height: 20,
        });
        vi.spyOn(rows[1], 'getBoundingClientRect').mockReturnValue({
            top: 60,
            left: 0,
            right: 0,
            bottom: 80,
            width: 0,
            height: 20,
        });

        BlockMarkerGenerator.updateBlockHighlight();

        // top = firstRowRect.top - containerRect.top + container.scrollTop = 20 - 10 + 3 = 13
        expect(wrapper.style.top).toBe('13px');
        // height = lastRowRect.bottom - firstRowRect.top = 80 - 20 = 60
        expect(wrapper.style.height).toBe('60px');
        // left = tableRect.left - containerRect.left = 15 - 5 = 10
        expect(wrapper.style.left).toBe('10px');
        // width = tableRect.width = 200
        expect(wrapper.style.width).toBe('200px');
    });
});

// ========================================
// cleanupDelegation() - 繰り返し呼び出し
// ========================================
describe('BlockMarkerGenerator.cleanupDelegation() - 追加ケース', () => {
    it('複数回呼び出しても例外が発生しない', () => {
        BlockMarkerGenerator.cleanupDelegation();
        expect(() => BlockMarkerGenerator.cleanupDelegation()).not.toThrow();
    });

    it('cleanup() 後に cleanupDelegation() を呼んでも例外が発生しない', () => {
        BlockMarkerGenerator.cleanup();
        expect(() => BlockMarkerGenerator.cleanupDelegation()).not.toThrow();
    });
});

// ========================================
// setNavigation() - 注入の確認
// ========================================
describe('BlockMarkerGenerator.setNavigation()', () => {
    it('Navigation を注入して jumpToBlock を呼んでも例外が発生しない', () => {
        const mockNav = {
            clearCurrentDiffHighlight: vi.fn(),
            highlightSelectedMarker: vi.fn(),
        };
        BlockMarkerGenerator.setNavigation(mockNav);

        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];

        expect(() => BlockMarkerGenerator.jumpToBlock(0, block)).not.toThrow();
    });

    it('null を注入しても jumpToBlock で例外が発生しない', () => {
        BlockMarkerGenerator.setNavigation(null);

        const block = makeBlock(0, 2);
        AppState.diffBlocks = [block];

        expect(() => BlockMarkerGenerator.jumpToBlock(0, block)).not.toThrow();
    });
});

// ========================================
// DiffBlockDetector.detectBlocks() - 追加ケース
// ========================================
describe('DiffBlockDetector.detectBlocks() - 追加ケース', () => {
    it('左右で色が異なる行のブロックに leftColor / rightColor が設定される', () => {
        const row = document.createElement('tr');

        const titleLeft = document.createElement('td');
        titleLeft.className = 'title';
        row.appendChild(titleLeft);

        const contentLeft = document.createElement('td');
        contentLeft.style.backgroundColor = 'rgb(239, 203, 5)';
        row.appendChild(contentLeft);

        const titleRight = document.createElement('td');
        titleRight.className = 'title';
        row.appendChild(titleRight);

        const contentRight = document.createElement('td');
        contentRight.style.backgroundColor = 'rgb(255, 160, 160)';
        row.appendChild(contentRight);

        const rightBar = document.createElement('td');
        rightBar.className = 'added-right-bar';
        row.appendChild(rightBar);

        const table = document.createElement('table');
        table.appendChild(row);
        document.body.appendChild(table);

        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].leftColor).toBe('rgb(239, 203, 5)');
        expect(blocks[0].rightColor).toBe('rgb(255, 160, 160)');

        table.remove();
    });

    it('すべて差分行のテーブルは1ブロックにまとめられる', () => {
        const table = document.createElement('table');
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.style.backgroundColor = 'rgb(239, 203, 5)';
            tr.appendChild(td);
            const td2 = document.createElement('td');
            tr.appendChild(td2);
            table.appendChild(tr);
        }
        document.body.appendChild(table);

        const blocks = DiffBlockDetector.detectBlocks(table);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].rows).toHaveLength(5);

        table.remove();
    });
});
