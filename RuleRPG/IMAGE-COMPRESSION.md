# 画像変換の実測

1KB = 1,000 bytes。敵は全10体ロスレスWebP、背景10枚と会話枠はJPEG。PNG原本は保持。

|画像ID|PNGマスター KB|表示用 KB|形式・品質|
|---|---:|---:|---|
|museum_gate|224.631|79.867|JPEG 91 / 4:4:4|
|refund_counter|209.203|78.888|JPEG 93 / 4:4:4|
|document_archive|218.938|79.080|JPEG 90 / 4:4:4|
|appeal_office|191.707|73.242|JPEG 94 / 4:4:4|
|terms_throne|210.957|74.873|JPEG 92 / 4:4:4|
|border_checkpoint|6.228|71.860|JPEG 97 / 4:4:4|
|forest_path|9.035|77.949|JPEG 98 / 4:4:4|
|moon_bridge|4.137|74.051|JPEG 99 / 4:4:4|
|last_train_platform|2.976|68.131|JPEG 98 / 4:4:4|
|home_door|5.356|78.321|JPEG 98 / 4:4:4|
|exception_slime|20.354|16.296|lossless WebP|
|refund_mimic|22.638|19.252|lossless WebP|
|invalid_golem|26.814|21.466|lossless WebP|
|reply_ghost|16.116|13.722|lossless WebP|
|revision_king|22.186|18.234|lossless WebP|
|permit_crab|24.306|21.668|lossless WebP|
|echo_machine|18.713|16.030|lossless WebP|
|infinity_hermit|25.583|20.820|lossless WebP|
|last_train_crow|24.731|20.604|lossless WebP|
|home_lock|25.653|22.348|lossless WebP|
|dialogue_frame|130.529|77.913|JPEG 99 / 4:4:4|

表示画像合計：1,024,615 bytes。
HTMLは効果音7種、脚本、CSS、仕様書を含み、脚本の改訂に応じて容量が変わる。

背景は480×180px、会話枠は640×214pxを維持した。JPEGは品質99から順に下げ、80,000 bytes以下で最も高い値を採用している。輪郭に軽い圧縮ノイズが出る非可逆形式。敵は128×128pxで、PNGマスターとWebPを8bit RGBAへデコードして比較し、10体すべて全画素一致を確認した。

表示用データは `assets/display`。元PNGや採用前の画像を含むソースZIPの容量は、実際にゲームが読む容量とは異なる。旧版の表示用PNGコピーは保持しているが、ゲームからは参照しない。

再変換：`RPG_RECOMPRESS=1 bash build.sh`。追加背景の描画から再現：`RPG_BACKGROUNDS=1 RPG_RECOMPRESS=1 bash build.sh`。ImageMagick 7ではmagick mogrify、6ではmogrifyを使用する。
