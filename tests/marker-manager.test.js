/**
 * marker-manager.test.js
 *
 * ⚠️ MarkerManager は v2 で _legacy/ に隔離されたため、このテストは無効化されています。
 *
 * 旧 MarkerManager の機能（行単位マーカー）は廃止され、
 * ブロック単位マーカーの BlockMarkerGenerator に置き換えられました。
 * BlockMarkerGenerator のテストは block-marker-generator.test.js を参照してください。
 */

import { describe, it } from 'vitest';

describe('MarkerManager (legacy)', () => {
    it('このモジュールは _legacy/ に隔離済みのためテストをスキップ', () => {
        // MarkerManager は v2 で _legacy/ に移動済み。
        // 行単位マーカー機能は BlockMarkerGenerator に置き換えられた。
    });
});
