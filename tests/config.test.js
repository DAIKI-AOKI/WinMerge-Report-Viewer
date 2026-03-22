/**
 * config.js のユニットテスト
 *
 * 検証方針:
 *   - 各定数の型・値が仕様通りか
 *   - DIFF_COLOR_MAP の構造が一貫しているか
 *   - 将来の定数変更を検知する回帰テスト
 */

import { describe, it, expect } from 'vitest';

// ========================================
// ファイル関連
// ========================================
describe('CONFIG - ファイル関連', () => {
    it('MAX_FILE_SIZE が 10MB である', () => {
        expect(CONFIG.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('SUPPORTED_EXTENSIONS に .htm と .html が含まれる', () => {
        expect(CONFIG.SUPPORTED_EXTENSIONS).toContain('.htm');
        expect(CONFIG.SUPPORTED_EXTENSIONS).toContain('.html');
    });

    it('MAX_FILENAME_DISPLAY が正の整数である', () => {
        expect(typeof CONFIG.MAX_FILENAME_DISPLAY).toBe('number');
        expect(CONFIG.MAX_FILENAME_DISPLAY).toBeGreaterThan(0);
    });
});

// ========================================
// HTML処理
// ========================================
describe('CONFIG - HTML処理', () => {
    it('ALLOWED_TAGS に table / tr / td / th が含まれる', () => {
        ['table', 'tr', 'td', 'th'].forEach(tag => {
            expect(CONFIG.ALLOWED_TAGS).toContain(tag);
        });
    });

    it('ALLOWED_TAGS に script が含まれない（XSS対策）', () => {
        expect(CONFIG.ALLOWED_TAGS).not.toContain('script');
    });

    it('ALLOWED_TAGS に iframe が含まれない（XSS対策）', () => {
        expect(CONFIG.ALLOWED_TAGS).not.toContain('iframe');
    });
});

// ========================================
// DIFF_COLOR_MAP
// ========================================
describe('CONFIG - DIFF_COLOR_MAP', () => {
    it('配列である', () => {
        expect(Array.isArray(CONFIG.DIFF_COLOR_MAP)).toBe(true);
    });

    it('1件以上の定義がある', () => {
        expect(CONFIG.DIFF_COLOR_MAP.length).toBeGreaterThan(0);
    });

    it('各エントリに color / type / label が存在する', () => {
        CONFIG.DIFF_COLOR_MAP.forEach((entry, i) => {
            expect(entry, `entry[${i}] に color がない`).toHaveProperty('color');
            expect(entry, `entry[${i}] に type がない`).toHaveProperty('type');
            expect(entry, `entry[${i}] に label がない`).toHaveProperty('label');
        });
    });

    it('color 値がすべて rgb() 形式である', () => {
        CONFIG.DIFF_COLOR_MAP.forEach((entry, i) => {
            expect(entry.color, `entry[${i}].color が rgb() 形式でない`).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
        });
    });

    it('type 値が許可された文字列のみである', () => {
        const VALID_TYPES = new Set([
            'changed', 'word', 'del', 'moved_from', 'moved_to', 'separator', 'unknown'
        ]);
        CONFIG.DIFF_COLOR_MAP.forEach((entry, i) => {
            expect(VALID_TYPES.has(entry.type), `entry[${i}].type "${entry.type}" は無効`).toBe(true);
        });
    });

    it('type 値に重複がない（Single Source of Truth）', () => {
        const types = CONFIG.DIFF_COLOR_MAP.map(e => e.type);
        const unique = new Set(types);
        expect(unique.size).toBe(types.length);
    });

    it('"changed" タイプが定義されている', () => {
        const entry = CONFIG.DIFF_COLOR_MAP.find(e => e.type === 'changed');
        expect(entry).toBeDefined();
    });

    it('"del" タイプが定義されている', () => {
        const entry = CONFIG.DIFF_COLOR_MAP.find(e => e.type === 'del');
        expect(entry).toBeDefined();
    });
});

// ========================================
// UI関連
// ========================================
describe('CONFIG - UI関連', () => {
    it('CONTROL_BUTTONS が4つのボタンIDを持つ', () => {
        expect(CONFIG.CONTROL_BUTTONS).toHaveLength(4);
        expect(CONFIG.CONTROL_BUTTONS).toContain('resetButton');
        expect(CONFIG.CONTROL_BUTTONS).toContain('nextDiffButton');
        expect(CONFIG.CONTROL_BUTTONS).toContain('prevDiffButton');
        expect(CONFIG.CONTROL_BUTTONS).toContain('scrollTopButton');
    });

    it('MARKER_MIN_HEIGHT_PERCENT が正の数値である', () => {
        expect(CONFIG.MARKER_MIN_HEIGHT_PERCENT).toBeGreaterThan(0);
    });
});

// ========================================
// タイミング・遅延
// ========================================
describe('CONFIG - タイミング', () => {
    it('PROGRESS_STEP_DELAY_MS が非負整数である', () => {
        expect(CONFIG.PROGRESS_STEP_DELAY_MS).toBeGreaterThanOrEqual(0);
    });

    it('RESIZE_DEBOUNCE_DELAY が正の整数である', () => {
        expect(CONFIG.RESIZE_DEBOUNCE_DELAY).toBeGreaterThan(0);
    });

    it('NAVIGATION_COMPLETE_DELAY が正の整数である', () => {
        expect(CONFIG.NAVIGATION_COMPLETE_DELAY).toBeGreaterThan(0);
    });
});
