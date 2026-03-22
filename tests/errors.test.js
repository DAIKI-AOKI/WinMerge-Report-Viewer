/**
 * errors.js のユニットテスト（Vitest / Jest 対応）
 *
 * 実行方法:
 *   npm install -D vitest
 *   npx vitest run
 *
 * このファイルは DOM に依存しないため、ESM 移行前から単体で実行できます。
 * errors.js の export をコメントインした後、下記の import を有効化してください。
 */

// ESM 移行後は下記を有効化:
// import {
//     FileValidationError, FileProcessingError,
//     HTMLParsingError, TableProcessingError, NavigationError,
// } from '../js/errors.js';

import { describe, it, expect } from 'vitest';

// ========================================
// FileValidationError
// ========================================
describe('FileValidationError', () => {
    it('name が正しく設定される', () => {
        const err = new FileValidationError('テスト', 'TEST_CODE');
        expect(err.name).toBe('FileValidationError');
    });

    it('code が正しく設定される', () => {
        const err = new FileValidationError('テスト', 'INVALID_EXTENSION');
        expect(err.code).toBe('INVALID_EXTENSION');
    });

    it('Error を継承している', () => {
        const err = new FileValidationError('テスト', 'NO_FILE');
        expect(err instanceof Error).toBe(true);
    });

    it('timestamp が ISO 8601 形式で設定される', () => {
        const err = new FileValidationError('テスト', 'NO_FILE');
        expect(() => new Date(err.timestamp)).not.toThrow();
    });
});

// ========================================
// FileProcessingError
// ========================================
describe('FileProcessingError', () => {
    it('phase が正しく設定される', () => {
        const err = new FileProcessingError('失敗', 'sanitize');
        expect(err.phase).toBe('sanitize');
    });

    it('originalError が省略可能（デフォルト null）', () => {
        const err = new FileProcessingError('失敗', 'parse');
        expect(err.originalError).toBeNull();
    });

    it('originalError を渡せる', () => {
        const original = new Error('元エラー');
        const err = new FileProcessingError('失敗', 'read', original);
        expect(err.originalError).toBe(original);
    });
});

// ========================================
// HTMLParsingError
// ========================================
describe('HTMLParsingError', () => {
    it('name が HTMLParsingError である', () => {
        const err = new HTMLParsingError('解析失敗');
        expect(err.name).toBe('HTMLParsingError');
    });
});

// ========================================
// TableProcessingError
// ========================================
describe('TableProcessingError', () => {
    it('name が TableProcessingError である', () => {
        const err = new TableProcessingError('テーブル未発見');
        expect(err.name).toBe('TableProcessingError');
    });
});

// ========================================
// NavigationError
// ========================================
describe('NavigationError', () => {
    it('index が正しく設定される', () => {
        const err = new NavigationError('不正なインデックス', 42);
        expect(err.index).toBe(42);
    });

    it('index を省略するとデフォルト null', () => {
        const err = new NavigationError('エラー');
        expect(err.index).toBeNull();
    });
});
