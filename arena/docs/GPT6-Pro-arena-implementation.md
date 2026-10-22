# GPT6 Pro向け：専用闘技場・グラフィック・探索の実装指示書

対象は VOID PIT: BORROWED CROWN、配信ルートは `/Garbage2026/arena/`。この文書は次の改善作業への指示です。既存の基盤は実装済みですが、探索方針が数学的に最強であるという意味ではありません。

## 先に把握する現在の基盤

本編で優勝した後、専用闘技場へ入れます。5方針に共通の16桁SEED 1〜10を与え、合計50大会を実際に実行します。Workerを使い、使用できない環境では同じ `runTrial` をメイン側から試行単位で呼び出します。各試行の操作記録を再生して最終状態を照合し、優勝した候補だけを選択可能にします。各方針の代表はスコア降順、同点時は試行番号順です。

最新の指示により、対戦開始時と再戦時には、本編優勝者と挑戦者の構成を復元した後、両者のHP・MPを最大まで回復します。SPDは装備込みの素早さを保持します。相手の行動予告はプレイヤーの入力前に固定します。本編の保存記録は追加対戦から独立しています。
基本技 `wait` の表示は「めいそう」、効果はMP消費0で自分HP+15・MP+6です。すべての初期構成で使え、技枠を消費しません。数値は `src/data.json` とNode実行用の `src/data.js` にあります。回復処理は通常のHeal・RestoreMP効果で実装しており、描画側でHPを書き換えません。記録版 `VOID-PIT-WEB-2`、方針版 `1.1` を基準とし、旧版記録は受理しません。原作仕様書は履歴資料として原文を保持します。

専用の星空の闘技場背景と、女性の魔法使い・男性の剣士など人間キャラ10種類を同梱しています。キャラの見た目はSEED・方針・試行番号・方針版を使った独立したハッシュで割り当てます。同じ挑戦者は一覧、確認画面、戦闘、再戦で同じ姿です。描画によって大会や探索の乱数を進めません。見た目の職業で能力値を変更しません。
青い服の男性剣士には、ユーザー指定により瞳のハイライトを追加しています。今後生成する人間キャラも瞳の白いドットのハイライトを明示し、小さな表示で目が読めるようにしてください。修正前のPNGは `originals/history/`、編集指示は `docs/eye-highlight-edit.json` に保持しています。

## 編集場所

| 目的 | ファイル | 責務 |
|---|---|---|
| 探索の強化 | `src/arena/strategies.js` | 評価関数、戦闘手、経路、習得、買物の選択 |
| 予選と再生検証 | `src/policies.js` | 50試行の単位処理、操作上限、操作記録、対戦の状態復元 |
| 専用画面 | `src/arena/views.js` | 背景、5方針のカード、実際の進捗と勝者の表示 |
| 人間キャラと割当 | `src/arena/characters.js` | 10種類の名簿、状態を変えない外見の決定 |
| 画面遷移・Worker | `src/app.js` | `startTrials`、`challenge:`、`duel-start`、`rematch`、描画と操作 |
| 戦闘ルール | `src/engine.js` | 元仕様と共通の状態遷移。探索改善のために変更しない |
| ゲームデータ | `src/data.json` | 技・敵・品物の数値。勝率改善のために変更しない |
| X投稿文 | `src/share.js` | 勝敗・SEED・金冠／銀杯と固定記事URL |
| CSS | `src/style.css` | 専用画面・カード・戦闘枠の見た目 |
| 圧縮と配布 | `build.sh` | 画像変換、JS検証、外部ファイルへのビルド、Worker生成 |

`src/policies.js` の `POLICIES`、`POLICY_VERSION`、`policyAction` は互換窓口です。新しい判断ロジックをアプリのクリックハンドラーへ埋め込まず、`strategies.js` 内で実装してください。Workerとフォールバックが同じコードを使います。

## 探索インターフェース

```js
chooseBattleAction(run, policyIndex, independentRng) // 技ID、発動・休息は -1
chooseTournamentOperation(run, policyIndex, independentRng, trialNumber) // コマンド文字列
runTrial(policyIndex, trialNumber, seedHex16) // 実際の試行結果
```

