# デプロイ
このZIPの内容をGarbageGames2026リポジトリのルートへ配置し、mainへpushすると、1つのGitHub ActionsワークフローでGitHub Pagesへ公開します。
公開先は `/GarbageGames2026/arena/`、`/GarbageGames2026/RuleRPG/`、`/GarbageGames2026/firework/`、`/GarbageGames2026/imgzip/` です。独自ドメインを設定している場合は、そのサイトの対応するパスになります。
ルートの `build.sh` は4アプリそれぞれの `build.sh` を実行し、ソースから生成した公開用ファイルだけを `_site/` へ集約します。ActionsはNode.js 22を使用し、全ビルドが成功した場合に本番GitHub Pagesへ配置します。imgzipの生成先 `zip/` は公開前に `imgzip/` へ移動します。
ソース、元画像、仕様書、テスト、ビルドスクリプトなどは各アプリのディレクトリに保持しています。これらはGitHub Pagesの公開対象に含まれません。リポジトリ自体はpublicのため、コミットしたファイルはGitHub上では閲覧できます。
元パッケージのREADME等にある旧ディレクトリ名や旧URLはそのまま保持しています。現在の配置・公開パスはこの文書のとおりです。
動作に不要な画像変換時の一時ファイル1件を除外し、元のarena用ルートワークフローは統合ワークフローへ置き換えています。各アプリ内部のサンプル・vendorのワークフローは資料として保持され、リポジトリのActionsとしては実行されません。
