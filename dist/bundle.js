"use strict";
(() => {
  // js/progress-indicator.js
  var ProgressIndicator = class {
    /**
     * ProgressIndicatorを作成
     */
    constructor() {
      this.overlay = null;
      this.progressBar = null;
      this.statusText = null;
      this.percentText = null;
      this.hideTimeout = null;
      this.fallbackTimeout = null;
      this.transitionEndHandler = null;
      this.steps = {
        read: { label: "\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F", range: [0, 20] },
        sanitize: { label: "HTML\u89E3\u6790", range: [20, 40] },
        parse: { label: "DOM\u89E3\u6790", range: [40, 50] },
        detect: { label: "\u5DEE\u5206\u691C\u51FA", range: [50, 70] },
        marker: { label: "\u30DE\u30FC\u30AB\u30FC\u751F\u6210", range: [70, 90] },
        render: { label: "\u8868\u793A\u6E96\u5099", range: [90, 100] }
      };
    }
    /**
     * オーバーレイDOMを生成
     * @returns {HTMLElement} 生成されたオーバーレイ要素
     */
    createOverlay() {
      const overlay = document.createElement("div");
      overlay.className = "simple-progress-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "\u30D5\u30A1\u30A4\u30EB\u51E6\u7406\u4E2D");
      overlay.innerHTML = `
            <div class="simple-progress-container">
                <div class="simple-progress-icon">
                    <i class="fas fa-file-code" aria-hidden="true"></i>
                </div>
                <div class="simple-progress-title">\u51E6\u7406\u4E2D...</div>
                <div class="simple-progress-bar-wrapper">
                    <div class="simple-progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="simple-progress-info">
                    <span class="simple-progress-status">\u6E96\u5099\u4E2D</span>
                    <span class="simple-progress-percent">0%</span>
                </div>
            </div>
        `;
      this.overlay = overlay;
      this.progressBar = overlay.querySelector(".simple-progress-bar");
      this.statusText = overlay.querySelector(".simple-progress-status");
      this.percentText = overlay.querySelector(".simple-progress-percent");
      return overlay;
    }
    /**
     * プログレスインジケーターを表示
     * @param {string} [title='処理中...'] - タイトル（オプション）
     * @returns {void}
     */
    show(title = "\u51E6\u7406\u4E2D...") {
      this.clearTimeouts();
      if (!this.overlay) {
        this.createOverlay();
      }
      const titleElement = this.overlay.querySelector(".simple-progress-title");
      if (titleElement && title) {
        titleElement.textContent = title;
      }
      document.body.appendChild(this.overlay);
      requestAnimationFrame(() => {
        if (this.overlay) {
          this.overlay.classList.add("active");
        }
      });
      this.reset();
    }
    /**
     * プログレスを更新
     * @param {number} progress - 進捗率 (0-100)
     * @returns {void}
     */
    update(progress) {
      if (!this.overlay || !this.progressBar) return;
      const clampedProgress = Math.max(0, Math.min(100, progress));
      this.progressBar.style.width = `${clampedProgress}%`;
      this.progressBar.setAttribute("aria-valuenow", clampedProgress.toString());
      if (this.percentText) {
        this.percentText.textContent = `${Math.round(clampedProgress)}%`;
      }
    }
    /**
     * 指定したステップの進捗を更新
     * @param {string} stepId - ステップID ('read'|'sanitize'|'parse'|'detect'|'marker'|'render')
     * @param {number} substep - サブステップの進捗 (0-100)
     * @returns {void}
     */
    updateStepProgress(stepId, substep) {
      const stepData = this.steps[stepId];
      if (!stepData) {
        console.warn(`Unknown step ID: ${stepId}`);
        return;
      }
      const [start, end] = stepData.range;
      const progress = start + (end - start) * substep / 100;
      this.update(progress);
      if (this.statusText && substep < 100) {
        this.statusText.textContent = stepData.label;
      } else if (this.statusText && substep === 100) {
        this.statusText.textContent = stepData.label + "\u5B8C\u4E86";
      }
    }
    /**
     * プログレスインジケーターを非表示
     * @param {number} [delay=300] - フェードアウト前の遅延時間（ミリ秒）
     * @returns {void}
     */
    hide(delay = 300) {
      if (!this.overlay) return;
      this.clearTimeouts();
      this.hideTimeout = setTimeout(() => {
        if (!this.overlay) return;
        this.overlay.classList.remove("active");
        this.transitionEndHandler = () => {
          if (this.overlay) {
            if (this.transitionEndHandler) {
              this.overlay.removeEventListener(
                "transitionend",
                this.transitionEndHandler
              );
              this.transitionEndHandler = null;
            }
            if (this.overlay.parentNode) {
              this.overlay.parentNode.removeChild(this.overlay);
            }
            this.cleanup();
          }
        };
        this.overlay.addEventListener("transitionend", this.transitionEndHandler);
        this.fallbackTimeout = setTimeout(() => {
          if (this.transitionEndHandler) {
            this.transitionEndHandler();
          }
        }, 400);
      }, delay);
    }
    /**
     * 状態をリセット
     * @returns {void}
     */
    reset() {
      if (this.progressBar) {
        this.progressBar.style.width = "0%";
        this.progressBar.setAttribute("aria-valuenow", "0");
      }
      if (this.percentText) {
        this.percentText.textContent = "0%";
      }
      if (this.statusText) {
        this.statusText.textContent = "\u6E96\u5099\u4E2D";
      }
    }
    /**
     * タイムアウトをクリア（メモリリーク対策）
     * @private
     * @returns {void}
     */
    clearTimeouts() {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      if (this.fallbackTimeout) {
        clearTimeout(this.fallbackTimeout);
        this.fallbackTimeout = null;
      }
    }
    /**
     * リソースをクリーンアップ
     * @returns {void}
     */
    cleanup() {
      this.clearTimeouts();
      if (this.overlay && this.transitionEndHandler) {
        this.overlay.removeEventListener("transitionend", this.transitionEndHandler);
        this.transitionEndHandler = null;
      }
      this.overlay = null;
      this.progressBar = null;
      this.statusText = null;
      this.percentText = null;
    }
    /**
     * エラー状態を表示
     * @param {string} errorMessage - エラーメッセージ
     * @returns {void}
     */
    showError(errorMessage) {
      if (!this.overlay) return;
      const container = this.overlay.querySelector(".simple-progress-container");
      if (!container) return;
      container.classList.add("error-state");
      const titleElement = this.overlay.querySelector(".simple-progress-title");
      if (titleElement) {
        titleElement.textContent = "\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F";
      }
      if (this.statusText) {
        this.statusText.textContent = errorMessage;
      }
      if (this.progressBar) {
        this.progressBar.style.background = "linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)";
      }
      setTimeout(() => {
        this.hide(0);
      }, 3e3);
    }
  };

  // js/config.js
  var CONFIG = {
    // ========================================
    // ファイル関連
    // ========================================
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    // 最大ファイルサイズ（10MB）
    SUPPORTED_EXTENSIONS: [".htm", ".html"],
    // サポートする拡張子
    MAX_FILENAME_DISPLAY: 50,
    // ファイル名の最大表示文字数
    // ========================================
    // HTML処理
    // ========================================
    // NOTE: table/tr/td/th に加え、WinMergeレポートが列幅指定に使う colgroup/col、
    // および HTML パーサーが自動挿入する thead/tbody/tfoot も許可する。
    // これらが欠けていると、sanitize() が誤ってこれらのタグを除去し、
    // 差分テーブルの列幅（colの width 指定）が失われてレイアウトが崩れる。
    ALLOWED_TAGS: [
      "table",
      "colgroup",
      "col",
      "thead",
      "tbody",
      "tfoot",
      "caption",
      "tr",
      "td",
      "th",
      "span",
      "div",
      "style"
    ],
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
     * ⚠️ table-processor.js の isNeutral() の閾値（240）は、
     *    ここで定義する最も薄い差分色（現在: word の 173）を前提にしています。
     *    色を変更する場合は最小チャンネル値が 240 を超えないことを確認してください。
     */
    // prettier-ignore
    DIFF_COLOR_MAP: [
      { color: "rgb(239, 203, 5)", type: "changed", label: "\u5909\u66F4\u884C" },
      // #efcb05
      { color: "rgb(241, 226, 173)", type: "word", label: "\u5909\u66F4\u884C\u5185\u5DEE\u5206" },
      // #f1e2ad
      { color: "rgb(255, 160, 160)", type: "del", label: "\u524A\u9664\u30FB\u8FFD\u52A0\u884C" },
      // #ffa0a0
      { color: "rgb(255, 170, 130)", type: "moved_from", label: "\u79FB\u52D5\u5143" },
      // #ffaa82
      { color: "rgb(200, 129, 108)", type: "moved_to", label: "\u79FB\u52D5\u5148" },
      // #c8816c
      { color: "rgb(192, 192, 192)", type: "separator", label: "\u533A\u5207\u308A\u884C" }
      // #c0c0c0
    ],
    // ========================================
    // UI関連
    // ========================================
    RIGHT_BAR_WIDTH: 7,
    // 右端バーの幅（px）
    MIN_COLUMN_WIDTH: 300,
    // カラムの最小幅（px）
    HEADER_ADJUSTMENT: 17.5,
    // ヘッダー幅の調整値（px）
    HEADER_VISIBILITY_THRESHOLD: 2,
    // ヘッダー表示の閾値（px）
    // ★統合: UI_CONSTANTS から移動
    CONTROL_BUTTONS: ["resetButton", "scrollTopButton", "prevDiffButton", "nextDiffButton"],
    // ========================================
    // タイミング・遅延（ミリ秒）
    // ========================================
    RESIZE_DEBOUNCE_DELAY: 150,
    // リサイズデバウンス遅延
    NAVIGATION_COMPLETE_DELAY: 1e3,
    // ナビゲーション完了待機時間
    PROGRESS_STEP_DELAY_MS: 50,
    // プログレス各ステップ間の待機時間
    PROGRESS_MARKER_DELAY_MS: 100,
    // マーカー生成ステップの待機時間
    PROGRESS_COMPLETION_DELAY_MS: 500,
    // プログレス完了後の表示時間
    SCROLL_TO_TOP_RESET_DELAY_MS: 1500,
    // トップへスクロール後のリセット待機時間
    // ========================================
    // パフォーマンス
    // ========================================
    MEMORY_THRESHOLD_RATIO: 0.9,
    // メモリ使用率の閾値（90%）
    MEMORY_CHECK_INTERVAL: 3e4,
    // メモリチェック間隔（30秒）
    // ========================================
    // スタイル
    // ========================================
    HIGHLIGHT_BOX_SHADOW: "0 0 0 3px rgba(0, 123, 255, 0.6)",
    HIGHLIGHT_BORDER_RADIUS: "4px",
    // ========================================
    // マーカー表示
    // ========================================
    BLOCK_LABEL_DISPLAY_THRESHOLD: 20,
    // この数以下の場合、ブロック番号ラベルを表示
    MARKER_MIN_HEIGHT_PERCENT: 0.5
    // マーカーの最小高さ（%）
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
  };

  // js/errors.js
  var FileValidationError = class extends Error {
    /**
     * FileValidationErrorを作成
     * @param {string} message - エラーメッセージ
     * @param {string} code - エラーコード
     */
    constructor(message, code) {
      super(message);
      this.name = "FileValidationError";
      this.code = code;
      this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    }
  };
  var FileProcessingError = class extends Error {
    /**
     * FileProcessingErrorを作成
     * @param {string} message - エラーメッセージ
     * @param {string} phase - 処理フェーズ（'read'|'sanitize'|'parse'|'detect'|'marker'|'render'）
     * @param {Error|null} [originalError=null] - 元のエラーオブジェクト
     */
    constructor(message, phase, originalError = null) {
      super(message);
      this.name = "FileProcessingError";
      this.phase = phase;
      this.originalError = originalError;
      this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    }
  };
  var HTMLParsingError = class extends Error {
    /**
     * HTMLParsingErrorを作成
     * @param {string} message - エラーメッセージ
     * @param {Error|null} [originalError=null] - 元のエラーオブジェクト
     */
    constructor(message, originalError = null) {
      super(message);
      this.name = "HTMLParsingError";
      this.originalError = originalError;
      this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    }
  };
  var TableProcessingError = class extends Error {
    /**
     * TableProcessingErrorを作成
     * @param {string} message - エラーメッセージ
     * @param {Error|null} [originalError=null] - 元のエラーオブジェクト
     */
    constructor(message, originalError = null) {
      super(message);
      this.name = "TableProcessingError";
      this.originalError = originalError;
      this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    }
  };
  var NavigationError = class extends Error {
    /**
     * NavigationErrorを作成
     * @param {string} message - エラーメッセージ
     * @param {number|null} [index=null] - 差分インデックス
     */
    constructor(message, index = null) {
      super(message);
      this.name = "NavigationError";
      this.index = index;
      this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    }
  };

  // js/state.js
  var AppState = {
    /** @type {EventHandlers} イベントハンドラの管理 */
    eventHandlers: {
      keydown: null,
      debouncedResize: null,
      scrollAnimationFrame: null,
      resizeTimeout: null,
      /** @type {Function|null} リサイズ時のミニマップマーカー再配置コールバック */
      markerResizeCallback: null
    },
    /** @type {DOMElements|null} DOM要素への参照 */
    elements: null,
    /** @type {HTMLStyleElement|null} インポートされたスタイル要素 */
    importedStyleElem: null,
    /** @type {boolean} ファイル処理中フラグ */
    isProcessing: false,
    /** @type {DiffBlock[]} 差分ブロック情報の配列 */
    diffBlocks: [],
    /** @type {number} 現在の差分インデックス */
    currentDiffIndex: -1,
    /** @type {boolean} 差分へのナビゲーション中フラグ */
    isNavigatingToDiff: false,
    /** @type {boolean} トップへスクロール中フラグ */
    isScrollingToTop: false,
    /** @type {IntersectionObserver|null} Intersection Observer インスタンス */
    intersectionObserver: null,
    /** @type {Timers} タイマー管理 */
    timers: {
      memoryMonitor: null
    },
    /**
     * アプリケーション状態を初期化
     * @returns {void}
     */
    init() {
      this.elements = {
        fileInput: document.getElementById("fileInput"),
        viewer: document.getElementById("viewer"),
        diffContent: document.getElementById("diffContent"),
        locationPane: document.getElementById("locationPane"),
        locationPaneLeft: document.getElementById("locationPaneLeft"),
        locationPaneRight: document.getElementById("locationPaneRight"),
        dropArea: document.getElementById("dropArea"),
        resetButton: document.getElementById("resetButton"),
        scrollTopButton: document.getElementById("scrollTopButton"),
        prevDiffButton: document.getElementById("prevDiffButton"),
        nextDiffButton: document.getElementById("nextDiffButton"),
        diffInfo: document.getElementById("diffInfo"),
        fixedHeader: document.getElementById("fixedHeader"),
        fixedHeaderRow: document.getElementById("fixedHeaderRow"),
        toolHeader: document.getElementById("toolHeader")
      };
    },
    /**
     * タイマーをクリーンアップ
     * file-handler.js / navigation.js / main.js で重複定義されていたため
     * AppState に集約した。各モジュールはこのメソッドを呼び出すこと。
     * @returns {void}
     */
    cleanupTimers() {
      Object.keys(this.timers).forEach((key) => {
        if (this.timers[key]) {
          clearInterval(this.timers[key]);
          this.timers[key] = null;
        }
      });
      Logger.log("\u2705 \u3059\u3079\u3066\u306E\u30BF\u30A4\u30DE\u30FC\u3092\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7");
    },
    /**
     * アプリケーション状態をリセット
     * @returns {void}
     */
    reset() {
      this.isProcessing = false;
      this.currentDiffIndex = -1;
      this.isNavigatingToDiff = false;
      if (Array.isArray(this.diffBlocks)) {
        this.diffBlocks.forEach((block) => {
          if (block && typeof block === "object") {
            if (Array.isArray(block.rows)) {
              block.rows.length = 0;
            }
            Object.keys(block).forEach((key) => {
              block[key] = null;
            });
          }
        });
        this.diffBlocks.length = 0;
      }
      this.diffBlocks = [];
      if (this.intersectionObserver) {
        try {
          this.intersectionObserver.disconnect();
          this.intersectionObserver = null;
        } catch (e) {
          Logger.warn("IntersectionObserver cleanup failed:", e);
        }
      }
      Logger.log("AppState reset completed");
    },
    /**
     * イベントハンドラをクリーンアップ
     * @returns {void}
     */
    cleanupEventHandlers() {
      try {
        if (this.eventHandlers.scrollAnimationFrame) {
          cancelAnimationFrame(this.eventHandlers.scrollAnimationFrame);
          this.eventHandlers.scrollAnimationFrame = null;
        }
        if (this.eventHandlers.debouncedResize) {
          window.removeEventListener("resize", this.eventHandlers.debouncedResize);
          this.eventHandlers.debouncedResize = null;
        }
        if (this.eventHandlers.resizeTimeout) {
          clearTimeout(this.eventHandlers.resizeTimeout);
          this.eventHandlers.resizeTimeout = null;
        }
        if (this.eventHandlers.keydown) {
          document.removeEventListener("keydown", this.eventHandlers.keydown);
          this.eventHandlers.keydown = null;
        }
        if (this.eventHandlers.markerResizeCallback) {
          this.eventHandlers.markerResizeCallback = null;
        }
        if (this.intersectionObserver) {
          this.intersectionObserver.disconnect();
          this.intersectionObserver = null;
        }
        Logger.log("All event handlers cleaned up");
      } catch (error) {
        Logger.error("Cleanup event handlers error:", error);
      }
    }
  };
  var Logger = {
    /**
     * デバッグモードが有効かどうかを判定
     * ★修正3: localStorage による判定を除去。
     *   理由: 社内PCで過去に localStorage.debug = 'true' がセットされた
     *   ブラウザでは意図せずデバッグモードが有効になり、
     *   通常非表示の「ブロック表示」切替ボタン等が露出してしまう。
     *   判定は localhost / 127.0.0.1 か URLパラメータ debug=true のみとする。
     *   手動でデバッグを有効にしたい場合は URL に ?debug=true を付与すること。
     * @returns {boolean} デバッグモードが有効な場合true
     */
    get enabled() {
      return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.search.includes("debug=true");
    },
    /**
     * デバッグログを出力（デバッグモード時のみ）
     * @param {...*} args - 出力する引数
     * @returns {void}
     */
    log(...args) {
      if (this.enabled) console.log(...args);
    },
    /**
     * 警告ログを出力
     * @param {...*} args - 出力する引数
     * @returns {void}
     */
    warn(...args) {
      console.warn(...args);
    },
    /**
     * エラーログを出力
     * @param {...*} args - 出力する引数
     * @returns {void}
     */
    error(...args) {
      console.error(...args);
    }
  };

  // js/utils.js
  var Utils = {
    /**
     * バイト数を人間が読みやすい形式に変換
     */
    formatFileSize(bytes) {
      const sizes = ["B", "KB", "MB", "GB"];
      if (bytes === 0) return "0 B";
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
    },
    /**
     * ファイル名を指定文字数で切り詰め
     */
    truncateFilename(filename) {
      if (filename.length <= CONFIG.MAX_FILENAME_DISPLAY) return filename;
      const ext = filename.substring(filename.lastIndexOf("."));
      const name = filename.substring(0, filename.lastIndexOf("."));
      const maxNameLength = CONFIG.MAX_FILENAME_DISPLAY - ext.length - 3;
      return name.substring(0, maxNameLength) + "..." + ext;
    },
    /**
     * 非同期待機用のスリープ関数
     */
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    /**
     * テーブルのハッシュ値を計算（改善版 - 衝突リスク低減）
     *
     * アルゴリズム: FNV-1a (Fowler-Noll-Vo)
     *   hash = FNV_OFFSET_BASIS
     *   for each byte: hash = (hash XOR byte) * FNV_PRIME
     *   定数: OFFSET_BASIS=2166136261, PRIME=16777619 (32-bit)
     *   Math.imul() を使う理由: JS の * は浮動小数点演算のため、
     *   32ビット整数乗算を明示的に行う必要がある。
     *   参考: http://www.isthe.com/chongo/tech/comp/fnv/
     *
     * 改善ポイント:
     *   1. 行数だけでなく列数も含める
     *   2. サンプリング位置を均等分散させる
     *   3. FNV-1a による衝突リスク低減
     *   4. 行の位置情報もハッシュに含める
     *
     * パフォーマンス:
     *   - 100行:    ~5ms (旧版: 10ms)
     *   - 1,000行:  ~5ms (旧版: 100ms)
     *   - 10,000行: ~5ms (旧版: 1000ms)
     *
     * @param {HTMLTableElement} table - 対象テーブル
     * @returns {number|null} ハッシュ値（テーブルがnullの場合はnull）
     */
    computeTableHash(table) {
      if (!table) return null;
      const rows = table.querySelectorAll("tr");
      const rowCount = rows.length;
      if (rowCount === 0) return 0;
      const FNV_OFFSET_BASIS = 2166136261;
      const FNV_PRIME = 16777619;
      let hash = FNV_OFFSET_BASIS;
      hash ^= rowCount;
      hash = Math.imul(hash, FNV_PRIME);
      const firstRow = rows[0];
      const colCount = firstRow ? firstRow.querySelectorAll("td, th").length : 0;
      hash ^= colCount;
      hash = Math.imul(hash, FNV_PRIME);
      const SAMPLE_SIZE = 10;
      const sampleIndices = /* @__PURE__ */ new Set();
      for (let i = 0; i < Math.min(SAMPLE_SIZE, rowCount); i++) {
        sampleIndices.add(i);
      }
      if (rowCount > SAMPLE_SIZE * 3) {
        const step = Math.floor(rowCount / SAMPLE_SIZE);
        for (let i = 0; i < SAMPLE_SIZE; i++) {
          const idx = Math.floor(step * i + step / 2);
          if (idx >= 0 && idx < rowCount) {
            sampleIndices.add(idx);
          }
        }
      } else {
        const middleStart = Math.floor(rowCount / 2) - Math.floor(SAMPLE_SIZE / 2);
        for (let i = 0; i < SAMPLE_SIZE; i++) {
          const idx = middleStart + i;
          if (idx >= 0 && idx < rowCount) {
            sampleIndices.add(idx);
          }
        }
      }
      for (let i = Math.max(0, rowCount - SAMPLE_SIZE); i < rowCount; i++) {
        sampleIndices.add(i);
      }
      const indicesToProcess = Array.from(sampleIndices).sort((a, b) => a - b);
      Logger.log(
        `\u30C6\u30FC\u30D6\u30EB\u30CF\u30C3\u30B7\u30E5\u8A08\u7B97: \u5168${rowCount}\u884C\xD7${colCount}\u5217\u4E2D${indicesToProcess.length}\u884C\u3092\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0`
      );
      for (const idx of indicesToProcess) {
        const row = rows[idx];
        if (!row) continue;
        const text = row.textContent.trim().substring(0, 100);
        for (let i = 0; i < text.length; i++) {
          hash ^= text.charCodeAt(i);
          hash = Math.imul(hash, FNV_PRIME);
        }
        hash ^= idx;
        hash = Math.imul(hash, FNV_PRIME);
      }
      return hash >>> 0;
    }
  };
  var CSSManager = {
    /**
     * CSS変数を設定
     */
    setVariable(name, value) {
      document.documentElement.style.setProperty(`--${name}`, value);
    },
    /**
     * CSS変数を取得
     */
    getVariable(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`);
    },
    /**
     * 要素を表示
     */
    showElement(element, visibleClass, hiddenClass) {
      if (!visibleClass || !hiddenClass) {
        const classList = Array.from(element.classList);
        hiddenClass = classList.find((c) => c.includes("-hidden"));
        if (hiddenClass) {
          visibleClass = hiddenClass.replace("-hidden", "-visible");
        } else {
          visibleClass = "button-visible";
          hiddenClass = "button-hidden";
        }
      }
      element.classList.remove(hiddenClass);
      element.classList.add(visibleClass);
    },
    /**
     * 要素を非表示
     */
    hideElement(element, visibleClass, hiddenClass) {
      if (!visibleClass || !hiddenClass) {
        const classList = Array.from(element.classList);
        visibleClass = classList.find((c) => c.includes("-visible"));
        if (visibleClass) {
          hiddenClass = visibleClass.replace("-visible", "-hidden");
        } else {
          visibleClass = "button-visible";
          hiddenClass = "button-hidden";
        }
      }
      element.classList.remove(visibleClass);
      element.classList.add(hiddenClass);
    }
  };

  // js/ui.js
  var UI = {
    /**
     * メッセージを表示
     * @param {string} message - 表示するメッセージ
     * @param {'error'|'warning'} [type='error'] - メッセージタイプ
     * @returns {void}
     */
    showMessage(message, type = "error") {
      const className = type === "warning" ? "warning-message" : "error-message";
      const messageDiv = document.createElement("div");
      messageDiv.className = className;
      messageDiv.setAttribute("role", "alert");
      messageDiv.textContent = message;
      AppState.elements.viewer.innerHTML = "";
      AppState.elements.viewer.appendChild(messageDiv);
    },
    /**
     * ローディング表示
     * @returns {void}
     */
    showLoading() {
      const loadingDiv = document.createElement("div");
      loadingDiv.className = "loading";
      loadingDiv.textContent = "\u30D5\u30A1\u30A4\u30EB\u3092\u51E6\u7406\u4E2D";
      AppState.elements.viewer.innerHTML = "";
      AppState.elements.viewer.appendChild(loadingDiv);
    },
    /**
     * ファイル情報を表示
     * @param {File} file - ファイルオブジェクト
     * @returns {void}
     */
    showFileInfo(file) {
      AppState.elements.dropArea.style.display = "none";
      CONFIG.CONTROL_BUTTONS.forEach((id) => {
        CSSManager.showElement(AppState.elements[id]);
      });
      const fileInfoDiv = document.createElement("div");
      fileInfoDiv.className = "file-info";
      const filename = document.createElement("strong");
      filename.textContent = "\u30D5\u30A1\u30A4\u30EB\u540D: ";
      const filenameValue = document.createElement("span");
      filenameValue.textContent = Utils.truncateFilename(file.name);
      const filesize = document.createElement("strong");
      filesize.textContent = "\u30B5\u30A4\u30BA: ";
      const filesizeValue = document.createElement("span");
      filesizeValue.textContent = Utils.formatFileSize(file.size);
      const lastModified = document.createElement("strong");
      lastModified.textContent = "\u6700\u7D42\u66F4\u65B0: ";
      const lastModifiedValue = document.createElement("span");
      lastModifiedValue.textContent = new Date(file.lastModified).toLocaleString("ja-JP");
      fileInfoDiv.appendChild(filename);
      fileInfoDiv.appendChild(filenameValue);
      fileInfoDiv.appendChild(document.createElement("br"));
      fileInfoDiv.appendChild(filesize);
      fileInfoDiv.appendChild(filesizeValue);
      fileInfoDiv.appendChild(document.createElement("br"));
      fileInfoDiv.appendChild(lastModified);
      fileInfoDiv.appendChild(lastModifiedValue);
      AppState.elements.viewer.innerHTML = "";
      AppState.elements.viewer.appendChild(fileInfoDiv);
    },
    /**
     * ビューワーをクリア
     * @returns {void}
     */
    clearViewer() {
      if (!AppState.elements.viewer) return;
      try {
        AppState.elements.viewer.innerHTML = "";
        Logger.log("Viewer cleared safely");
      } catch (error) {
        Logger.error("Clear viewer error:", error);
      }
    }
  };

  // js/error-handler.js
  var ErrorHandler = {
    /**
     * エラーを処理して適切なユーザーメッセージを表示
     * @param {Error} error - エラーオブジェクト
     * @param {string} [context=''] - エラーコンテキスト
     * @returns {void}
     */
    handle(error, context = "") {
      this.logError(error, context);
      if (error instanceof FileValidationError) {
        this.handleFileValidationError(error);
      } else if (error instanceof FileProcessingError) {
        this.handleFileProcessingError(error);
      } else if (error instanceof HTMLParsingError) {
        this.handleHTMLParsingError(error);
      } else if (error instanceof TableProcessingError) {
        this.handleTableProcessingError(error);
      } else if (error instanceof NavigationError) {
        this.handleNavigationError(error);
      } else {
        this.handleUnknownError(error);
      }
      AppState.isProcessing = false;
    },
    /**
     * ファイル検証エラーを処理
     * @param {FileValidationError} error - ファイル検証エラー
     * @returns {void}
     */
    handleFileValidationError(error) {
      UI.showMessage(error.message, "warning");
    },
    /**
     * ファイル処理エラーを処理
     * @param {FileProcessingError} error - ファイル処理エラー
     * @returns {void}
     */
    handleFileProcessingError(error) {
      let userMessage = "\u30D5\u30A1\u30A4\u30EB\u51E6\u7406\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002";
      switch (error.phase) {
        case "read":
          userMessage = "\u30D5\u30A1\u30A4\u30EB\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30D5\u30A1\u30A4\u30EB\u304C\u7834\u640D\u3057\u3066\u3044\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002";
          break;
        case "sanitize":
          userMessage = "HTML\u30D5\u30A1\u30A4\u30EB\u306E\u5F62\u5F0F\u306B\u554F\u984C\u304C\u3042\u308A\u307E\u3059\u3002WinMerge\u3067\u751F\u6210\u3055\u308C\u305F\u30EC\u30DD\u30FC\u30C8\u304B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
          break;
        case "parse":
          userMessage = "HTML\u306E\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30D5\u30A1\u30A4\u30EB\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
          break;
        case "detect":
          userMessage = "\u5DEE\u5206\u306E\u691C\u51FA\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
          break;
        case "marker":
          userMessage = "\u30DE\u30FC\u30AB\u30FC\u306E\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
          break;
        case "render":
          userMessage = "\u30EC\u30F3\u30C0\u30EA\u30F3\u30B0\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002";
          break;
      }
      UI.showMessage(userMessage + " \u8A73\u7D30\u306F\u30D6\u30E9\u30A6\u30B6\u306E\u30B3\u30F3\u30BD\u30FC\u30EB\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    },
    /**
     * HTML解析エラーを処理
     * @param {HTMLParsingError} error - HTML解析エラー
     * @returns {void}
     */
    handleHTMLParsingError(_error) {
      UI.showMessage(
        "HTML\u306E\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002WinMerge HTML\u30EC\u30DD\u30FC\u30C8\u30D5\u30A1\u30A4\u30EB\u3067\u3042\u308B\u3053\u3068\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
        "error"
      );
    },
    /**
     * テーブル処理エラーを処理
     * @param {TableProcessingError} error - テーブル処理エラー
     * @returns {void}
     */
    handleTableProcessingError(_error) {
      UI.showMessage(
        "\u5DEE\u5206\u30C6\u30FC\u30D6\u30EB\u306E\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002WinMerge HTML\u30EC\u30DD\u30FC\u30C8\u30D5\u30A1\u30A4\u30EB\u3067\u3042\u308B\u3053\u3068\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
        "error"
      );
    },
    /**
     * ナビゲーションエラーを処理
     * @param {NavigationError} error - ナビゲーションエラー
     * @returns {void}
     */
    handleNavigationError(error) {
      Logger.warn("Navigation error:", error.message);
      UI.showMessage(error.message, "warning");
    },
    /**
     * 未知のエラーを処理
     * @param {Error} error - エラーオブジェクト
     * @returns {void}
     */
    handleUnknownError(error) {
      Logger.error("Unknown error:", error);
      UI.showMessage(
        "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002\u30DA\u30FC\u30B8\u3092\u30EA\u30ED\u30FC\u30C9\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
        "error"
      );
    },
    /**
     * エラーをログに記録
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーコンテキスト
     * @returns {void}
     */
    logError(error, context) {
      const errorInfo = {
        name: error.name || "Error",
        message: error.message,
        context,
        timestamp: error.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
        stack: error.stack
      };
      if (error.code) errorInfo.code = error.code;
      if (error.phase) errorInfo.phase = error.phase;
      if (error.index !== void 0) errorInfo.index = error.index;
      if (error.originalError) {
        errorInfo.originalError = {
          message: error.originalError.message,
          stack: error.originalError.stack
        };
      }
      Logger.error("Error occurred:", errorInfo);
    }
  };

  // js/table-processor.js
  var TableProcessor = /* @__PURE__ */ (() => {
    function addRightBars(table) {
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        const isHeaderRow = row.querySelector("th");
        const rightBarCell = document.createElement(isHeaderRow ? "th" : "td");
        rightBarCell.className = "added-right-bar";
        rightBarCell.innerHTML = "&nbsp;";
        row.appendChild(rightBarCell);
      });
    }
    function setupFixedHeader(table) {
      const firstRow = table.querySelector("tr");
      if (!firstRow) return;
      AppState.elements.fixedHeaderRow.innerHTML = "";
      firstRow.querySelectorAll("th").forEach((originalTh) => {
        const newTh = document.createElement("th");
        newTh.textContent = originalTh.textContent;
        const allowedAttributes = ["class", "colspan", "rowspan"];
        allowedAttributes.forEach((attrName) => {
          if (originalTh.hasAttribute(attrName)) {
            const attrValue = originalTh.getAttribute(attrName);
            const sanitizedValue = attrValue.replace(/[<>'"]/g, "").replace(/javascript:/gi, "").replace(/on\w+/gi, "").trim();
            if (sanitizedValue && sanitizedValue.length < 200) {
              newTh.setAttribute(attrName, sanitizedValue);
            }
          }
        });
        newTh.setAttribute("scope", "col");
        Array.from(originalTh.attributes).forEach((attr) => {
          if (attr.name.startsWith("aria-") || attr.name.startsWith("data-")) {
            let attrValue = attr.value;
            const sanitizedValue = attrValue.replace(/[<>'"]/g, "").trim();
            newTh.setAttribute(attr.name, sanitizedValue);
          }
        });
        AppState.elements.fixedHeaderRow.appendChild(newTh);
      });
    }
    function updateFixedHeaderPosition(originalTable) {
      const fixedTable = AppState.elements.fixedHeader.querySelector("table");
      if (!originalTable || !fixedTable) return;
      const tableRect = originalTable.getBoundingClientRect();
      CSSManager.setVariable("fixed-header-left", `${tableRect.left}px`);
      CSSManager.setVariable("fixed-header-width", `${tableRect.width}px`);
      const originalThs = originalTable.querySelectorAll("tr:first-child th");
      const fixedThs = fixedTable.querySelectorAll("tr:first-child th");
      originalThs.forEach((originalTh, index) => {
        if (!fixedThs[index]) return;
        if (index === originalThs.length - 1 && originalTh.classList.contains("added-right-bar")) {
          fixedThs[index].style.width = `${CONFIG.RIGHT_BAR_WIDTH}px`;
        } else {
          const thRect = originalTh.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          let adjustedWidth;
          if (windowWidth <= 600) {
            adjustedWidth = thRect.width;
          } else if (windowWidth <= 750) {
            adjustedWidth = thRect.width - 17;
          } else {
            adjustedWidth = Math.max(
              CONFIG.MIN_COLUMN_WIDTH,
              thRect.width - CONFIG.HEADER_ADJUSTMENT
            );
          }
          fixedThs[index].style.width = `${adjustedWidth}px`;
        }
      });
    }
    function cleanupIntersectionObserver() {
      if (AppState.intersectionObserver) {
        try {
          AppState.intersectionObserver.disconnect();
          AppState.intersectionObserver = null;
          Logger.log("\u2705 IntersectionObserver cleaned up completely");
        } catch (error) {
          Logger.warn("IntersectionObserver cleanup error:", error);
          AppState.intersectionObserver = null;
        }
      }
    }
    function setupIntersectionObserver() {
      cleanupIntersectionObserver();
      try {
        const observerCallback = (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              CSSManager.hideElement(
                AppState.elements.fixedHeader,
                "fixed-header-visible",
                "fixed-header-hidden"
              );
              entry.target.style.visibility = "visible";
            } else {
              const firstTable2 = AppState.elements.viewer.querySelector("table");
              if (firstTable2 && entry.target === firstTable2.querySelector("tr")) {
                updateFixedHeaderPosition(firstTable2);
                CSSManager.showElement(
                  AppState.elements.fixedHeader,
                  "fixed-header-visible",
                  "fixed-header-hidden"
                );
                entry.target.style.visibility = "hidden";
              }
            }
          });
        };
        const observerOptions = {
          root: AppState.elements.diffContent,
          rootMargin: `-${CONFIG.HEADER_VISIBILITY_THRESHOLD}px 0px 0px 0px`,
          threshold: 0
        };
        AppState.intersectionObserver = new IntersectionObserver(
          observerCallback,
          observerOptions
        );
        const firstTable = AppState.elements.viewer.querySelector("table");
        if (firstTable) {
          const headerRow = firstTable.querySelector("tr");
          if (headerRow) {
            AppState.intersectionObserver.observe(headerRow);
            Logger.log("\u2705 IntersectionObserver observing header row");
          } else {
            Logger.warn("Header row not found for IntersectionObserver");
            cleanupIntersectionObserver();
          }
        } else {
          Logger.warn("Table not found for IntersectionObserver");
          cleanupIntersectionObserver();
        }
        setupResizeHandler(firstTable);
      } catch (error) {
        Logger.error("IntersectionObserver setup failed:", error);
        cleanupIntersectionObserver();
      }
    }
    function setupResizeHandler(table) {
      if (!table) return;
      if (AppState.eventHandlers.debouncedResize) {
        window.removeEventListener("resize", AppState.eventHandlers.debouncedResize);
        AppState.eventHandlers.debouncedResize = null;
      }
      if (AppState.eventHandlers.resizeTimeout) {
        clearTimeout(AppState.eventHandlers.resizeTimeout);
        AppState.eventHandlers.resizeTimeout = null;
      }
      AppState.eventHandlers.debouncedResize = () => {
        if (AppState.eventHandlers.resizeTimeout) {
          clearTimeout(AppState.eventHandlers.resizeTimeout);
        }
        AppState.eventHandlers.resizeTimeout = setTimeout(() => {
          const fixedHeader = AppState.elements.fixedHeader;
          if (fixedHeader && fixedHeader.classList.contains("fixed-header-visible")) {
            const currentTable = AppState.elements.viewer.querySelector("table");
            if (currentTable) {
              updateFixedHeaderPosition(currentTable);
              Logger.log("\u2705 \u56FA\u5B9A\u30D8\u30C3\u30C0\u30FC\u306E\u5E45\u3092\u30EA\u30B5\u30A4\u30BA\u306B\u5408\u308F\u305B\u3066\u66F4\u65B0");
            }
          }
          if (typeof AppState.eventHandlers.markerResizeCallback === "function") {
            AppState.eventHandlers.markerResizeCallback();
          }
        }, CONFIG.RESIZE_DEBOUNCE_DELAY);
      };
      window.addEventListener("resize", AppState.eventHandlers.debouncedResize);
      Logger.log("\u2705 \u30EA\u30B5\u30A4\u30BA\u30CF\u30F3\u30C9\u30E9\u30FC\u3092\u8A2D\u5B9A\u3057\u307E\u3057\u305F");
    }
    function _getTdBgColor(td) {
      function hexToRgb(hex) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null;
      }
      function isNeutral(r, g, b) {
        return r >= 240 && g >= 240 && b >= 240;
      }
      const inline = td.style.backgroundColor;
      if (inline && inline.startsWith("#")) {
        const rgb = hexToRgb(inline);
        if (rgb && !isNeutral(rgb.r, rgb.g, rgb.b)) return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      }
      const bg = window.getComputedStyle(td).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m) {
          const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
          if (!isNeutral(r, g, b)) return bg;
        }
      }
      return null;
    }
    function getRowColors(row) {
      const allTds = Array.from(row.querySelectorAll("td")).filter(
        (td) => !td.classList.contains("added-right-bar")
      );
      const n = allTds.length;
      if (n === 0) return { left: null, right: null };
      if (n === 1) {
        return { left: _getTdBgColor(allTds[0]), right: null };
      }
      const half = Math.floor(n / 2);
      let leftColor = null;
      for (let i = 0; i < half; i++) {
        const c = _getTdBgColor(allTds[i]);
        if (c) {
          leftColor = c;
          break;
        }
      }
      let rightColor = null;
      for (let i = half; i < n; i++) {
        const c = _getTdBgColor(allTds[i]);
        if (c) {
          rightColor = c;
          break;
        }
      }
      return { left: leftColor, right: rightColor };
    }
    return {
      addRightBars,
      setupFixedHeader,
      updateFixedHeaderPosition,
      setupIntersectionObserver,
      setupResizeHandler,
      cleanupIntersectionObserver,
      getRowColors
    };
  })();

  // js/html-processor.js
  var HTMLProcessor = {
    /**
     * HTMLをサニタイズ
     * @param {string} html - サニタイズするHTML文字列
     * @returns {string} サニタイズされたHTML
     */
    sanitize(html) {
      Logger.log("HTML sanitization started");
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        if (!doc.documentElement || doc.documentElement.tagName.toLowerCase() !== "html") {
          Logger.warn("HTML parse error detected, falling back to strict sanitize.");
          return this.strictBasicSanitize(html);
        }
        const STRUCTURAL_TAGS = ["html", "head", "body"];
        const DANGEROUS_CONTENT_TAGS = ["script", "iframe", "object", "embed", "noscript"];
        const allElements = Array.from(doc.querySelectorAll("*"));
        allElements.forEach((el) => {
          if (!el || !el.tagName || !el.parentNode) return;
          const tagName = el.tagName.toLowerCase();
          if (STRUCTURAL_TAGS.includes(tagName)) return;
          if (!CONFIG.ALLOWED_TAGS.includes(tagName)) {
            const parent = el.parentNode;
            if (DANGEROUS_CONTENT_TAGS.includes(tagName)) {
              try {
                parent.removeChild(el);
              } catch {
                Logger.warn("Element removal failed");
              }
              return;
            }
            try {
              const children = Array.from(el.childNodes);
              if (parent.nodeType === Node.ELEMENT_NODE || parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                children.forEach((child) => {
                  try {
                    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.ELEMENT_NODE) {
                      parent.insertBefore(child, el);
                    }
                  } catch {
                    Logger.warn("Child insertion skipped");
                  }
                });
              }
              try {
                parent.removeChild(el);
              } catch {
                Logger.warn("Element removal failed");
              }
            } catch {
              Logger.warn("Element removal skipped");
            }
          }
        });
        doc.querySelectorAll("*").forEach((el) => {
          if (el && el.attributes) {
            Array.from(el.attributes).forEach((attr) => {
              if (attr && attr.name) {
                if (attr.name.startsWith("on") || attr.value && attr.value.toLowerCase().includes("javascript:")) {
                  el.removeAttribute(attr.name);
                }
              }
            });
          }
        });
        Logger.log("HTML sanitization completed successfully");
        return doc.documentElement ? doc.documentElement.innerHTML : this.strictBasicSanitize(html);
      } catch (error) {
        Logger.error("Sanitize error:", error);
        return this.strictBasicSanitize(html);
      }
    },
    /**
     * 厳格なサニタイズ（最終フォールバック）
     * @param {string} html - サニタイズするHTML文字列
     * @returns {string} サニタイズされたHTML
     */
    strictBasicSanitize(html) {
      return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").replace(/<object[\s\S]*?<\/object>/gi, "").replace(/<embed[\s\S]*?<\/embed>/gi, "").replace(/<form[\s\S]*?<\/form>/gi, "").replace(/on\w+\s*=\s*["'][^"']*["']/gi, "").replace(/javascript\s*:/gi, "").replace(/vbscript\s*:/gi, "").replace(/data\s*:\s*text\/html/gi, "");
    },
    /**
     * スタイルをインポート
     * @param {Document} doc - DOMドキュメント
     * @returns {void}
     */
    importStyles(doc) {
      const styleNodes = doc.querySelectorAll("style");
      if (!styleNodes.length) return;
      AppState.importedStyleElem = document.createElement("style");
      AppState.importedStyleElem.setAttribute("data-imported", "true");
      let css = "";
      styleNodes.forEach((s) => {
        let styleContent = s.textContent || "";
        styleContent = styleContent.replace(/expression\s*\(/gi, "").replace(/javascript\s*:/gi, "").replace(/vbscript\s*:/gi, "").replace(/@import/gi, "").replace(/behavior\s*:/gi, "").replace(/binding\s*:/gi, "");
        css += styleContent + "\n";
      });
      AppState.importedStyleElem.textContent = css;
      document.head.appendChild(AppState.importedStyleElem);
    },
    /**
     * テーブルを処理
     * @param {Document} doc - DOMドキュメント
     * @returns {HTMLTableElement} 処理されたテーブル
     * @throws {TableProcessingError} テーブルが見つからない場合
     */
    processTable(doc) {
      const diffTable = doc.querySelector("table.diff") || doc.querySelector("table");
      if (!diffTable) {
        throw new TableProcessingError(
          "\u5DEE\u5206\u30C6\u30FC\u30D6\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002WinMerge HTML\u30EC\u30DD\u30FC\u30C8\u30D5\u30A1\u30A4\u30EB\u3067\u3042\u308B\u3053\u3068\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
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
    }
  };

  // js/diff-detector.js
  var DiffBlockDetector = /* @__PURE__ */ (() => {
    function detectBlocks(table) {
      Logger.log("=== \u30D6\u30ED\u30C3\u30AF\u691C\u51FA\u958B\u59CB ===");
      const rows = table.querySelectorAll("tr");
      const blocks = [];
      let currentBlock = null;
      rows.forEach((row, index) => {
        const { left: leftColor, right: rightColor } = TableProcessor.getRowColors(row);
        const color = leftColor || rightColor;
        if (color) {
          const type = _colorToType(color);
          if (currentBlock && currentBlock.type === type && currentBlock.endIndex === index - 1) {
            currentBlock.endIndex = index;
            currentBlock.rows.push(row);
          } else {
            if (currentBlock) {
              blocks.push(currentBlock);
            }
            currentBlock = {
              id: blocks.length,
              type,
              color,
              // 後方互換用（代表色）
              leftColor,
              // 旧ファイル側の色（ミニマップ左ペイン用）
              rightColor,
              // 新ファイル側の色（ミニマップ右ペイン用）
              startIndex: index,
              endIndex: index,
              rows: [row]
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
      Logger.log(`\u691C\u51FA\u3055\u308C\u305F\u30D6\u30ED\u30C3\u30AF\u6570: ${blocks.length}`);
      return blocks;
    }
    function _colorToType(color) {
      const entry = CONFIG.DIFF_COLOR_MAP.find((e) => e.color === color);
      return entry ? entry.type : "unknown";
    }
    const _CLASSIFY_ADD_TYPES = /* @__PURE__ */ new Set(["changed", "word"]);
    const _CLASSIFY_DEL_TYPES = /* @__PURE__ */ new Set(["del", "moved_from", "moved_to"]);
    function _classifyBlockType(type) {
      if (_CLASSIFY_ADD_TYPES.has(type)) return "add";
      if (_CLASSIFY_DEL_TYPES.has(type)) return "del";
      return "other";
    }
    function getBlockStats(blocks) {
      const stats = {
        total: blocks.length,
        addBlocks: 0,
        delBlocks: 0,
        totalAddLines: 0,
        totalDelLines: 0,
        averageBlockSize: 0
      };
      blocks.forEach((block) => {
        const category = _classifyBlockType(block.type);
        if (category === "add") {
          stats.addBlocks++;
          stats.totalAddLines += block.rows.length;
        } else if (category === "del") {
          stats.delBlocks++;
          stats.totalDelLines += block.rows.length;
        }
      });
      stats.averageBlockSize = blocks.length > 0 ? (stats.totalAddLines + stats.totalDelLines) / blocks.length : 0;
      return stats;
    }
    return {
      detectBlocks,
      getBlockStats
    };
  })();
  var BlockMarkerGenerator = /* @__PURE__ */ (() => {
    let _Navigation = null;
    function setNavigation(nav) {
      _Navigation = nav;
    }
    let delegatedEventsInitialized = false;
    let clickHandler = null;
    let keydownHandler = null;
    let mouseoverHandler = null;
    let mouseoutHandler = null;
    function generateBlockMarkers(blocks, _table) {
      Logger.log("=== \u30D6\u30ED\u30C3\u30AF\u30DE\u30FC\u30AB\u30FC\u751F\u6210\u958B\u59CB ===");
      const { diffContent } = AppState.elements;
      if (!delegatedEventsInitialized) {
        initializeDelegatedEvents();
        delegatedEventsInitialized = true;
      }
      clearBlockMarkers();
      requestAnimationFrame(() => _placeBlockMarkers(blocks, diffContent));
    }
    function _placeBlockMarkers(blocks, diffContent, retryCount = 0) {
      const MAX_RETRY = 10;
      const contentHeight = diffContent.scrollHeight;
      if (contentHeight === 0) {
        if (retryCount >= MAX_RETRY) {
          Logger.warn(
            `_placeBlockMarkers: scrollHeight \u304C ${MAX_RETRY} \u30D5\u30EC\u30FC\u30E0\u5F8C\u3082 0 \u306E\u305F\u3081\u914D\u7F6E\u3092\u30B9\u30AD\u30C3\u30D7`
          );
          return;
        }
        requestAnimationFrame(() => _placeBlockMarkers(blocks, diffContent, retryCount + 1));
        return;
      }
      const paneLeft = AppState.elements.locationPaneLeft;
      const paneRight = AppState.elements.locationPaneRight;
      const paneHeight = (paneLeft || paneRight)?.clientHeight || 0;
      if (paneHeight === 0) {
        Logger.warn("_placeBlockMarkers: paneHeight \u304C 0");
        return;
      }
      const HEADER_H = 16;
      const availH = paneHeight - HEADER_H;
      blocks.forEach((block, index) => {
        const firstRow = block.rows[0];
        const lastRow = block.rows[block.rows.length - 1];
        const top = firstRow.offsetTop;
        const height = lastRow.offsetTop + lastRow.offsetHeight - top;
        const topPct = HEADER_H + top / contentHeight * availH;
        const heightPct = Math.max(
          height / contentHeight * availH,
          CONFIG.MARKER_MIN_HEIGHT_PERCENT / 100 * availH
        );
        const showLabel = blocks.length <= CONFIG.BLOCK_LABEL_DISPLAY_THRESHOLD;
        if (block.leftColor && paneLeft) {
          const m = _createBlockMarkerEl(
            index,
            block,
            topPct,
            heightPct,
            block.leftColor,
            showLabel
          );
          paneLeft.appendChild(m);
        }
        if (block.rightColor && paneRight) {
          const m = _createBlockMarkerEl(
            index,
            block,
            topPct,
            heightPct,
            block.rightColor,
            showLabel
          );
          paneRight.appendChild(m);
        }
      });
      Logger.log(
        `\u2705 \u30D6\u30ED\u30C3\u30AF\u30DE\u30FC\u30AB\u30FC\u914D\u7F6E\u5B8C\u4E86: ${blocks.length}\u500B / scrollHeight: ${contentHeight}`
      );
    }
    function _createBlockMarkerEl(index, block, topPct, heightPct, color, showLabel) {
      const marker = document.createElement("div");
      marker.classList.add("marker", "block-marker");
      marker.dataset.blockId = block.id;
      marker.dataset.blockIndex = index;
      marker.style.top = `${topPct}px`;
      marker.style.height = `${heightPct}px`;
      marker.style.backgroundColor = color;
      if (showLabel) {
        const label = document.createElement("span");
        label.className = "block-marker-label";
        label.textContent = index + 1;
        marker.appendChild(label);
      }
      marker.setAttribute("tabindex", "0");
      marker.setAttribute("role", "button");
      marker.setAttribute(
        "aria-label",
        `\u5DEE\u5206\u30D6\u30ED\u30C3\u30AF ${index + 1} (${block.rows.length}\u884C) \u3078\u30B8\u30E3\u30F3\u30D7`
      );
      return marker;
    }
    function initializeDelegatedEvents() {
      const paneLeft = AppState.elements.locationPaneLeft;
      const paneRight = AppState.elements.locationPaneRight;
      if (clickHandler) {
        paneLeft?.removeEventListener("click", clickHandler);
        paneRight?.removeEventListener("click", clickHandler);
        Logger.log("\u65E2\u5B58\u306Eblock-marker click\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (keydownHandler) {
        paneLeft?.removeEventListener("keydown", keydownHandler);
        paneRight?.removeEventListener("keydown", keydownHandler);
        Logger.log("\u65E2\u5B58\u306Eblock-marker keydown\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      clickHandler = (e) => {
        const marker = e.target.closest(".marker.block-marker");
        if (marker) {
          handleBlockMarkerClick(marker);
        }
      };
      keydownHandler = (e) => {
        const marker = e.target.closest(".marker.block-marker");
        if (marker && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleBlockMarkerClick(marker);
        }
      };
      mouseoverHandler = (e) => {
        const m = e.target.closest(".marker.block-marker");
        if (!m) return;
        const idx = m.dataset.blockIndex;
        document.querySelectorAll(`.block-marker[data-block-index="${idx}"]`).forEach((el) => el.classList.add("block-marker-hover"));
      };
      mouseoutHandler = (e) => {
        const m = e.target.closest(".marker.block-marker");
        if (!m) return;
        const idx = m.dataset.blockIndex;
        if (e.relatedTarget?.closest(`.block-marker[data-block-index="${idx}"]`)) return;
        document.querySelectorAll(`.block-marker[data-block-index="${idx}"]`).forEach((el) => el.classList.remove("block-marker-hover"));
      };
      paneLeft?.addEventListener("click", clickHandler);
      paneLeft?.addEventListener("keydown", keydownHandler);
      paneLeft?.addEventListener("mouseover", mouseoverHandler);
      paneLeft?.addEventListener("mouseout", mouseoutHandler);
      paneRight?.addEventListener("click", clickHandler);
      paneRight?.addEventListener("keydown", keydownHandler);
      paneRight?.addEventListener("mouseover", mouseoverHandler);
      paneRight?.addEventListener("mouseout", mouseoutHandler);
      Logger.log("\u2705 Block-marker event delegation initialized (click/keydown/hover)");
    }
    function handleBlockMarkerClick(marker) {
      const index = parseInt(marker.dataset.blockIndex, 10);
      if (isNaN(index) || index < 0 || index >= AppState.diffBlocks.length) {
        Logger.warn("Invalid block marker index:", index);
        return;
      }
      const block = AppState.diffBlocks[index];
      jumpToBlock(index, block);
    }
    function jumpToBlock(index, block) {
      Logger.log(`\u30D6\u30ED\u30C3\u30AF ${index + 1} \u306B\u30B8\u30E3\u30F3\u30D7`);
      if (!block || !block.rows || block.rows.length === 0) {
        Logger.error("\u7121\u52B9\u306A\u30D6\u30ED\u30C3\u30AF\u30C7\u30FC\u30BF:", index);
        return;
      }
      _Navigation?.clearCurrentDiffHighlight();
      AppState.currentDiffIndex = index;
      _createBlockHighlight(block);
      const firstRow = block.rows[0];
      try {
        firstRow.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (error) {
        Logger.error("\u30B9\u30AF\u30ED\u30FC\u30EB\u30A8\u30E9\u30FC:", error);
      }
      AppState.isNavigatingToDiff = true;
      document.querySelectorAll(".marker-selected").forEach((m) => m.classList.remove("marker-selected"));
      document.querySelectorAll(`.block-marker[data-block-index="${index}"]`).forEach((m) => m.classList.add("marker-selected"));
      setTimeout(() => {
        AppState.isNavigatingToDiff = false;
      }, CONFIG.NAVIGATION_COMPLETE_DELAY);
      updateBlockInfo();
    }
    function _createBlockHighlight(block) {
      const firstRow = block.rows[0];
      const lastRow = block.rows[block.rows.length - 1];
      const table = firstRow.closest("table");
      if (!table) return;
      const container = table.parentElement;
      if (!container) return;
      const oldWrapper = container.querySelector(".block-highlight-wrapper");
      if (oldWrapper) oldWrapper.remove();
      const containerPosition = window.getComputedStyle(container).position;
      if (containerPosition === "static") {
        container.style.position = "relative";
      }
      const tableRect = table.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const firstRowRect = firstRow.getBoundingClientRect();
      const lastRowRect = lastRow.getBoundingClientRect();
      const top = firstRowRect.top - containerRect.top + container.scrollTop;
      const height = lastRowRect.bottom - firstRowRect.top;
      const left = tableRect.left - containerRect.left;
      const width = tableRect.width;
      const wrapper = document.createElement("div");
      wrapper.className = "block-highlight-wrapper";
      wrapper.style.position = "absolute";
      wrapper.style.left = `${left}px`;
      wrapper.style.top = `${top}px`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      wrapper.style.pointerEvents = "none";
      wrapper.style.zIndex = "5";
      wrapper.dataset.blockIndex = AppState.currentDiffIndex;
      container.appendChild(wrapper);
    }
    function updateBlockHighlight() {
      const wrapper = document.querySelector(".block-highlight-wrapper");
      if (!wrapper) return;
      const blockIndex = parseInt(wrapper.dataset.blockIndex, 10);
      if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= AppState.diffBlocks.length) {
        return;
      }
      const block = AppState.diffBlocks[blockIndex];
      if (!block || !block.rows || block.rows.length === 0) {
        return;
      }
      const firstRow = block.rows[0];
      const lastRow = block.rows[block.rows.length - 1];
      const table = firstRow.closest("table");
      if (!table) return;
      const container = table.parentElement;
      if (!container) return;
      const tableRect = table.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const firstRowRect = firstRow.getBoundingClientRect();
      const lastRowRect = lastRow.getBoundingClientRect();
      const top = firstRowRect.top - containerRect.top + container.scrollTop;
      const height = lastRowRect.bottom - firstRowRect.top;
      const left = tableRect.left - containerRect.left;
      const width = tableRect.width;
      wrapper.style.left = `${left}px`;
      wrapper.style.top = `${top}px`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      Logger.log("\u2705 \u30D6\u30ED\u30C3\u30AF\u30CF\u30A4\u30E9\u30A4\u30C8\u306E\u4F4D\u7F6E\u30FB\u30B5\u30A4\u30BA\u3092\u66F4\u65B0");
    }
    function updateBlockInfo() {
      if (!AppState.diffBlocks || AppState.diffBlocks.length === 0) {
        AppState.elements.diffInfo.textContent = "\u5DEE\u5206: 0 / 0";
        CSSManager.showElement(AppState.elements.diffInfo, "info-visible", "info-hidden");
        return;
      }
      CSSManager.showElement(AppState.elements.diffInfo, "info-visible", "info-hidden");
      const current = AppState.currentDiffIndex >= 0 && AppState.currentDiffIndex < AppState.diffBlocks.length ? AppState.currentDiffIndex + 1 : 0;
      AppState.elements.diffInfo.textContent = `\u5DEE\u5206: ${current} / ${AppState.diffBlocks.length}`;
    }
    function clearBlockMarkers() {
      const paneLeft = AppState.elements.locationPaneLeft;
      const paneRight = AppState.elements.locationPaneRight;
      [paneLeft, paneRight].forEach((pane) => {
        if (!pane) return;
        pane.querySelectorAll(".block-marker").forEach((marker) => marker.remove());
      });
      Logger.log("\u2705 Block markers cleared (left + right panes)");
    }
    function cleanupDelegation() {
      const paneLeft = AppState.elements.locationPaneLeft;
      const paneRight = AppState.elements.locationPaneRight;
      if (!paneLeft && !paneRight) {
        Logger.warn("locationPane (left/right) not found during block-marker cleanup");
        return;
      }
      if (clickHandler) {
        paneLeft?.removeEventListener("click", clickHandler);
        paneRight?.removeEventListener("click", clickHandler);
        clickHandler = null;
        Logger.log("\u2705 block-marker click\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664\u3057\u307E\u3057\u305F");
      }
      if (keydownHandler) {
        paneLeft?.removeEventListener("keydown", keydownHandler);
        paneRight?.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
        Logger.log("\u2705 block-marker keydown\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664\u3057\u307E\u3057\u305F");
      }
      if (mouseoverHandler) {
        paneLeft?.removeEventListener("mouseover", mouseoverHandler);
        paneRight?.removeEventListener("mouseover", mouseoverHandler);
        mouseoverHandler = null;
        Logger.log("\u2705 block-marker mouseover\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664\u3057\u307E\u3057\u305F");
      }
      if (mouseoutHandler) {
        paneLeft?.removeEventListener("mouseout", mouseoutHandler);
        paneRight?.removeEventListener("mouseout", mouseoutHandler);
        mouseoutHandler = null;
        Logger.log("\u2705 block-marker mouseout\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664\u3057\u307E\u3057\u305F");
      }
      delegatedEventsInitialized = false;
      Logger.log("\u2705 Block-marker event delegation cleaned up");
    }
    function cleanup() {
      clearBlockMarkers();
      cleanupDelegation();
      Logger.log("\u2705 BlockMarkerGenerator completely cleaned up");
    }
    return {
      generateBlockMarkers,
      cleanup,
      cleanupDelegation,
      updateBlockHighlight,
      jumpToBlock,
      updateBlockInfo,
      clearBlockMarkers,
      setNavigation
    };
  })();

  // js/navigation.js
  var Navigation = /* @__PURE__ */ (() => {
    function highlightSelectedMarker(index) {
      clearMarkerSelection();
      const markers = document.querySelectorAll(`.block-marker[data-block-index="${index}"]`);
      markers.forEach((m) => m.classList.add("marker-selected"));
      if (markers.length > 0) {
        Logger.log("\u30DE\u30FC\u30AB\u30FC\u9078\u629E:", index, `(${markers.length}\u4EF6)`);
      }
    }
    function clearMarkerSelection() {
      document.querySelectorAll(".marker-selected").forEach((marker) => {
        marker.classList.remove("marker-selected");
      });
    }
    function clearCurrentDiffHighlight() {
      document.querySelectorAll(".current-diff").forEach((el) => {
        el.classList.remove("current-diff");
      });
      document.querySelectorAll(".block-highlight-wrapper").forEach((el) => {
        el.remove();
      });
      document.querySelectorAll('tr[style*="box-shadow"]').forEach((tr) => {
        tr.style.boxShadow = "";
        tr.style.borderRadius = "";
      });
      clearMarkerSelection();
    }
    function cleanupAllMarkers() {
      const paneLeft = AppState.elements.locationPaneLeft;
      const paneRight = AppState.elements.locationPaneRight;
      Logger.log("=== \u3059\u3079\u3066\u306E\u30DE\u30FC\u30AB\u30FC\u3092\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u958B\u59CB ===");
      BlockMarkerGenerator.cleanupDelegation();
      Logger.log("\u2705 BlockMarkerGenerator \u306E\u30A4\u30D9\u30F3\u30C8\u30EA\u30B9\u30CA\u30FC\u3092\u524A\u9664");
      [paneLeft, paneRight].forEach((pane) => {
        if (!pane) return;
        const allMarkers = pane.querySelectorAll(".marker");
        Logger.log(`\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u5BFE\u8C61\u306E\u30DE\u30FC\u30AB\u30FC\u6570: ${allMarkers.length} (${pane.id})`);
        allMarkers.forEach((marker) => {
          try {
            marker.remove();
          } catch (e) {
            Logger.warn("\u30DE\u30FC\u30AB\u30FC\u524A\u9664\u5931\u6557:", e);
          }
        });
      });
      Logger.log("=== \u3059\u3079\u3066\u306E\u30DE\u30FC\u30AB\u30FC\u306E\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u5B8C\u4E86 ===");
    }
    function resetInterface() {
      Logger.log("=== \u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9\u3092\u30EA\u30BB\u30C3\u30C8\u958B\u59CB ===");
      try {
        AppState.cleanupTimers();
        AppState.cleanupEventHandlers();
        AppState.reset();
        HTMLProcessor.removeImportedStyle();
        cleanupAllMarkers();
        UI.clearViewer();
        if (AppState.elements.dropArea) {
          AppState.elements.dropArea.style.display = "block";
        }
        CONFIG.CONTROL_BUTTONS.forEach((id) => {
          if (AppState.elements[id]) {
            CSSManager.hideElement(
              AppState.elements[id],
              "button-visible",
              "button-hidden"
            );
          }
        });
        if (AppState.elements.diffInfo) {
          CSSManager.hideElement(AppState.elements.diffInfo, "info-visible", "info-hidden");
        }
        if (AppState.elements.fixedHeader) {
          CSSManager.hideElement(
            AppState.elements.fixedHeader,
            "fixed-header-visible",
            "fixed-header-hidden"
          );
        }
        if (AppState.elements.fileInput) {
          AppState.elements.fileInput.value = "";
        }
        if (AppState.elements.diffContent) {
          AppState.elements.diffContent.scrollTop = 0;
        }
        clearCurrentDiffHighlight();
        if (AppState.elements.toolHeader) {
          CSSManager.showElement(
            AppState.elements.toolHeader,
            "toolHeader-visible",
            "toolHeader-hidden"
          );
        }
        Logger.log("\u2705 \u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9\u30EA\u30BB\u30C3\u30C8\u5B8C\u4E86");
      } catch (error) {
        Logger.error("Reset interface error:", error);
        UI.showMessage("\u30EA\u30BB\u30C3\u30C8\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u304C\u3001\u7D99\u7D9A\u3067\u304D\u307E\u3059\u3002", "warning");
      }
    }
    return {
      highlightSelectedMarker,
      clearMarkerSelection,
      clearCurrentDiffHighlight,
      resetInterface,
      cleanupAllMarkers
    };
  })();

  // js/file-handler.js
  var FileHandler = /* @__PURE__ */ (() => {
    function validate(file) {
      Logger.log("\u30D5\u30A1\u30A4\u30EB\u691C\u8A3C\u958B\u59CB:", file?.name);
      if (!file) {
        throw new FileValidationError("\u30D5\u30A1\u30A4\u30EB\u304C\u9078\u629E\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002", "NO_FILE");
      }
      if (!file.name || file.name.trim() === "") {
        throw new FileValidationError("\u7121\u52B9\u306A\u30D5\u30A1\u30A4\u30EB\u540D\u3067\u3059\u3002", "INVALID_NAME");
      }
      const fileName = file.name.toLowerCase();
      const hasValidExtension = CONFIG.SUPPORTED_EXTENSIONS.some(
        (ext) => fileName.endsWith(ext.toLowerCase())
      );
      if (!hasValidExtension) {
        throw new FileValidationError(
          `\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u306A\u3044\u30D5\u30A1\u30A4\u30EB\u5F62\u5F0F\u3067\u3059\u3002${CONFIG.SUPPORTED_EXTENSIONS.join(", ")} \u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002`,
          "INVALID_EXTENSION"
        );
      }
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        throw new FileValidationError(
          `\u30D5\u30A1\u30A4\u30EB\u30B5\u30A4\u30BA\u304C\u5927\u304D\u3059\u304E\u307E\u3059\u3002\u6700\u5927\u30B5\u30A4\u30BA: ${Utils.formatFileSize(CONFIG.MAX_FILE_SIZE)}`,
          "FILE_TOO_LARGE"
        );
      }
      if (file.size === 0) {
        throw new FileValidationError("\u30D5\u30A1\u30A4\u30EB\u304C\u7A7A\u3067\u3059\u3002", "EMPTY_FILE");
      }
      return true;
    }
    function process(file) {
      Logger.log("\u30D5\u30A1\u30A4\u30EB\u51E6\u7406\u958B\u59CB");
      if (AppState.isProcessing) {
        Logger.log("\u65E2\u306B\u51E6\u7406\u4E2D\u3067\u3059");
        return;
      }
      try {
        validate(file);
      } catch (error) {
        ErrorHandler.handle(error, "File validation");
        return;
      }
      Logger.log("\u30D5\u30A1\u30A4\u30EB\u691C\u8A3C\u6210\u529F\u3001\u51E6\u7406\u958B\u59CB");
      AppState.isProcessing = true;
      const reader = new FileReader();
      reader.onload = async () => {
        Logger.log("\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u5B8C\u4E86 (UTF-8)");
        try {
          const content = await _rereadAsShiftJisIfNeeded(file, reader.result);
          handleLoad(file, content);
        } catch (e) {
          const error = new FileProcessingError(
            "\u30D5\u30A1\u30A4\u30EB\u306E\u6587\u5B57\u30B3\u30FC\u30C9\u5909\u63DB\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002",
            "read",
            e
          );
          ErrorHandler.handle(error, "Encoding re-read");
        }
      };
      reader.onerror = (event) => {
        const error = new FileProcessingError(
          "\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002",
          "read",
          event.target.error
        );
        ErrorHandler.handle(error, "File reading");
      };
      reader.onabort = () => {
        const error = new FileProcessingError("\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u304C\u4E2D\u65AD\u3055\u308C\u307E\u3057\u305F\u3002", "read");
        ErrorHandler.handle(error, "File reading aborted");
      };
      reader.readAsText(file, "utf-8");
    }
    function _rereadAsShiftJisIfNeeded(file, utf8Content) {
      if (!utf8Content.includes("\uFFFD")) {
        return Promise.resolve(utf8Content);
      }
      Logger.log("U+FFFD \u3092\u691C\u51FA: Shift-JIS \u3067\u518D\u8AAD\u8FBC\u3057\u307E\u3059");
      return new Promise((resolve, reject) => {
        const sjisReader = new FileReader();
        sjisReader.onload = () => resolve(sjisReader.result);
        sjisReader.onerror = (e) => reject(e.target.error);
        sjisReader.readAsText(file, "shift-jis");
      });
    }
    async function handleLoad(file, content) {
      const progress = new ProgressIndicator();
      try {
        progress.show("WinMerge\u30EC\u30DD\u30FC\u30C8\u3092\u51E6\u7406\u4E2D");
        await _stepRead(file, content, progress);
        const sanitized = await _stepSanitize(content, progress);
        const doc = await _stepParse(sanitized, progress);
        const table = await _stepDetect(doc, progress);
        await _stepMarker(table, progress);
        await _stepRender(progress);
        await Utils.sleep(CONFIG.PROGRESS_COMPLETION_DELAY_MS);
        progress.hide();
        Logger.log("\u2705 \u30D5\u30A1\u30A4\u30EB\u51E6\u7406\u304C\u6B63\u5E38\u306B\u5B8C\u4E86\u3057\u307E\u3057\u305F");
      } catch (error) {
        if (progress) {
          const errorMsg = error.message && error.message.length > 50 ? error.message.substring(0, 47) + "..." : error.message || "\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F";
          progress.showError(errorMsg);
        }
        ErrorHandler.handle(error, "File load handling");
      } finally {
        AppState.isProcessing = false;
      }
    }
    async function _stepRead(file, content, progress) {
      progress.updateStepProgress("read", 0);
      await Utils.sleep(CONFIG.PROGRESS_STEP_DELAY_MS);
      Navigation.resetInterface();
      progress.updateStepProgress("read", 50);
      UI.showFileInfo(file);
      if (!content || content.trim().length === 0) {
        throw new FileProcessingError("\u30D5\u30A1\u30A4\u30EB\u306E\u5185\u5BB9\u304C\u7A7A\u3067\u3059", "read");
      }
      progress.updateStepProgress("read", 100);
    }
    async function _stepSanitize(content, progress) {
      progress.updateStepProgress("sanitize", 0);
      await Utils.sleep(CONFIG.PROGRESS_STEP_DELAY_MS);
      let sanitized;
      try {
        sanitized = HTMLProcessor.sanitize(content);
      } catch (error) {
        throw new FileProcessingError(
          "HTML\u306E\u30B5\u30CB\u30BF\u30A4\u30BC\u30FC\u30B7\u30E7\u30F3\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
          "sanitize",
          error
        );
      }
      progress.updateStepProgress("sanitize", 50);
      if (!sanitized || sanitized.trim().length === 0) {
        throw new FileProcessingError(
          "\u30B5\u30CB\u30BF\u30A4\u30BC\u30FC\u30B7\u30E7\u30F3\u5F8C\u306B\u30B3\u30F3\u30C6\u30F3\u30C4\u304C\u7A7A\u306B\u306A\u308A\u307E\u3057\u305F",
          "sanitize"
        );
      }
      progress.updateStepProgress("sanitize", 100);
      return sanitized;
    }
    async function _stepParse(sanitized, progress) {
      progress.updateStepProgress("parse", 0);
      await Utils.sleep(CONFIG.PROGRESS_STEP_DELAY_MS);
      let doc;
      try {
        doc = new DOMParser().parseFromString(sanitized, "text/html");
        const parserError = doc.querySelector("parsererror");
        if (parserError) {
          throw new HTMLParsingError("HTML\u306E\u89E3\u6790\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
        }
      } catch (error) {
        throw new FileProcessingError("DOM\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F", "parse", error);
      }
      progress.updateStepProgress("parse", 50);
      try {
        HTMLProcessor.importStyles(doc);
      } catch (error) {
        Logger.warn("\u30B9\u30BF\u30A4\u30EB\u30A4\u30F3\u30DD\u30FC\u30C8\u306B\u5931\u6557:", error);
      }
      progress.updateStepProgress("parse", 100);
      return doc;
    }
    async function _stepDetect(doc, progress) {
      progress.updateStepProgress("detect", 0);
      await Utils.sleep(CONFIG.PROGRESS_STEP_DELAY_MS);
      let table;
      try {
        table = HTMLProcessor.processTable(doc);
      } catch (error) {
        if (error instanceof TableProcessingError) throw error;
        throw new TableProcessingError("\u30C6\u30FC\u30D6\u30EB\u306E\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F", error);
      }
      progress.updateStepProgress("detect", 50);
      if (!table) {
        throw new TableProcessingError("\u5DEE\u5206\u30C6\u30FC\u30D6\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F");
      }
      AppState.elements.viewer.appendChild(table);
      progress.updateStepProgress("detect", 100);
      return table;
    }
    async function _stepMarker(table, progress) {
      progress.updateStepProgress("marker", 0);
      await Utils.sleep(CONFIG.PROGRESS_MARKER_DELAY_MS);
      try {
        TableProcessor.setupFixedHeader(table);
        progress.updateStepProgress("marker", 20);
        AppState.diffBlocks = DiffBlockDetector.detectBlocks(table);
        BlockMarkerGenerator.generateBlockMarkers(AppState.diffBlocks, table);
        BlockMarkerGenerator.updateBlockInfo();
        progress.updateStepProgress("marker", 60);
        TableProcessor.setupIntersectionObserver();
        progress.updateStepProgress("marker", 80);
        AppState.eventHandlers.markerResizeCallback = () => {
          if (!AppState.diffBlocks?.length) return;
          BlockMarkerGenerator.updateBlockHighlight();
          const currentTable = AppState.elements.viewer.querySelector("table");
          if (!currentTable) return;
          BlockMarkerGenerator.clearBlockMarkers();
          BlockMarkerGenerator.generateBlockMarkers(AppState.diffBlocks, currentTable);
          Logger.log("\u2705 \u30EA\u30B5\u30A4\u30BA\u5F8C\u306E\u30DF\u30CB\u30DE\u30C3\u30D7\u30DE\u30FC\u30AB\u30FC\u3092\u518D\u914D\u7F6E");
        };
        progress.updateStepProgress("marker", 100);
      } catch (error) {
        throw new FileProcessingError("\u30DE\u30FC\u30AB\u30FC\u751F\u6210\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F", "marker", error);
      }
    }
    async function _stepRender(progress) {
      progress.updateStepProgress("render", 0);
      await Utils.sleep(CONFIG.PROGRESS_STEP_DELAY_MS);
      try {
        AppState.elements.prevDiffButton.onclick = jumpToPrevDiffEnhanced;
        AppState.elements.nextDiffButton.onclick = jumpToNextDiffEnhanced;
        progress.updateStepProgress("render", 50);
        CSSManager.hideElement(
          AppState.elements.toolHeader,
          "toolHeader-visible",
          "toolHeader-hidden"
        );
        progress.updateStepProgress("render", 100);
      } catch (error) {
        throw new FileProcessingError("\u30EC\u30F3\u30C0\u30EA\u30F3\u30B0\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F", "render", error);
      }
    }
    function jumpToNextDiffEnhanced() {
      if (!AppState.diffBlocks || AppState.diffBlocks.length === 0) {
        UI.showMessage("\u30D6\u30ED\u30C3\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", "warning");
        return;
      }
      Navigation.clearCurrentDiffHighlight();
      const nextIndex = (AppState.currentDiffIndex + 1) % AppState.diffBlocks.length;
      const block = AppState.diffBlocks[nextIndex];
      if (!block || !block.rows || block.rows.length === 0) {
        Logger.warn("\u7121\u52B9\u306A\u30D6\u30ED\u30C3\u30AF:", nextIndex);
        return;
      }
      BlockMarkerGenerator.jumpToBlock(nextIndex, block);
    }
    function jumpToPrevDiffEnhanced() {
      if (!AppState.diffBlocks || AppState.diffBlocks.length === 0) {
        UI.showMessage("\u30D6\u30ED\u30C3\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", "warning");
        return;
      }
      Navigation.clearCurrentDiffHighlight();
      const prevIndex = AppState.currentDiffIndex <= 0 ? AppState.diffBlocks.length - 1 : AppState.currentDiffIndex - 1;
      const block = AppState.diffBlocks[prevIndex];
      if (!block || !block.rows || block.rows.length === 0) {
        Logger.warn("\u7121\u52B9\u306A\u30D6\u30ED\u30C3\u30AF:", prevIndex);
        return;
      }
      BlockMarkerGenerator.jumpToBlock(prevIndex, block);
    }
    return {
      validate,
      process,
      handleLoad,
      jumpToNextDiffEnhanced,
      jumpToPrevDiffEnhanced
    };
  })();

  // js/event-manager.js
  var EventManager = /* @__PURE__ */ (() => {
    const DRAG_EVENTS = ["dragenter", "dragover", "dragleave", "drop"];
    const HIGHLIGHT_EVENTS = ["dragenter", "dragover"];
    const UNHIGHLIGHT_EVENTS = ["dragleave", "drop"];
    const eventHandlers = {
      fileInputChange: null,
      resetButtonClick: null,
      scrollTopButtonClick: null,
      dropAreaClick: null,
      dragPreventDefaults: null,
      dragHighlight: null,
      dragUnhighlight: null,
      drop: null,
      keydown: null
    };
    function getTotalDiffCount() {
      return AppState.diffBlocks?.length ?? 0;
    }
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    function highlight() {
      if (!AppState.isProcessing) {
        AppState.elements.dropArea.classList.add("drag-over");
      }
    }
    function unhighlight() {
      AppState.elements.dropArea.classList.remove("drag-over");
    }
    function handleDrop(e) {
      if (AppState.isProcessing) return;
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        FileHandler.process(files[0]);
      }
    }
    function handleKeydown(e) {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || document.activeElement?.isContentEditable) {
        return;
      }
      const elements = AppState.elements;
      const isButtonActive = (button) => button && !button.classList.contains("button-hidden");
      if (e.ctrlKey && e.key === "ArrowDown") {
        if (isButtonActive(elements.nextDiffButton)) {
          e.preventDefault();
          elements.nextDiffButton.click();
        }
      } else if (e.ctrlKey && e.key === "ArrowUp") {
        if (isButtonActive(elements.prevDiffButton)) {
          e.preventDefault();
          elements.prevDiffButton.click();
        }
      } else if (e.key === "Home") {
        if (isButtonActive(elements.scrollTopButton)) {
          e.preventDefault();
          elements.scrollTopButton.click();
        }
      } else if (e.key === "Escape") {
        if (isButtonActive(elements.resetButton)) {
          elements.resetButton.click();
        }
      }
    }
    function initializeEventListeners() {
      const elements = AppState.elements;
      cleanup();
      eventHandlers.fileInputChange = (e) => {
        const file = e.target.files[0];
        if (file) FileHandler.process(file);
      };
      elements.fileInput.addEventListener("change", eventHandlers.fileInputChange);
      eventHandlers.resetButtonClick = () => Navigation.resetInterface();
      elements.resetButton.addEventListener("click", eventHandlers.resetButtonClick);
      eventHandlers.scrollTopButtonClick = () => {
        AppState.isScrollingToTop = true;
        Navigation.clearCurrentDiffHighlight();
        Navigation.clearMarkerSelection();
        AppState.currentDiffIndex = -1;
        const total = getTotalDiffCount();
        if (total > 0) {
          elements.diffInfo.textContent = `\u5DEE\u5206: 0 / ${total}`;
        }
        elements.diffContent.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          AppState.currentDiffIndex = -1;
          AppState.isScrollingToTop = false;
        }, CONFIG.SCROLL_TO_TOP_RESET_DELAY_MS);
      };
      elements.scrollTopButton.addEventListener("click", eventHandlers.scrollTopButtonClick);
      eventHandlers.dropAreaClick = () => {
        if (!AppState.isProcessing) {
          elements.fileInput.click();
        }
      };
      elements.dropArea.addEventListener("click", eventHandlers.dropAreaClick);
      eventHandlers.dragPreventDefaults = preventDefaults;
      DRAG_EVENTS.forEach((eventName) => {
        elements.dropArea.addEventListener(eventName, eventHandlers.dragPreventDefaults, false);
        document.body.addEventListener(eventName, eventHandlers.dragPreventDefaults, false);
      });
      eventHandlers.dragHighlight = highlight;
      HIGHLIGHT_EVENTS.forEach((eventName) => {
        elements.dropArea.addEventListener(eventName, eventHandlers.dragHighlight, false);
      });
      eventHandlers.dragUnhighlight = unhighlight;
      UNHIGHLIGHT_EVENTS.forEach((eventName) => {
        elements.dropArea.addEventListener(eventName, eventHandlers.dragUnhighlight, false);
      });
      eventHandlers.drop = handleDrop;
      elements.dropArea.addEventListener("drop", eventHandlers.drop, false);
      eventHandlers.keydown = handleKeydown;
      document.addEventListener("keydown", eventHandlers.keydown);
      Logger.log("\u2705 Event listeners initialized with cleanup support");
    }
    function cleanup() {
      const elements = AppState.elements;
      if (!elements) {
        Logger.warn("Elements not found during EventManager cleanup");
        return;
      }
      Logger.log("=== EventManager \u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u958B\u59CB ===");
      if (eventHandlers.fileInputChange && elements.fileInput) {
        elements.fileInput.removeEventListener("change", eventHandlers.fileInputChange);
        eventHandlers.fileInputChange = null;
        Logger.log("\u2705 fileInput change\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.resetButtonClick && elements.resetButton) {
        elements.resetButton.removeEventListener("click", eventHandlers.resetButtonClick);
        eventHandlers.resetButtonClick = null;
        Logger.log("\u2705 resetButton click\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.scrollTopButtonClick && elements.scrollTopButton) {
        elements.scrollTopButton.removeEventListener(
          "click",
          eventHandlers.scrollTopButtonClick
        );
        eventHandlers.scrollTopButtonClick = null;
        Logger.log("\u2705 scrollTopButton click\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.dropAreaClick && elements.dropArea) {
        elements.dropArea.removeEventListener("click", eventHandlers.dropAreaClick);
        eventHandlers.dropAreaClick = null;
        Logger.log("\u2705 dropArea click\u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.dragPreventDefaults && elements.dropArea) {
        DRAG_EVENTS.forEach((eventName) => {
          elements.dropArea.removeEventListener(
            eventName,
            eventHandlers.dragPreventDefaults,
            false
          );
          document.body.removeEventListener(
            eventName,
            eventHandlers.dragPreventDefaults,
            false
          );
        });
        eventHandlers.dragPreventDefaults = null;
        Logger.log("\u2705 drag preventDefaults \u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.dragHighlight && elements.dropArea) {
        HIGHLIGHT_EVENTS.forEach((eventName) => {
          elements.dropArea.removeEventListener(
            eventName,
            eventHandlers.dragHighlight,
            false
          );
        });
        eventHandlers.dragHighlight = null;
        Logger.log("\u2705 drag highlight \u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.dragUnhighlight && elements.dropArea) {
        UNHIGHLIGHT_EVENTS.forEach((eventName) => {
          elements.dropArea.removeEventListener(
            eventName,
            eventHandlers.dragUnhighlight,
            false
          );
        });
        eventHandlers.dragUnhighlight = null;
        Logger.log("\u2705 drag unhighlight \u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.drop && elements.dropArea) {
        elements.dropArea.removeEventListener("drop", eventHandlers.drop, false);
        eventHandlers.drop = null;
        Logger.log("\u2705 drop \u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      if (eventHandlers.keydown) {
        document.removeEventListener("keydown", eventHandlers.keydown);
        eventHandlers.keydown = null;
        Logger.log("\u2705 keydown \u30CF\u30F3\u30C9\u30E9\u3092\u524A\u9664");
      }
      Logger.log("=== EventManager \u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u5B8C\u4E86 ===");
    }
    return {
      initializeEventListeners,
      cleanup,
      preventDefaults,
      highlight,
      unhighlight,
      handleDrop
    };
  })();

  // js/main.js
  var WinMergeViewer = /* @__PURE__ */ (() => {
    function monitorPerformance() {
      if (AppState.timers.memoryMonitor) {
        clearInterval(AppState.timers.memoryMonitor);
        AppState.timers.memoryMonitor = null;
      }
      if ("performance" in window && "memory" in window.performance) {
        const checkMemory = () => {
          try {
            const memory = window.performance.memory;
            if (memory.usedJSHeapSize && memory.jsHeapSizeLimit) {
              const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
              if (usageRatio > CONFIG.MEMORY_THRESHOLD_RATIO) {
                Logger.warn("Memory usage is high");
              }
            }
          } catch (error) {
            Logger.warn("Memory check failed:", error);
          }
        };
        AppState.timers.memoryMonitor = setInterval(checkMemory, CONFIG.MEMORY_CHECK_INTERVAL);
      }
    }
    function setupErrorBoundary() {
      window.addEventListener("error", (event) => {
        event.preventDefault();
        const error = event.error || new Error(event.message);
        ErrorHandler.handle(error, "Global error");
      });
      window.addEventListener("unhandledrejection", (event) => {
        event.preventDefault();
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        ErrorHandler.handle(error, "Unhandled promise rejection");
      });
    }
    function enhanceAccessibility() {
      AppState.elements.resetButton.setAttribute("aria-label", "\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9\u3092\u30EA\u30BB\u30C3\u30C8");
      AppState.elements.scrollTopButton.setAttribute("aria-label", "\u30DA\u30FC\u30B8\u30C8\u30C3\u30D7\u3078\u30B9\u30AF\u30ED\u30FC\u30EB");
      AppState.elements.prevDiffButton.setAttribute("aria-label", "\u524D\u306E\u5DEE\u5206\u3078\u30B8\u30E3\u30F3\u30D7");
      AppState.elements.nextDiffButton.setAttribute("aria-label", "\u6B21\u306E\u5DEE\u5206\u3078\u30B8\u30E3\u30F3\u30D7");
    }
    function initializeApp() {
      try {
        setupErrorBoundary();
        AppState.init();
        BlockMarkerGenerator.setNavigation(Navigation);
        EventManager.initializeEventListeners();
        enhanceAccessibility();
        monitorPerformance();
        Logger.log("WinMerge Diff Report Viewer v6.2 initialized");
      } catch (error) {
        Logger.error("\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u521D\u671F\u5316\u30A8\u30E9\u30FC:", error);
        UI.showMessage(
          "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30DA\u30FC\u30B8\u3092\u30EA\u30ED\u30FC\u30C9\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        );
      }
    }
    function setupLifecycleEvents() {
      window.addEventListener("beforeunload", () => {
        try {
          AppState.cleanupTimers();
          AppState.cleanupEventHandlers();
          BlockMarkerGenerator.cleanup();
          EventManager.cleanup();
          if (AppState.intersectionObserver) {
            AppState.intersectionObserver.disconnect();
            AppState.intersectionObserver = null;
          }
          AppState.reset();
          HTMLProcessor.removeImportedStyle();
          Logger.log("\u2705 Cleanup completed on page unload");
        } catch (error) {
          Logger.warn("Cleanup error during unload:", error);
        }
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (AppState.timers.memoryMonitor) {
            clearInterval(AppState.timers.memoryMonitor);
            AppState.timers.memoryMonitor = null;
          }
        } else {
          if (AppState.elements?.viewer?.querySelector("table")) {
            monitorPerformance();
          }
        }
      });
    }
    const DebugFunctions = {
      /**
       * ブロック情報を表示
       * @returns {DebugBlockResult|void}
       */
      showBlocks() {
        const table = AppState.elements.viewer.querySelector("table");
        if (!table) {
          console.log("\u26A0\uFE0F \u30C6\u30FC\u30D6\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
          return;
        }
        const blocks = DiffBlockDetector.detectBlocks(table);
        const stats = DiffBlockDetector.getBlockStats(blocks);
        console.log("=== \u30D6\u30ED\u30C3\u30AF\u7D71\u8A08 ===");
        console.log("\u7DCF\u30D6\u30ED\u30C3\u30AF\u6570:", stats.total);
        console.log(
          "\u5909\u66F4\u7CFB\u30D6\u30ED\u30C3\u30AF:",
          stats.addBlocks,
          `(${stats.totalAddLines}\u884C)`,
          "--- changed / word"
        );
        console.log(
          "\u524A\u9664\u7CFB\u30D6\u30ED\u30C3\u30AF:",
          stats.delBlocks,
          `(${stats.totalDelLines}\u884C)`,
          "--- del / moved_from / moved_to"
        );
        console.log("\u5E73\u5747\u30D6\u30ED\u30C3\u30AF\u30B5\u30A4\u30BA:", stats.averageBlockSize.toFixed(2), "\u884C");
        console.log("");
        console.log("=== \u30D6\u30ED\u30C3\u30AF\u8A73\u7D30 ===");
        const TYPE_LABEL = {
          changed: "\u5909\u66F4\u884C",
          word: "\u884C\u5185\u5DEE\u5206",
          del: "\u524A\u9664\u30FB\u8FFD\u52A0\u884C",
          moved_from: "\u79FB\u52D5\u5143",
          moved_to: "\u79FB\u52D5\u5148",
          separator: "\u533A\u5207\u308A\u884C",
          unknown: "\u4E0D\u660E"
        };
        console.table(
          blocks.map((b) => ({
            ID: b.id + 1,
            \u30BF\u30A4\u30D7: TYPE_LABEL[b.type] ?? b.type,
            \u884C\u6570: b.rows.length,
            \u958B\u59CB\u884C: b.startIndex,
            \u7D42\u4E86\u884C: b.endIndex
          }))
        );
        return { blocks, stats };
      },
      /**
       * ブロックを視覚化
       * @returns {void}
       */
      visualizeBlocks() {
        const table = AppState.elements.viewer.querySelector("table");
        if (!table) {
          console.log("\u26A0\uFE0F \u30C6\u30FC\u30D6\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
          return;
        }
        const blocks = DiffBlockDetector.detectBlocks(table);
        table.querySelectorAll("tr").forEach((row) => {
          row.style.border = "";
          row.style.position = "";
        });
        const TYPE_COLORS = {
          changed: "#FFC107",
          // 変更行: アンバー
          word: "#FF9800",
          // 変更行内差分: オレンジ
          del: "#f44336",
          // 削除・追加行: 赤
          moved_from: "#9C27B0",
          // 移動元: 紫
          moved_to: "#673AB7",
          // 移動先: 濃紫
          separator: "#9E9E9E"
          // 区切り行: グレー
        };
        const DEFAULT_COLOR = "#607D8B";
        blocks.forEach((block, index) => {
          const color = TYPE_COLORS[block.type] || DEFAULT_COLOR;
          const firstRow = block.rows[0];
          const lastRow = block.rows[block.rows.length - 1];
          firstRow.style.position = "relative";
          firstRow.style.borderTop = `3px solid ${color}`;
          lastRow.style.borderBottom = `3px solid ${color}`;
          block.rows.forEach((row) => {
            row.style.borderLeft = `3px solid ${color}`;
            row.style.borderRight = `3px solid ${color}`;
          });
          firstRow.title = `\u30D6\u30ED\u30C3\u30AF ${index + 1}: ${block.type} (${block.rows.length}\u884C)`;
        });
        console.log("\u2705 \u30D6\u30ED\u30C3\u30AF\u306E\u8996\u899A\u5316\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F");
        console.log("\u{1F4A1} \u5143\u306B\u623B\u3059\u306B\u306F: location.reload()");
      },
      /**
       * ブロックモード状態を表示
       * @returns {void}
       */
      blockMode() {
        console.log("=== Block Mode Status ===");
        console.log("diffBlocks length:", AppState.diffBlocks?.length || 0);
        console.log("currentDiffIndex:", AppState.currentDiffIndex);
      },
      /**
       * メモリ状態を表示
       * @returns {MemoryInfo|void}
       */
      memoryStatus() {
        if (!performance.memory) {
          console.log("\u26A0\uFE0F \u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306Fperformance.memory\u3092\u30B5\u30DD\u30FC\u30C8\u3057\u3066\u3044\u307E\u305B\u3093");
          return;
        }
        const used = performance.memory.usedJSHeapSize / 1024 / 1024;
        const total = performance.memory.totalJSHeapSize / 1024 / 1024;
        const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024;
        console.log("=== Memory Status ===");
        console.log("Used:", used.toFixed(2), "MB");
        console.log("Total:", total.toFixed(2), "MB");
        console.log("Limit:", limit.toFixed(2), "MB");
        console.log("Usage:", (used / limit * 100).toFixed(2), "%");
        return { used, total, limit };
      },
      /**
       * AppState状態を表示
       * @returns {void}
       */
      appState() {
        console.log("=== AppState Status ===");
        console.log("isProcessing:", AppState.isProcessing);
        console.log("diffBlocks count:", AppState.diffBlocks?.length || 0);
        console.log("currentDiffIndex:", AppState.currentDiffIndex);
      },
      /**
       * すべてのデバッグ情報を表示
       * @returns {void}
       */
      all() {
        this.memoryStatus();
        console.log("");
        this.appState();
        console.log("");
        this.blockMode();
      }
    };
    return {
      // バージョン情報
      version: "6.2.0",
      // 初期化
      init: () => {
        initializeApp();
        setupLifecycleEvents();
      },
      // コアモジュール
      AppState,
      Logger,
      CONFIG,
      // ユーティリティ
      Utils,
      CSSManager,
      // UI制御
      UI,
      // エラーハンドリング
      ErrorHandler,
      FileValidationError,
      FileProcessingError,
      HTMLParsingError,
      TableProcessingError,
      NavigationError,
      // ファイル処理
      FileHandler,
      HTMLProcessor,
      TableProcessor,
      // ナビゲーション
      Navigation,
      // マーカー管理
      DiffBlockDetector,
      BlockMarkerGenerator,
      // イベント管理
      EventManager,
      // プログレス表示
      ProgressIndicator,
      // デバッグ
      debug: DebugFunctions
    };
  })();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => WinMergeViewer.init());
  } else {
    WinMergeViewer.init();
  }
  if (WinMergeViewer.Logger.enabled) {
    window.WinMergeViewer = WinMergeViewer;
  }
  if (WinMergeViewer.debug && WinMergeViewer.Logger.enabled) {
    console.log("");
    console.log("=== \u30C7\u30D0\u30C3\u30B0\u95A2\u6570\u304C\u6709\u52B9\u3067\u3059 ===");
    console.log("\u4F7F\u7528\u53EF\u80FD\u306A\u95A2\u6570:");
    console.log("  - WinMergeViewer.debug.showBlocks()");
    console.log("  - WinMergeViewer.debug.visualizeBlocks()");
    console.log("  - WinMergeViewer.debug.blockMode()");
    console.log("  - WinMergeViewer.debug.memoryStatus()");
    console.log("  - WinMergeViewer.debug.appState()");
    console.log("  - WinMergeViewer.debug.all()");
    console.log("");
    console.log("\u{1F4A1} \u77ED\u7E2E\u5F62\u3082\u5229\u7528\u53EF\u80FD:");
    window.wmv = WinMergeViewer;
    window.debug = WinMergeViewer.debug;
    console.log("  - wmv.debug.showBlocks() \u307E\u305F\u306F debug.showBlocks()");
    console.log("  - wmv.debug.all() \u307E\u305F\u306F debug.all()");
    console.log("");
  }
  if (WinMergeViewer.Logger.enabled) {
    console.log("");
    console.log("=== WinMerge Report Viewer v6.2 ===");
    console.log("\u{1F4E6} WinMergeViewer \u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u304B\u3089\u3059\u3079\u3066\u306E\u30E2\u30B8\u30E5\u30FC\u30EB\u306B\u30A2\u30AF\u30BB\u30B9\u53EF\u80FD");
    console.log("\u{1F41B} \u30C7\u30D0\u30C3\u30B0: wmv.debug.all() \u3067\u72B6\u614B\u78BA\u8A8D");
    console.log("");
  }
})();