`chooseBattleAction` と `chooseTournamentOperation` は渡された本番状態を変更しません。子状態は `clone` し、共通の `operation` で進めます。乱択は渡された独立LCGだけを使い、`Math.random` や大会LCGを探索へ流用しません。通常技、予約、休息、無効操作の扱いは共通エンジンに従います。

`runTrial` は最大512操作と停滞検知を持ちます。結果には方針、方針版、試行、SEED、方針SEED、勝敗、スコア、操作記録、再生済み状態が入ります。上限・エラー・通常敗北を優勝へ変換してはいけません。判断内容を変えたら `STRATEGY_VERSION` を更新します。

探索の詳細な改善手順、評価関数、上限、比較用SEED集合、過学習対策、採用条件は `docs/GPT6-strongest-algorithm.md` に従います。現在の5方針の性格を維持し、評価関数、経路、習得、装備を一度に全部変えず、効果を比較できる単位で改善してください。

原作のBUG-01（通常技の完全名入力）とBUG-02（直近6件の監査）を勝手に修正しません。Xの金冠／銀杯文面は最終報酬に従うだけで、全行動を検査する新しい不正判定ではありません。
`--verify` のC++比較は、元ソースを変更せず、一時コピーの技データにめいそうのHP+15だけを追加します。独立した既存C++処理と新版JSの全状態を比較し、原作CLIのself-testも別に実行します。旧ルールと新版の結果が同一だとは主張しません。

## グラフィックを差し替える手順

原本は `originals/`、配信用は `assets/` です。背景はJPEG、人物・敵の透過素材は原寸ロスレスWebPです。PNGはソースとして保持し、配信ディレクトリへコピーしません。新しい人物は、かわいい3等身の32bit時代JRPG風ドット絵、全身、左向き、透過背景、筋肉を強調しない体型で作ります。色替えだけで10種類に数えません。

背景の原本・生成記録は `docs/algorithm-arena-source.json`、10人の原本・個別プロンプトは `docs/challenger-art.json`、配信設定とハッシュは `docs/image-conversion.json` です。キャラを増減する場合は名簿、生成記録、画像件数の検証を同時に更新します。現行10人は初期画面で一括ロードせず、挑戦者の表示時に取得します。

```sh
bash arena/build.sh _site --compress-images --verify
```

これだけでPNGからの圧縮、画素の検証、JSテスト、原作比較、公開用ビルドまで実行します。ImageMagick 7は `magick mogrify`、6は `mogrify` を利用します。人物の設定は `-quality 100 -define webp:lossless=true -define webp:method=6 -define webp:exact=true`。人物は縮小しません。JPEGは品質80〜92、point縮小、4:4:4で80,000バイト以下にします。

## 検証と完成条件

ブラウザー操作をテストの主経路にしません。`tests/check.mjs` は戦闘・記録再生・50試行・対戦状態を、`tests/ui-check.mjs` は実際の画面ハンドラー、購入済み棚、投稿リンク、キャラ割当をNode.jsで検証します。`tests/worker-check.mjs` はビルドしたWorkerの50結果と直接実行結果の完全一致、`tests/image-check.mjs` は原本SHAとRGBA画素一致、`tests/layout-check.mjs` はPC配置と文字指定、`tests/package-check.mjs` は実際のビルドと配信パスを検証します。

通常ビルドはBashとNode.js 20以上、`--verify` はg++、`--compress-images` はImageMagickを追加で必要とします。npm installは不要です。原作比較を含む全処理を1つのshから実行できる構成を維持してください。

変更前後を同じSEED・方針SEED・計算上限で比較し、優勝率・報酬・スコア・残りHP/MP・打切り・計算量を保存します。改善を主張する場合は、UI予選の10SEED以外にも未使用の評価集合を用意します。表示上の「勝利」だけを成功の証拠にしません。

最後に再ビルドした `arena/`、PNG原本、ソース、検証結果、指示書、ルートの `.github/workflows/pages.yml` をZIPで渡します。1つのHTMLに画像や音を埋め込みません。GitHubへは依頼された場合にのみ公開してください。
