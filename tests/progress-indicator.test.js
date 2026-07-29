/**
 * progress-indicator.js のユニットテスト（Vitest）
 *
 * これまで progress-indicator.js には専用のテストファイルが存在せず、
 * file-handler.test.js / integration/file-processing-flow.test.js 経由で
 * 間接的にカバーされていた（file-handler.js が実クラスを import して
 * new ProgressIndicator() するため、global.ProgressIndicator へのモック
 * 差し替えが効かず、実装がそのまま実行されていた）。
 *
 * 本ファイルでは ProgressIndicator クラスを直接 import し、
 * 通常フローでは到達しにくいエラー処理・早期returnの分岐を狙う。
 */
import { ProgressIndicator } from '../js/progress-indicator.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('ProgressIndicator.update() - 早期return', () => {
    it('show() を呼んでいない（overlay が null の）状態で update() を呼んでも例外が発生しない', () => {
        const progress = new ProgressIndicator();
        expect(() => progress.update(50)).not.toThrow();
    });
});

describe('ProgressIndicator.updateStepProgress() - 未知のstepId', () => {
    it('未知の stepId を渡すと console.warn が呼ばれ、進捗は更新されない', () => {
        const progress = new ProgressIndicator();
        progress.show();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        progress.updateStepProgress('unknownStep', 50);

        expect(warnSpy).toHaveBeenCalledWith('Unknown step ID: unknownStep');
        expect(progress.progressBar.style.width).toBe('0%');
    });
});

describe('ProgressIndicator.hide() - 早期return', () => {
    it('show() を呼んでいない状態で hide() を呼んでも例外が発生しない', () => {
        const progress = new ProgressIndicator();
        expect(() => progress.hide()).not.toThrow();
    });

    it('hideTimeout 発火前に overlay が null になっていても例外が発生しない', async () => {
        const progress = new ProgressIndicator();
        progress.show();

        progress.hide(10);
        // hideTimeout が発火する前に外部要因で overlay がクリアされたケースを再現
        progress.overlay = null;

        await new Promise((resolve) => setTimeout(resolve, 30));
        // ここまで例外が発生しなければOK（assertionは形式的にtrueを確認）
        expect(progress.overlay).toBeNull();
    });
});

describe('ProgressIndicator - transitionend フォールバック', () => {
    it('通常のhide()完了フローで、overlayがDOMからremoveChildされてcleanup()まで到達する', async () => {
        const progress = new ProgressIndicator();
        progress.show();
        const overlayRef = progress.overlay;
        expect(document.body.contains(overlayRef)).toBe(true);

        progress.hide(0);
        // transitionend は jsdom では発火しないため、400msのフォールバックタイマーを待つ
        await new Promise((resolve) => setTimeout(resolve, 450));

        // parentNode(document.body) から正しく removeChild されていることを確認
        expect(document.body.contains(overlayRef)).toBe(false);
        expect(progress.overlay).toBeNull();
    }, 1000);

    it('overlay が DOM から既に外れている（parentNode が null）場合でも cleanup() まで到達する', async () => {
        const progress = new ProgressIndicator();
        progress.show();

        progress.hide(0);
        // transitionend が実際には発火しない jsdom 環境を想定し、
        // フォールバックタイマー(400ms)が動く前に overlay を DOM から外しておく
        progress.overlay.remove();

        await new Promise((resolve) => setTimeout(resolve, 450));

        // cleanup() まで到達していれば overlay 等の参照がすべて null になる
        expect(progress.overlay).toBeNull();
        expect(progress.progressBar).toBeNull();
        expect(progress.transitionEndHandler).toBeNull();
    }, 1000);
});

describe('ProgressIndicator.cleanup() - transitionEndHandlerが残っている場合', () => {
    it('transitionEndHandler が設定された状態で直接 cleanup() を呼ぶと removeEventListener される', () => {
        const progress = new ProgressIndicator();
        progress.show();

        const handler = vi.fn();
        progress.transitionEndHandler = handler;
        const removeSpy = vi.spyOn(progress.overlay, 'removeEventListener');

        progress.cleanup();

        expect(removeSpy).toHaveBeenCalledWith('transitionend', handler);
        expect(progress.transitionEndHandler).toBeNull();
        expect(progress.overlay).toBeNull();
    });
});

describe('ProgressIndicator.showError() - 早期return・異常系', () => {
    it('show() を呼んでいない状態で showError() を呼んでも例外が発生しない', () => {
        const progress = new ProgressIndicator();
        expect(() => progress.showError('エラー')).not.toThrow();
    });

    it('simple-progress-container が見つからない場合は何もせず終了する', () => {
        const progress = new ProgressIndicator();
        progress.show();
        progress.overlay.querySelector('.simple-progress-container').remove();

        expect(() => progress.showError('エラー')).not.toThrow();
        // タイトルは書き換えられない（コンテナが無いため早期return）
        const title = progress.overlay.querySelector('.simple-progress-title');
        expect(title).toBeNull();
    });

    it('showError() から3秒後に自動で hide() が呼ばれる', async () => {
        vi.useFakeTimers();
        const progress = new ProgressIndicator();
        progress.show();
        const hideSpy = vi.spyOn(progress, 'hide');

        progress.showError('エラーメッセージ');
        expect(progress.statusText.textContent).toBe('エラーメッセージ');

        await vi.advanceTimersByTimeAsync(3000);

        expect(hideSpy).toHaveBeenCalledWith(0);
    });
});
