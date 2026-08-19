# Contributing to WinMerge Report Viewer

このプロジェクトへの貢献に興味を持っていただきありがとうございます。
Issue の報告、Pull Request のどちらも歓迎します。

## Issue を立てる

- **バグ報告**: 再現手順、期待した動作、実際の動作、ブラウザ・OS の情報を記載してください。可能であれば WinMerge が出力した HTML レポート（またはその一部）を添付いただけると調査がスムーズです。
- **機能要望**: どんな場面で困っているか（例: レビュー・承認フローのどの工程か）を書いていただけると、優先度を判断しやすくなります。
- 既存の Issue と重複していないか、投稿前に一度検索をお願いします。

## 開発環境のセットアップ

```bash
git clone https://github.com/DAIKI-AOKI/WinMerge-Report-Viewer.git
cd WinMerge-Report-Viewer
npm install
```

`npm install` 時に [husky](https://typicode.github.io/husky/) の pre-commit フックが自動的に設定され、コミット時に変更したファイルへ ESLint / Stylelint / Prettier が自動実行されます（[lint-staged](https://github.com/lint-staged/lint-staged)）。

## Pull Request を送る前に

以下がすべて通ることを確認してください。

```bash
# JavaScript の静的解析
npm run lint

# CSS の静的解析
npm run lint:css

# 上記2つをまとめて実行
npm run lint:all

# ユニット・統合テスト
npm test

# カバレッジ付きで実行（任意）
npm run test:coverage

# E2E テスト（別途ローカルサーバーが必要）
npm run test:e2e
```

新しい機能やバグ修正には、対応するテストの追加・更新をお願いします。既存のテストは `tests/` 以下に、種別ごと（unit / dom / integration / e2e）に整理されています。

## コーディングスタイル

- フォーマットは [Prettier](https://prettier.io/) に従います。手動整形は不要です（`lint-staged` で自動整形されます）。
- JavaScript の構文チェックは [ESLint](https://eslint.org/)（`eslint.config.js`）、CSS は [Stylelint](https://stylelint.io/)（`.stylelintrc.json`）に従います。
- 既存のモジュール構成（`js/` 以下、機能ごとに1ファイル）に沿って追加・変更してください。

## コミットメッセージ

`種別: 内容` の形式を推奨しています（例: `fix: ○○のバグを修正`、`feat: ○○機能を追加`、`test: ○○のテストを追加`、`refactor: ○○を整理`、`docs: ○○を更新`、`chore: ○○`）。日本語・英語どちらでも構いません。

## Pull Request の流れ

1. リポジトリをフォークし、作業用ブランチを作成します。
2. 変更を実装し、上記のチェックがすべて通ることを確認します。
3. Pull Request を作成し、変更内容と動機（どんな問題を解決するか）を記載してください。
4. レビューでの指摘には可能な範囲で対応をお願いします。マージ後は不要になったブランチを削除していただけると助かります。

## ライセンス

本プロジェクトへの貢献は [MIT License](./LICENSE) の下で公開されることに同意したものとみなされます。
