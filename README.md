# WinMerge Report Viewer - ユニットテスト

## 対象モジュール

| テストファイル | 対象ソース | テスト件数 |
|---|---|---|
| `tests/errors.test.js` | `js/errors.js` | 10件 |
| `tests/utils.test.js` | `js/utils.js` | 6件 |

## ファイル構成

```
project/
├── js/
│   ├── errors.js          # カスタムエラークラス（依存なし）
│   └── utils.js           # ユーティリティ関数（CONFIG/Logger に依存）
├── tests/
│   ├── setup.js           # テスト環境セットアップ（グローバル注入）
│   ├── errors.test.js     # errors.js のテスト
│   └── utils.test.js      # utils.js のテスト
├── vitest.config.js       # Vitest 設定
└── package.json
```

## セットアップ

```bash
npm install
```

## テスト実行

```bash
# 全テストを1回実行
npm test

# ファイル変更を監視して自動再実行
npm run test:watch
```

## 設計上の注意点

### ESM 移行前の暫定対応

`errors.js` / `utils.js` は現在 `<script>` タグ読み込み用のため `export` が
コメントアウトされています。`tests/setup.js` が各ファイルを `fs.readFileSync` で
読み込み、`eval` でグローバルスコープに展開することで、ESM 移行なしにテストを
実行できるようにしています。

ESM 移行後は以下の手順でシンプルな import 方式に移行できます。

1. `js/errors.js` と `js/utils.js` の `export` コメントを外す
2. `tests/errors.test.js` と `tests/utils.test.js` の `import` コメントを外す
3. `tests/setup.js` の `loadGlobal()` 呼び出しと `global.*` 代入を削除する

### CONFIG / Logger のモック

`utils.js` はブラウザのグローバル変数 `CONFIG` と `Logger` を参照しています。
`tests/setup.js` でテスト用の最小モックを定義しています。

`CONFIG.MAX_FILENAME_DISPLAY` の値を変更した場合は `tests/setup.js` の
モック値も合わせて更新してください（現在値: `50`）。
