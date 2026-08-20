# WinMerge Report Viewer

WinMerge が出力した HTML 差分レポートを、より快適にレビューするためのビューアです。

> **こんな方におすすめです**: WinMerge で HTML レポートを出力し、第三者がレビュー・承認する運用がある方向け。変更管理プロセスや監査対応、文書改訂の承認フローなど、「自分でチェックする人」と「他者としてチェックする人」が分かれている現場で、レビュー担当者が差分をたどりやすくすることを目的に作っています。

## スクリーンショット

<img width="640" height="330" alt="WinMerge Report Viewer のデモ" src="https://github.com/user-attachments/assets/6d3f5990-2e76-4670-8947-2a5cef02f0b5" />

## 主な機能

- ドラッグ&ドロップでの HTM/HTML ファイル読み込み
- 差分ブロックのミニマップ（左右2ペイン・旧/新ファイル別色表示）
- 差分ブロックへのキーボード/ボタンナビゲーション
- 固定ヘッダー（スクロール時にカラム名を常時表示）
- Shift-JIS / UTF-8 自動判別
- ファイル処理中のプログレスインジケーター

## 使い方

1. `index.html` をブラウザで開く（`file://` または任意の HTTP サーバー）
2. WinMerge で生成した `.htm` / `.html` レポートをドラッグ&ドロップ、またはボタンで選択

> **制約**: 最大ファイルサイズ 10 MB。スマートフォン非対応。

## ファイル構成

```
├── index.html
├── style.css
├── js/
│   ├── main.js               # エントリーポイント・初期化
│   ├── config.js             # 設定定数
│   ├── state.js              # アプリケーション状態管理
│   ├── errors.js             # カスタムエラークラス
│   ├── error-handler.js      # エラーハンドリング
│   ├── event-manager.js      # イベントリスナー管理
│   ├── file-handler.js       # ファイル読み込み・処理オーケストレーター
│   ├── html-processor.js     # HTML サニタイズ・スタイルインポート
│   ├── table-processor.js    # 差分テーブル処理・固定ヘッダー
│   ├── diff-detector.js      # 差分ブロック検出・ミニマップマーカー生成
│   ├── navigation.js         # 差分ナビゲーション・リセット
│   ├── progress-indicator.js # プログレス表示
│   ├── ui.js                 # UI 表示制御
│   └── utils.js              # 汎用ユーティリティ
└── tests/
    ├── unit/                 # ユニットテスト（Vitest・Node 環境）
    ├── dom/                  # DOM テスト（Vitest・jsdom 環境）
    ├── integration/          # 統合テスト（モジュール間連携）
    └── e2e/                  # E2E テスト（Playwright）
```

## 自動テスト

[Vitest](https://vitest.dev/) によるユニット・統合テストと [Playwright](https://playwright.dev/) による E2E テストを導入しています。GitHub Actions で main ブランチへの push 時に自動実行されます。

### テストの実行

```bash
# 依存パッケージをインストール
npm install

# ユニット・統合テスト（1回実行）
npm test

# ユニット・統合テスト（ファイル変更を監視）
npm run test:watch

# カバレッジレポート付きで実行
npm run test:coverage

# E2E テスト（別途ローカルサーバーが必要）
npm run test:e2e
```

### テスト構成

| 種別 | ツール | 対象 |
|---|---|---|
| ユニットテスト | Vitest | 各モジュールの純粋ロジック |
| DOM テスト | Vitest + jsdom | DOM を伴う処理（差分検出・ミニマップ等） |
| 統合テスト | Vitest + jsdom | モジュール間の連携フロー |
| E2E テスト | Playwright | ブラウザ上での実際のユーザー操作 |

## 開発・デバッグ

URL に `?debug=true` を付けるか、`localhost` / `127.0.0.1` で開くとデバッグモードが有効になります。

```
# ブラウザコンソールで使用可能なデバッグ関数
wmv.debug.showBlocks()      # 差分ブロック統計・一覧
wmv.debug.visualizeBlocks() # ブロックを色枠で視覚化
wmv.debug.memoryStatus()    # メモリ使用量
wmv.debug.appState()        # AppState の状態
wmv.debug.all()             # 上記すべて
```

## コントリビューション

Issue・Pull Request を歓迎します。開発に参加される場合は [CONTRIBUTING.md](./CONTRIBUTING.md) をご覧ください。

## ライセンス

MIT
