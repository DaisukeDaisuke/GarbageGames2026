# VOID PIT — UI仕様書つき闘技場
添付Arena-cliの移植版を全9戦へ拡張したコマンド戦闘ゲームです。敵は20種。第2・4・6・8戦後に技ギルドと装備ギルドへ立ち寄り、各4回利用できます。追加闘技場、操作記録の保存・復元、仕様書全文のモーダル表示を含みます。
第5戦のVOID KNIGHTからさらに先へ進み、第8戦の準決勝を経て第9戦のASTRAL DRAGONを倒すと優勝です。第6戦はSEEDで決まる隣接した2体、第7戦は選んだ枝に隣接する2体から選びます。第7戦の4体はSEEDで左右に配置され、第8戦の相手は第7戦の枝から1体に決まります。組合せは開始前の分岐図に表示します。追加キャラクターは女性魔法使い4種とモンスター6種で、既存画像に合わせた16bit風の大きなドットで個別に生成しています。
## すぐ遊ぶ
配布ZIPの `arena/` にビルド済みのページ一式を収録しました。HTML・CSS・JavaScript・Worker・画像・効果音は別ファイルです。`arena/index.html` と同じ階層のCSS・JavaScript、`assets/` を一緒に配置してください。外部CDNやAPIへ接続せず動作します。ブラウザー内保存が使えない環境では「記録」からJSONを書き出してください。
## 今回の改訂
SEEDは初回表示で16桁のランダムな16進数に決まり、UI台帳・仕様書・音設定を開いても再抽選しません。入力した値も保持します。「↻（新しいseed）」と「新しい大会へ」を選んだ時だけ新しい値にします。
「闘技場に入る」の後に、現在の装備・ステータス、勝利条件、全9戦の長さ、20ラウンドの制限、実際のアリーナ分岐図を表示します。確認ボタンを押すまで進行しません。
勝利後はオレンジ色の英語 `VICTORY!` を表示し、「次へ進む」まで画面を保持します。攻撃時は戦闘の枠だけが揺れます。「動き：控えめ」や端末のアニメーション抑制設定に対応します。
文字を一律2.5倍にする処理を削除しました。本文16px、カード見出し20px、操作ラベル14px、注記12pxを中心に、役割ごとのサイズを指定しています。画面幅・ヘッダー・入力欄・ダイアログ・余白は元の寸法、PCは複数列の配置を維持します。戦闘画面の文字サイズも従来どおりです。全技と全装備のカードは、左側の生成画像を中央へ向けてCSSでフェードさせています。
HTMLへ画像・音声を埋め込む処理を削除しました。開始画面の画像は背景とキャラクターの2枚で、技・装備のカード画像は画面に現れた時に遅延読み込みします。音声は再生時、予選Workerは追加闘技場を開いた時に読み込みます。ファイル名・URLには内容ハッシュを付けています。
装備ギルドの上部で装備を確認・解除できます。購入した品は防具欄の上の専用「購入済み」棚へ移動し、何度でも無料で装備し直せます。購入済みはカラー、未購入はモノクロ、装備中は枠も強調します。防具と装飾品は高さの異なる棚に分けています。3つの棚に同じカードUIとdragscrollを使い、ドラッグ、タッチ、左右ボタン、棚にフォーカスした時の左右キーに対応しています。
購入確認には画像、能力値、現在の装備予定との差分を表示します。最新の指示により、基本技「待機」を「めいそう」へ変更し、MP消費0でHP+15・MP+6を回復するようにしました。回復上限、SPDによる行動順、致死判定、火傷、20ラウンド制限を共通エンジンで処理します。癒しの雨・手当て・吸収など、他の技の数値はそのままです。
新規の記録形式は `VOID-PIT-WEB-5`、方針版は `1.2` です。`VOID-PIT-WEB-4` の9戦大会、`VOID-PIT-WEB-3` の10戦大会、`VOID-PIT-WEB-2` の5戦大会はそれぞれ記録時の経路で復元します。それ以前の異なる回復ルールの記録は版違いとして読み込みを止めます。ブラウザー保存先はv2を引き継ぎ、旧v1の保存領域は削除しません。
最終結果と敗北画面には、黒い横長ボックスに白い「X」の投稿ボタンがあります。公式の投稿用URLを開く通常のリンクで、連携API・外部スクリプト・自動投稿はありません。投稿案には勝敗、16桁SEED、スコアまたはラウンド、指定のQiita記事URLを含みます。金冠／銀杯で前向きな文面を変えます。原作の直近6件の監査結果に従い、全履歴を検査する新しい不正判定は加えていません。
## 配置先
GitHubリポジトリ `Garbage2026` のルートに、ZIP内の `arena/` と `.github/` を展開します。GitHub Pagesの公開URLは `/Garbage2026/arena/` です。アプリは `arena` をルートとして扱い、絶対パスのアセット参照、履歴ルーター、外部フォントは使いません。末尾スラッシュなしの `/Garbage2026/arena` は配信側のディレクトリ転送に従います。
## ビルド
通常ビルドの必要環境はBashとNode.js 20以上です。npm installは不要です。以下の1コマンドでJavaScriptテストと、分割されたページ一式の生成が完了します。画像・音声は必要なファイルを公開先へコピーします。
```sh
bash arena/build.sh
```
出力は `arena/dist/arena/` 一式です。配布済みの `arena/index.html` を更新する場合は、リポジトリルートから以下を実行します。
```sh
bash arena/build.sh .
```
出力ルートを指定できます。指定したディレクトリ内に `arena/index.html`、CSS、JavaScript、Worker、`arena/assets/` と `.nojekyll` を生成します。PNG原本とソースは公開用出力に含めません。既存の他ページは削除しません。
```sh
bash arena/build.sh _site
```
原作C++との比較まで含める場合はg++を用意して `--verify` を付けます。コンパイルも検証も同じsh内で実行します。
```sh
bash arena/build.sh _site --verify
```
画像をPNG原本から再圧縮する場合はImageMagickも用意します。通常のビルドは同梱済みJPEG・WebPを使うためImageMagick不要です。
```sh
bash arena/build.sh _site --compress-images
```
このオプションは `originals/` のPNG原本を入力に、`assets/` へ配信用ファイルを出力します。PNG原本はソースとしてバイト単位で保持します。通常・専用背景、会話枠、技、装備の33枚は80,000バイト以下のJPEGです。プレイヤー、敵20種、専用闘技場の人間10種の計31枚は原寸ロスレスWebPで、サイズ上限は適用しません。圧縮とビルドは同じshにまとめています。ImageMagick 7では `magick mogrify`、6では単独 `mogrify` を使用し、`--verify` と併用できます。
JPEGは `-filter point -resize '512x512>' -strip -sampling-factor 4:4:4 -interlace Plane -quality 83 -format jpg` のような設定です。品質80〜92、画像ごとの解像度候補から80KB以下の設定を探索します。WebPは指定どおり `-format webp -quality 100 -define webp:lossless=true -define webp:method=6 -define webp:exact=true` で変換し、縮小しません。原本とRGBA画素の完全一致も検証します。各画像の確定値は `docs/image-conversion.json` に記録します。
## GitHub Actions
ZIP最上位の `.github/workflows/pages.yml` は `arena/build.sh` を実行し、`_site` をPagesへデプロイする設定例です。リポジトリのPagesの公開元をGitHub Actionsに設定し、mainへpushするか手動実行してください。今回、実際のGitHubへのpush・デプロイは行っていません。
既に他ページ用のPages workflowがある場合は、既存のworkflowへ `bash arena/build.sh "$GITHUB_WORKSPACE/_site" --verify` を追加し、同じ公開ディレクトリを最後に1回アップロードしてください。同梱例をそのまま使う場合、公開成果物にはarenaだけが含まれます。GitHub Pagesはデプロイ単位で公開成果物を置き換えるため、他ページも公開する場合は同じ `_site` に揃える構成にしてください。
## 記事への埋め込み
```html
<iframe src="/Garbage2026/arena/" title="UI仕様書つき闘技場" width="100%" height="760" style="border:0"></iframe>
```
狭い画面ではゲーム内を縦にスクロールします。仕様書の本文と幕はiframe内部に収まります。
## 操作
敵の予告を確認して、通常攻撃・防御・めいそう・装備技3枠を手動で選びます。めいそうは初期から必ず使え、技の装備枠を消費しません。完全名コマンド入力も利用できます（めいそうの内部名は `wait`）。溜め後の発動・休息は専用ボタンで進めます。第2・4・6・8戦後は技ギルドと装備ギルドへ移動します。本編の第5戦以降は各戦闘開始時にHP+100、ASTRAL DRAGONに勝った後はHP・MPが全回復します。
キーボードはA＝攻撃、G＝防御、W＝めいそう、1・2・3＝装備技、N＝発動・休息です。入力中とモーダル表示中はショートカットを止めます。仕様書は×、黒い幕、Escapeで閉じます。スマートフォンでは「仕様」印から説明を開けます。
## 追加闘技場
本編の金冠・銀杯獲得後に入れます。5方針へ共通seed 1〜10を与え、各10試行、合計50大会をブラウザー内で実行します。勝者全員の操作記録を残し、方針ごとにスコア最大の代表を表示します。優勝時の構成を復元した後、双方のHP・MPを最大まで回復して対戦を始めます。再戦も満タンです。SPDは消費ゲージではなく装備込みの素早さなので、その値を引き継ぎます。本編記録は追加対戦の勝敗で変わりません。
専用の星空背景と、女性の魔法使い・男性の剣士など10種類の新しい人間キャラを使います。外見は対戦者のSEED・方針・試行番号・方針版からランダムに割り当て、表示や再戦で再抽選しません。外見によって能力値や戦闘乱数は変わりません。描画は `src/arena/views.js`、キャラは `src/arena/characters.js`、探索は `src/arena/strategies.js` に分離しています。
青い服の男性剣士は、画像生成モデルへ瞳のハイライト追加を指示した修正版です。修正前のPNGも `originals/history/blue-swordsman-before-highlights.png` に保存し、依頼した編集プロンプトを `docs/eye-highlight-edit.json` に記録しています。
## 制作物
`assets/` に生成画像64点を収録しています。既存の採用済み画像はそのまま保持しています。新規追加10体は16bit風の大きなドットで、髪型・服装・道具・輪郭の異なる個別デザインです。`originals/` にPNG原本を保持し、サイトからは参照しません。JPEG33枚は縮小・非可逆圧縮、人物と敵のWebP31枚は原寸・完全ロスレスです。`docs/image-conversion.json` に設定・寸法・サイズ・原本と配信用画像のSHA-256を記録しています。追加10体の個別プロンプトは `docs/expansion-prompts.json`、原本記録は `docs/expansion-art.json` です。
PNG原本も同梱するため、ZIPは公開用ファイルより大きくなります。開始画面の読込対象は `docs/build-manifest.json` の `initialFiles` と `initialUncompressedBytes` に記録し、Node.jsでビルド成果物とHTTP配信を確認しています。この値はHTTP圧縮前の合計で、ブラウザーのネットワーク計測値ではありません。人間キャラ10枚を最初からまとめてロードする処理はありません。
PNG原本は配信用64点と、従来から保持しているハイライト修正前の男性剣士・旧待機画像の計66枚です。追加10体は `originals/expansion/` にあります。めいそうの原本は `originals/skills/meditate.png`、配信用の内部参照は `skills/wait` です。
`docs/image-prompts.json`、`docs/skill-art-a.json`、`docs/skill-art-b.json`、`docs/gear-art.json` は生成プロンプトと過去の素材出力記録です。現行の配信ファイルと圧縮設定は `docs/image-conversion.json` を参照してください。前回のロスレス変換記録は `docs/image-conversion-lossless.json` に保持しています。
`src/engine.js` が共通戦闘処理、`src/policies.js` が予選と対戦の実行基盤、`src/app.js` が操作、`src/views.js` が説明・カード・ギルド画面、`src/ui-model.js` が表示用の計算、`src/style.css` が表示、`src/requirements.js` が共通仕様注記です。`src/details.json` に全20技・全10装備それぞれの詳細説明を4段落ずつ収録しています。実際のMP消費、威力、条件、補正、デメリット、乱数の有無を記載し、画面のポップアップとUI台帳へ反映します。
`docs/specification.md` は添付仕様書へ9戦拡張を反映した原本です。ここを変更して再ビルドすると、ゲーム内の全文表示へ反映されます。`docs/GPT6-Pro-arena-implementation.md` と `docs/GPT6-strongest-algorithm.md` は従来の実装・探索資料です。専用背景の記録は `docs/algorithm-arena-source.json`、追加闘技場の10人の個別プロンプトと原本ハッシュは `docs/challenger-art.json` です。
## 全経路の正規金冠検証
`node tests/all-routes.mjs` は全32経路を共通SEED 1〜10で検証します。未習得・未装備技を使わず、技ギルドと装備ギルドを各4回通って金冠を獲得し、保存した操作列から全状態を再現します。結果と320大会分の操作記録は `tests/output/all-routes.json` に保存します。全64bit SEEDを網羅したという意味ではありません。`bash build.sh --verify` にも組み込んでいます。
新規記録は `VOID-PIT-WEB-5` です。従来の `VOID-PIT-WEB-4`・`VOID-PIT-WEB-3`・`VOID-PIT-WEB-2` は記録時の経路と買物の時点で再生します。
`docs/verification.md` に確認結果、`docs/build-manifest.json` にSHA-256と素材一覧、`docs/ui-ledger.json` に共通UI台帳を収録しました。`vendor/arena-cli/` は比較対象の原作ソース、`tests/check.mjs` は原作比較と不変条件、`tests/ui-check.mjs` はブラウザーを起動せず実際のUIハンドラーを動かすJavaScriptテストです。`tests/layout-check.mjs` は元のUI寸法、PCの複数列、スマートフォン用の切替、文字指定にレイアウト変更が混入しないことを検証します。`tests/package-check.mjs` は実際にビルドしたCSS・JavaScriptで同じテストを実行し、`/Garbage2026/arena/` 配下のHTTPリンク、初期読込対象、画像・音声の分離も検証します。
## ライセンス
原作由来部分のMITライセンスと著作権表示は `LICENSE` と `vendor/arena-cli/LICENSE` に収録しています。画面内のクレジットからも確認できます。
dragscrollのMITライセンスは `vendor/dragscroll/LICENSE` に同梱しています。効果音の出典と利用条件は `docs/audio-license.md` と `docs/audio-sources.json` に記録し、ゲーム内クレジットにも表示します。
効果音はOtoLogicのRPG用セットから7点を使用しています（CC BY 4.0）。初期設定は音ONです。音が出ない場合は画面内の音設定と端末の音量を確認してください。ブラウザーが音声再生を拒否した場合も、ゲームの処理は続行します。
