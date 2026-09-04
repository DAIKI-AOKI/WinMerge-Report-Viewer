/**
 * scripts/build.js
 *
 * js/main.js を起点に、ES Modules(import/export)で分割されている
 * js/配下の全ファイルを、依存関係を解決した上で1本の通常スクリプト
 * (非module)にバンドルする。
 *
 * 目的: ブラウザは type="module" の import をオリジンをまたぐ読み込みと
 * みなし、file:// で開いた場合にCORSでブロックすることがある
 * （特にChrome/Edge）。1本の通常スクリプトにまとめることで import 自体を
 * なくし、file:// でも問題なく動作するようにする。
 *
 * 出力先: dist/bundle.js（このファイルは配布のため git に含める。
 * npm run build を毎回実行しなくても、リポジトリを clone/ZIPダウンロード
 * しただけで index.html がそのまま動く状態を保つため）
 */
import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['js/main.js'],
    bundle: true,
    minify: true, 
    outfile: 'dist/bundle.js',
    format: 'iife',
    target: 'es2020',
    logLevel: 'info',
});
