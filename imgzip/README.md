# 画像圧縮 物理
画像を油圧プレスで縦につぶすブラウザーアプリ。GitHub Pages の `/Garbage2026/zip/` に配置するためのソースと、ビルド済みの単独HTMLを同梱しています。
## すぐに配置する
`_site/zip/index.html` が完成した配布ファイルです。既存サイトの公開ディレクトリの `zip/index.html` に置いてください。CSS、JavaScript、固定PNGサンプル、仕様書、ハッシュ用WASMはすべてこのHTMLに含まれます。画像やWASMを外部サイトから取得する処理はありません。
## ビルド
Node.js 22以上とBashを使用します。パッケージのインストールは不要です。
```sh
bash build.sh
```
出力は `_site/zip/index.html` と `_site/.nojekyll` です。`build.sh` の中でUTF-8検査、JavaScript構文検査、依存コードとサンプルと仕様書の埋め込みまで実行します。
既存サイトの公開ディレクトリを指定する場合は、引数にそのパスを渡します。ほかのページを削除せず、`zip/index.html` と `.nojekyll` を更新します。
```sh
bash build.sh ../site-output
```
HTMLはサイトのルートを前提とするアセットURLを使いません。`/Garbage2026/zip/` のほか、任意のサブディレクトリでも動作します。`/Garbage2026/zip` はGitHub Pagesが末尾スラッシュ付きURLにリダイレクトします。
## GitHub Actions
同梱の `.github/workflows/pages.yml` は、リポジトリのルートに本プロジェクトの `build.sh`、`src/`、`vendor/` を配置した場合の設定です。GitHubの Settings → Pages → Build and deployment → Source で GitHub Actions を選択します。`main` または `master` へのpush、もしくはActionsの手動実行でビルドして公開します。
**同じ `Garbage2026` リポジトリでほかのページも公開する場合、既存のPagesワークフローに `bash build.sh` を統合し、ほかのページを含んだ公開ディレクトリ全体を1つのartifactとしてデプロイしてください。** Pagesのデプロイはサイト全体を置き換えるため、`zip/` だけを別ワークフローからデプロイすると他ページが公開対象から外れます。同梱ワークフローにも合流位置のコメントを入れています。
本プロジェクトをリポジトリ内のサブディレクトリへ置く場合は、既存ワークフローから `bash path/to/project/build.sh _site` のように呼び出せます。
## 記事への埋め込み
```html
<p>画像を圧縮できます。</p>
<iframe src="/Garbage2026/zip/" title="画像圧縮 物理" width="100%" height="680" style="border:0;display:block;min-width:320px" allow="clipboard-write"></iframe>
```
独自にiframeへ `sandbox` を付ける場合、JavaScript・同一オリジン・ダウンロードが動作する権限が必要です。通常の上記コードにはsandbox制限を付けていません。
## 入出力
PNG、JPEG、WebPの静止画を読み込みます。入力は20MB以下、展開後1600万画素以下です。画像ファイルをサーバーへ送りません。
残りの高さが11～100％の場合、原画像の幅を保持し、高さを `max(1, round(原画像の高さ × 残りの高さ / 100))` にしたPNGを保存します。透明部分を保持し、画面の機械やインクは保存画像へ含めません。表示する容量は保存するBlobの実測値です。
残りの高さが10％以下の場合、原画像ファイルの全バイト列をハッシュへ変換します。ハッシュを切り詰めたり、ゼロで埋めたりしません。保存するテキストは小文字16進数だけで、BOMや末尾改行は付きません。
## ハッシュ依存関係
`hash-wasm` 4.12.0を固定して同梱しています。利用方式はCRC32、MD5、xxHash64、xxHash128だけです。各UMDファイルは必要なWASMを含み、ビルド時にWorkerのソースへ埋め込みます。xxHash64とxxHash128のseedは0です。元データごと・方式ごとに結果をキャッシュします。
原本とライセンスは [hash-wasm公式リポジトリ](https://github.com/Daninet/hash-wasm) および `vendor/LICENSE.hash-wasm` を参照してください。ライセンス本文は配布HTMLにも含まれています。
## ソース
`src/index.html` は画面のテンプレート、`src/style.css` は外観、`src/app.js` は操作・演出、`src/engine.js` は画像入出力、`src/hash-worker.js` はハッシュ計算です。`src/sample.png` は固定のサンプル原本、`src/spec.md` は提供された仕様書の原文です。仕様書はアプリ内のダイアログから読むことができます。
## 検証結果
2026年10月21日、Chromeの実ブラウザーで28項目のエンジン検証が成功しました。PNGの実寸法と透明画素、4方式の既知ハッシュ値、原ファイル全バイト列の使用、EXIFの向き補正、入力上限、アニメーション画像の拒否、計算キャンセル、Worker失敗時の回復、最小1pxを確認しています。
実際の保存ボタンから出力した内蔵サンプルの20％PNGは800×120px、37,994Bでした。MD5テキストは32Bで、BOMと末尾改行は含まれていません。これらの値は結果画面の実測表示と一致しました。
680pxのiframe内で画像選択、プレス、方式変更、保存、途中リセット、仕様書の開閉を確認しています。幅320・390・600・1000pxで横スクロールを発生させず、PNG結果とハッシュ結果の切り替えで結果枠の高さが変わりません。
GitHub Actionsのワークフローは同梱しています。GitHub上でのデプロイ実行は、この配布物の検証には含まれていません。
