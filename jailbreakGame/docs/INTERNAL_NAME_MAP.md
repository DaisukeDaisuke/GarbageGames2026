# 内部名と表示名の対応表

内部IDはセーブ・検証fixtureの参照キーです。ゲーム画面では表示名に変換します。媒体は対応OS・版・用途・形状で識別し、IDの暗記を要求しません。対応表の原本は `data/display_names.json`、変換処理は `src/display.mjs` です。

|内部ID|分類|ゲーム内の表示名|対応・形状|
|---|---|---|---|
|P01|pocs|KomaOS 1.0 / 1.1 管理者制限解除|KomaOS 1.0 / 1.1 ／ USB-A|
|P02|pocs|KomaOS 1.0 / 1.1 アプリ導入制限解除|KomaOS 1.0 / 1.1 ／ USB-A|
|P03|pocs|MiraOS 1.0 管理者制限解除|MiraOS 1.0 ／ USB-C|
|P04|pocs|KomaOS 2.0 管理者制限解除|KomaOS 2.0 ／ USB-A|
|P05|pocs|KomaOS 2.0 アプリ導入制限解除|KomaOS 2.0 ／ USB-A|
|P06|pocs|KomaOS 1.0 / 1.1 設定編集制限解除|KomaOS 1.0 / 1.1 ／ USB-A|
|P07|pocs|KomaOS 2.0 設定編集制限解除|KomaOS 2.0 ／ USB-A|
|P08|pocs|MiraOS 1.1 管理者制限解除|MiraOS 1.1 ／ USB-C|
|P09|pocs|MiraOS 1.0 アプリ導入制限解除|MiraOS 1.0 ／ USB-C|
|P10|pocs|MiraOS 1.1 アプリ導入制限解除|MiraOS 1.1 ／ USB-C|
|P11|pocs|MiraOS 1.0 設定編集制限解除|MiraOS 1.0 ／ USB-C|
|P12|pocs|MiraOS 1.1 設定編集制限解除|MiraOS 1.1 ／ USB-C|
|P13|pocs|FolioOS 1.0 管理者制限解除|FolioOS 1.0 ／ SD|
|P14|pocs|FolioOS 1.1 管理者制限解除|FolioOS 1.1 ／ SD|
|P15|pocs|FolioOS 1.0 アプリ導入制限解除|FolioOS 1.0 ／ SD|
|P16|pocs|FolioOS 1.1 アプリ導入制限解除|FolioOS 1.1 ／ SD|
|P17|pocs|FolioOS 1.0 設定編集制限解除|FolioOS 1.0 ／ SD|
|P18|pocs|FolioOS 1.1 設定編集制限解除|FolioOS 1.1 ／ SD|
|P19|pocs|ReelOS 1.0 管理者制限解除|ReelOS 1.0 ／ DVD|
|P20|pocs|ReelOS 1.1 管理者制限解除|ReelOS 1.1 ／ DVD|
|P21|pocs|ReelOS 1.0 アプリ導入制限解除|ReelOS 1.0 ／ DVD|
|P22|pocs|ReelOS 1.1 アプリ導入制限解除|ReelOS 1.1 ／ DVD|
|P23|pocs|ReelOS 1.0 設定編集制限解除|ReelOS 1.0 ／ DVD|
|P24|pocs|ReelOS 1.1 設定編集制限解除|ReelOS 1.1 ／ DVD|
|P25|pocs|HearthOS 1.0 管理者制限解除|HearthOS 1.0 ／ USB-C|
|P26|pocs|HearthOS 1.1 管理者制限解除|HearthOS 1.1 ／ USB-C|
|P27|pocs|HearthOS 1.0 アプリ導入制限解除|HearthOS 1.0 ／ USB-C|
|P28|pocs|HearthOS 1.1 アプリ導入制限解除|HearthOS 1.1 ／ USB-C|
|P29|pocs|HearthOS 1.0 設定編集制限解除|HearthOS 1.0 ／ USB-C|
|P30|pocs|HearthOS 1.1 設定編集制限解除|HearthOS 1.1 ／ USB-C|
|M01|equipment|観察レンズ||
|M02|equipment|外部画面ドック||
|M03|equipment|USB-A/C変換器||
|M04|equipment|バックアップ装置||
|M05|equipment|リカバリー装置||
|M06|equipment|読取専用救出機||
|M07|equipment|詳細診断機||
|M08|equipment|メディア複製器||
|M09|equipment|オフライン更新箱||
|M10|equipment|機能検査台||
|M11|equipment|作業記録台||
|M12|equipment|追加受付棚||
|M13|equipment|設定転写機||
|M14|equipment|メディア収納棚||
|M15|equipment|一括処理台||
|M16|equipment|返却検品トレー||
|A1|skills|買い取り：媒体2本||
|A2|skills|買い取り：機材2台||
|A3|skills|支給：携帯保全設備||
|A4|skills|買い取り：媒体4本||
|A5|skills|買い取り：機材4台||
|B1|skills|媒体：適合品の取り置き||
|B2|skills|媒体：実行予約||
|B3|skills|媒体：複合媒体||
|B4|skills|媒体：四本の取り置き||
|C1|skills|思考：次便を読む||
|C2|skills|思考：工程の仮置き||
|C3|skills|思考：脳内工程||
|C4|skills|思考：段取り上手||
|D1|skills|並行：相談を指名する||
|D2|skills|並行：配達の先行予約||
|D3|skills|並行：双卓||
|D4|skills|並行：予備媒体の製作||
|F1|skills|中央：委託評価の窓口||
|R2|skills|開始時の信用：Dの紹介状||
|R3|skills|開始時の信用：Cの紹介状||
|R4|skills|開始時の信用：Bの紹介状||
|R5|skills|開始時の信用：Aの紹介状||
|S01|services|正規制限解除||
|S02|services|正規修復||
|S03|services|正規更新||
|S04|services|画面交換||
|JOB_E_001|jobs|古い原稿を残して、管理者にしてください||
|JOB_E_002|jobs|管理者ではなく、アプリを入れられるように||
|JOB_E_003|jobs|同じシリーズですが、OSは2.0です||
|JOB_E_004|jobs|展示の色だけ、お店に合わせたい||
|JOB_E_005|jobs|映像は外へ、操作はここに残したい||
|JOB_E_006|jobs|写真整理を追加して、手帳は残してください||
|JOB_E_007|jobs|筆記だけ入れて、入口は閉めてください||
|JOB_E_008|jobs|アプリを入れてからでも、更新してからでも||
|JOB_E_009|jobs|管理者制限には一度も触れないでください||
|JOB_E_010|jobs|管理アプリを使えるところまでお願いします||
|JOB_E_011|jobs|映らない画面はそのままで構いません||
|JOB_E_012|jobs|画面とアプリ、両方を直してください||
|JOB_E_013|jobs|見本の表示にしたら、編集できない状態へ||
|JOB_E_014|jobs|写真を整理して、手元へ書き出したい||
|JOB_E_015|jobs|起動しないので、修復してから引き継ぎたい||
|JOB_E_016|jobs|新しいOSで、三つの入口を開けてください||
|JOB_E_017|jobs|色も版も、店の指定にそろえてください||
|JOB_E_018|jobs|使わなくなったアプリだけ外してください||
|JOB_E_019|jobs|予定を組み替えて、2.0で固定してください||
|JOB_E_020|jobs|編集用の機械を、展示専用へ戻してください||
|JOB_D_001|jobs|写真を残したまま管理者制限を外せますか||
|JOB_D_002|jobs|同じシリーズですが、今度のモデルは1.1でした||
|JOB_D_003|jobs|筆記アプリだけを使えるようにしてください||
|JOB_D_004|jobs|写真整理を入れたら、導入制限を戻してください||
|JOB_D_005|jobs|手帳を外して、音声メモは残したい||
|JOB_D_006|jobs|展示の色に合わせたら、編集口を閉じてください||
|JOB_D_007|jobs|案内を外の画面にも出したい||
|JOB_D_008|jobs|録音を書き出せるようにしたい||
|JOB_D_009|jobs|閉店後は別の案内を表示したい||
|JOB_D_010|jobs|管理アプリが動くところまでお願いします||
|JOB_D_011|jobs|管理・導入・表示設定をまとめて開放したい||
|JOB_D_012|jobs|アプリを入れてから更新しても大丈夫です||
|JOB_D_013|jobs|使い慣れた設定にしてから最新版へ||
|JOB_D_014|jobs|画面は暗いですが、本体は動いています||
|JOB_D_015|jobs|展示を設定して、開きっぱなしの権限を閉じたい||
|JOB_D_016|jobs|起動できる状態に戻してから、制限を外してください||
|JOB_D_017|jobs|管理者機能を閉じ、在庫メモの導入だけ開けたい||
|JOB_D_018|jobs|外部出力を管理し、一般アプリは追加できないように||
|JOB_D_019|jobs|字幕を追加し、案内の時刻だけ変えたい||
|JOB_D_020|jobs|口は新しくても、中身は前と同じです||
|JOB_C_001|jobs|予定表を管理できるように||
|JOB_C_002|jobs|同じ手帳なのに前のパッケージが効かない||
|JOB_C_003|jobs|読書メモだけ足してください||
|JOB_C_004|jobs|読みやすい配色にして鍵を戻す||
|JOB_C_005|jobs|写真を端末の中だけに閉じ込めないで||
|JOB_C_006|jobs|会場の画面へ作品を映したい||
|JOB_C_007|jobs|見本アプリだけ片付けたい||
|JOB_C_008|jobs|管理アプリは使う、追加は閉じる||
|JOB_C_009|jobs|新版にしてからアプリを追加できるように||
|JOB_C_010|jobs|更新前の設定でも引き継げますか||
|JOB_C_011|jobs|中身はいらないので起動する手帳に||
|JOB_C_012|jobs|起動しなくても録音は返してください||
|JOB_C_013|jobs|写真を救って管理者制限も外したい||
|JOB_C_014|jobs|空の実験用タブレットを作りたい||
|JOB_C_015|jobs|持ち出せない記録を端末内で整理する||
|JOB_C_016|jobs|返ってくればよい、ではありません||
|JOB_C_017|jobs|修復後も設定を変え続けたい||
|JOB_C_018|jobs|画面は外へ出せれば十分です||
|JOB_C_019|jobs|貸出用の一式を整えて閉じる||
|JOB_C_020|jobs|ネットに出せない故障端末を管理用に||
|JOB_B_001|jobs|教材機の管理者設定を引き継ぎたい||
|JOB_B_002|jobs|同じ教材機なのに昨日のDVDが使えません||
|JOB_B_003|jobs|字幕だけ足して教材を使い続けたい||
|JOB_B_004|jobs|字幕付きの映像を外のモニターへ||
|JOB_B_005|jobs|展示の見本映像を自分たちの作品に替えたい||
|JOB_B_006|jobs|管理アプリを使える音楽端末にしたい||
|JOB_B_007|jobs|OSを更新してから管理者として使いたい||
|JOB_B_008|jobs|通信せずに展示時刻の設定を更新したい||
|JOB_B_009|jobs|起動しない教材機から授業を再開したい||
|JOB_B_010|jobs|中古プレーヤーを初期化して管理用に回したい||
|JOB_B_011|jobs|内蔵画面はそのままで字幕を追加したい||
|JOB_B_012|jobs|音楽端末に紛れた在庫アプリを消したい||
|JOB_B_013|jobs|持込展示機を通信なしで設定したい||
|JOB_B_014|jobs|作品閲覧と授業用プリセットだけ整えてほしい||
|JOB_B_015|jobs|個人写真だけ残さず管理用へ引き継ぎたい||
|JOB_B_016|jobs|既存の教材と外部出力を残して更新だけ||
|JOB_B_017|jobs|開いたままの設定を整えて閉じてほしい||
|JOB_B_018|jobs|録音を一度も消さず書き出せるように||
|JOB_B_019|jobs|貸出展示機を操作しすぎない状態へ||
|JOB_B_020|jobs|巡回展示の担当者が全部調整できる一台に||
|JOB_A_001|jobs|温室の表示盤を引き継ぎたい||
|JOB_A_002|jobs|同じ表示盤ですが、版が違いました||
|JOB_A_003|jobs|在庫メモだけ入れて、入口は閉めてください||
|JOB_A_004|jobs|飲み物の一覧を店の色に||
|JOB_A_005|jobs|名前を書き換えず、同封の表示セットへ||
|JOB_A_006|jobs|照明盤の予定表だけ整理したい||
|JOB_A_007|jobs|案内音声に字幕画面も付けたい||
|JOB_A_008|jobs|棚の記録を工房の外へ持ち出せるように||
|JOB_A_009|jobs|起動しない表示器から、展示記録を残したい||
|JOB_A_010|jobs|空の予備機を管理用に作り直す||
|JOB_A_011|jobs|新版へ上げても、店の表示を残したい||
|JOB_A_012|jobs|更新後の管理アプリまで確認してください||
|JOB_A_013|jobs|展示用アプリを一つだけ片付ける||
|JOB_A_014|jobs|作品を残して、小さな展示室へ転用||
|JOB_A_015|jobs|画面が映らない機械の表示設定||
|JOB_A_016|jobs|通信せず、決まった案内だけを書き込む||
|JOB_A_017|jobs|試験用の設定を戻して、貸出用に||
|JOB_A_018|jobs|管理用の機能は残して、案内だけ直す||
|JOB_A_019|jobs|直してから、決まった配色だけ戻したい||
|JOB_A_020|jobs|閉店した売店の表示器を、次の展示へ||
|H_E_001|devices|文箱 K-101||
|H_E_002|devices|学習棚 L-11||
|H_E_003|devices|文箱 K-202 増設型||
|H_E_004|devices|色札 S-10||
|H_E_005|devices|映写橋 V-11||
|H_E_006|devices|写真簿 F-10||
|H_E_007|devices|筆机 N-11||
|H_E_008|devices|作品帳 W-12||
|H_E_009|devices|音札 T-20||
|H_E_010|devices|製本卓 B-10||
|H_E_011|devices|携箱 P-11||
|H_E_012|devices|巡回帳 R-10||
|H_E_013|devices|展札 C-20||
|H_E_014|devices|採集帳 F-11||
|H_E_015|devices|会計箱 A-10||
|H_E_016|devices|教材机 X-20||
|H_E_017|devices|方眼帳 G-10||
|H_E_018|devices|朗読机 V-11||
|H_E_019|devices|時間札 T-11||
|H_E_020|devices|展台 R-11||
|H_D_001|devices|フレームS||
|H_D_002|devices|フレームW||
|H_D_003|devices|ペンノートMini||
|H_D_004|devices|フォトテーブル||
|H_D_005|devices|ルートボイス||
|H_D_006|devices|ミニフレームStand||
|H_D_007|devices|ガイドリンク||
|H_D_008|devices|レコードスリム||
|H_D_009|devices|窓辺タイマー||
|H_D_010|devices|ワークセルGrip||
|H_D_011|devices|スタジオパネル||
|H_D_012|devices|リーフPocket||
|H_D_013|devices|ハンドオフDial||
|H_D_014|devices|タフミラー||
|H_D_015|devices|ループフレーム||
|H_D_016|devices|レセプトGate||
|H_D_017|devices|ストックSlate||
|H_D_018|devices|管理ガイドHub||
|H_D_019|devices|キューサイン||
|H_D_020|devices|コマ・フェザーC||
|H_C_001|devices|ノツ・レジャー||
|H_C_002|devices|ウケツケ・ボード||
|H_C_003|devices|マージン・リード||
|H_C_004|devices|コショ・ペーパー||
|H_C_005|devices|サンポ・スナップ||
|H_C_006|devices|ミニギャラリー・パネル||
|H_C_007|devices|ヒッキ・スレート||
|H_C_008|devices|コウボウ・レコード||
|H_C_009|devices|ボイス・スタック||
|H_C_010|devices|チドリ・ビュー||
|H_C_011|devices|リユース・ポケット||
|H_C_012|devices|キキガキ・テーブル||
|H_C_013|devices|クラ・アーカイヴ||
|H_C_014|devices|ジッケン・スクエア||
|H_C_015|devices|シリョウ・スキャン||
|H_C_016|devices|ホカン・ブック||
|H_C_017|devices|ロウドク・キューブ||
|H_C_018|devices|タナ・ワイド||
|H_C_019|devices|カシダシ・プラン||
|H_C_020|devices|シリツ・ファイル||
|H_B_001|devices|コマド教材機・内覧型||
|H_B_002|devices|コマド教材機・投映型||
|H_B_003|devices|フタバ字幕教材器||
|H_B_004|devices|ヨコナガ映像ベース||
|H_B_005|devices|トール展示台||
|H_B_006|devices|オトワ音楽コンソール||
|H_B_007|devices|シオリ教材ラック||
|H_B_008|devices|コヨミ展示塔||
|H_B_009|devices|ヒバリ講座トランク||
|H_B_010|devices|マス目映像キューブ||
|H_B_011|devices|ソトミ映像ポケット||
|H_B_012|devices|フミダン音声端末||
|H_B_013|devices|サンカク展示ケース||
|H_B_014|devices|コツブ作品教卓||
|H_B_015|devices|ミギヒラキ映像帳||
|H_B_016|devices|ワタリ研修パネル||
|H_B_017|devices|ガクフ音楽スタンド||
|H_B_018|devices|カタリ収録柱||
|H_B_019|devices|ヒラキ展示ボード||
|H_B_020|devices|タビバコ巡回展示機||
|H_A_001|devices|葉札スタンド G1||
|H_A_002|devices|葉札スタンド G2・札窓付き||
|H_A_003|devices|棚番キューブ S3||
|H_A_004|devices|喫茶メニュー T4||
|H_A_005|devices|回転札メニュー T5||
|H_A_006|devices|公演札ライトボード L6||
|H_A_007|devices|字幕つき案内ポスト V7||
|H_A_008|devices|棚卸しスレート S8||
|H_A_009|devices|小展示フレーム K9||
|H_A_010|devices|管理棚ベース S10||
|H_A_011|devices|店先カード K11||
|H_A_012|devices|園芸記録トランク G12||
|H_A_013|devices|案内レール V13||
|H_A_014|devices|作品棚フレーム K14||
|H_A_015|devices|名札サーバー T15||
|H_A_016|devices|夜間案内ランタン V16||
|H_A_017|devices|貸出植物札 G17||
|H_A_018|devices|棚番オフィス S18||
|H_A_019|devices|資料棚パネル S19||
|H_A_020|devices|巡回展示トランク K20||
|CALL01|events|最初の納品||
|CALL02|events|スマホの仕事||
|CALL03|events|SD端末と残すもの||
|CALL04|events|DVDと仕事の見せ方||
|CALL05|events|最後の一件||
|CALL06|events|次のキャリアへ||
|END_FREE|endings|ひとまず、机を離れる||
|END_TRAINING|endings|一人前の仕事人||
|END_WHITE|endings|正式な診断担当||
|END_INDEPENDENT|endings|小さな店の看板||
|END_RESEARCH|endings|不具合を、標準から直す||
|END_SUCCESSOR|endings|この工房の、次の主任||
|END_ROAMER|endings|工具箱ひとつの旅||
