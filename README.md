# WinMerge Report Viewer

WinMerge が出力した HTML レポートをブラウザで見やすく表示するウェブアプリです。

🌐 **公開URL**: https://daiki-aoki.github.io/WinMerge-Report-Viewer/

---

## このアプリでできること

- WinMerge の HTMLレポートファイル（`.htm` / `.html`）をブラウザで開く
- 差分箇所をハイライト表示する
- 「次の差分」「前の差分」ボタンで差分行を順番に確認できる
- ミニマップ（右端のバー）で差分の位置を一目で把握できる
- ミニマップをクリックして差分箇所にジャンプできる

---

## 使い方

1. ブラウザで公開URLにアクセスする
2. WinMerge で出力した `.htm` ファイルをドラッグ＆ドロップする（またはクリックしてファイルを選択する）
3. 差分テーブルが表示される
4. 「次の差分 →」「← 前の差分」ボタンで差分を確認する
5. 「↺ リセット」ボタンで別のファイルを読み込める

---

## アーキテクチャ概要

### データの流れ

```
HTMファイル選択
    ↓
file-handler.js   ← ファイルを読み込み・検証する
    ↓
html-processor.js ← HTMLをサニタイズ（XSS対策）する
    ↓
table-processor.js ← 差分テーブルを解析・整形する
    ↓
marker-manager.js  ← ミニマップのマーカーを生成する
diff-detector.js   ← ブロック単位の差分を検出する
    ↓
navigation.js      ← 差分ナビゲーション（次へ・前へ）を制御する
    ↓
ブラウザに表示
```

### モジュール構成

| ファイル | 役割 | 難易度 |
|---|---|---|
| `config.js` | 色・サイズなどの定数を一元管理 | ★☆☆ |
| `state.js` | アプリ全体の状態（現在の差分位置など）を管理 | ★★☆ |
| `errors.js` | エラーの種類を定義 | ★☆☆ |
| `error-handler.js` | エラー発生時の処理を担当 | ★★☆ |
| `file-handler.js` | ファイルの読み込みと検証を担当 | ★★☆ |
| `html-processor.js` | HTMLのサニタイズ（安全処理）を担当 | ★★☆ |
| `table-processor.js` | 差分テーブルの解析・固定ヘッダー処理を担当 | ★★☆ |
| `marker-manager.js` | ミニマップのラインマーカーを管理 | ★★★ |
| `diff-detector.js` | ブロック単位の差分検出とブロックマーカーを管理 | ★★★ |
| `navigation.js` | 差分ナビゲーション全体を制御 | ★★★ |
| `event-manager.js` | ドラッグ＆ドロップ・ボタンのイベントを管理 | ★★☆ |
| `ui.js` | 画面表示の切り替えを担当 | ★☆☆ |
| `utils.js` | 共通ユーティリティ関数 | ★☆☆ |
| `main.js` | アプリの起動・全モジュールの統合 | ★★☆ |

---

## 設計上の判断

### なぜ Vanilla JS（フレームワークなし）を選んだか
React や Vue などのフレームワークを使わず、素の JavaScript で実装しています。WinMerge レポートの表示という単一目的のツールであり、外部依存を最小化してどこでも動作させることを優先しました。GitHub Pages でそのまま配信できるのもこのためです。

### なぜ ESM（モジュール形式）を採用したか
コードを機能ごとにファイルに分割し、それぞれが独立して動作するよう ESM（`import` / `export`）形式を採用しています。テストを書きやすくするという目的もあります。

### セキュリティ対策（XSS）
読み込んだ HTML ファイルをそのままブラウザに表示すると、悪意あるスクリプトが実行される危険があります（XSS攻撃）。`html-processor.js` がファイル読み込み直後に `<script>` タグや `onclick` などの危険な属性を除去します。

### メモリリーク対策
イベントリスナーを登録したら、不要になったタイミングで必ず削除するよう設計しています（`cleanup()` パターン）。特にファイルを読み直すたびに古いリスナーが残らないよう注意して実装されています。

---

## テスト

### テスト構成

```
tests/
├── config.test.js              # 定数の検証
├── errors.test.js              # エラークラスの検証
├── utils.test.js               # ユーティリティ関数の検証
├── state.test.js               # 状態管理の検証
├── error-handler.test.js       # エラーハンドリングの検証
├── file-handler.test.js        # ファイル読み込みの検証
├── html-processor.test.js      # HTMLサニタイズの検証
├── table-processor.test.js     # テーブル解析の検証
├── table-processor-extra.test.js
├── marker-manager.test.js      # マーカー管理の検証
├── diff-detector.test.js       # 差分検出の検証
├── diff-detector-extra.test.js
├── navigation.test.js          # ナビゲーションの検証
├── navigation-extra.test.js
├── block-marker-generator.test.js
├── event-manager.test.js       # イベント管理の検証
└── e2e/
    └── viewer.spec.js          # ブラウザ上での動作確認（E2Eテスト）
```

### テスト実績

| 項目 | 数値 |
|---|---|
| ユニットテスト | 286件 PASS |
| E2Eテスト | 20件 PASS |
| カバレッジ（全体） | 87.12% |

### テスト実行方法

```bash
# 依存パッケージのインストール
npm install

# ユニットテストを実行
npm test

# カバレッジレポートを生成
npx vitest run --coverage

# E2Eテストを実行（Live Serverが起動している状態で）
npx playwright test
```

---

## CI/CD

GitHub Actions でプッシュのたびに自動でテストが実行されます。

| ジョブ | 内容 |
|---|---|
| ユニットテスト | Vitest で286件のテストを実行・カバレッジレポートを生成 |
| E2Eテスト | Playwright でブラウザ上の動作を確認 |

カバレッジレポートは GitHub Actions の **Artifacts** からダウンロードできます。

---

## ローカル開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/DAIKI-AOKI/WinMerge-Report-Viewer.git
cd WinMerge-Report-Viewer

# 依存パッケージをインストール
npm install

# Live Server（VSCode拡張）でindex.htmlを開く
# または以下のコマンドで簡易サーバーを起動
npx serve . -p 5500
```

---

## 今後の予定

- [ ] 差分色カスタマイズ設定画面
- [ ] ロケーションペインを左右2つのミニマップに変更（WinMergeアプリと同様）

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| 言語 | JavaScript（Vanilla JS / ESM形式） |
| テスト（ユニット） | Vitest |
| テスト（E2E） | Playwright |
| CI/CD | GitHub Actions |
| ホスティング | GitHub Pages |
| 対応ブラウザ | Chrome / Edge（最新版） |
