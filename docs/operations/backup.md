# バックアップと復元

本番の D1 のデータを守る手順です。D1 には、プラグイン・リリース・配布物・検査結果・管理停止・登録の記録・レート制限の記録・概要の機械翻訳・ロゴと説明の画像・ダウンロード数の記録を保存しています。プラグインの情報の正は GitHub にありますが、検査結果と管理停止は D1 にしかありません。そのため、D1 を誤って更新した場合に備えて、復元の手段を用意します。

D1 のバックアップには、自動で記録される Time Travel と、手動で取得する `wrangler d1 export` の 2 つを使います。OAuth の状態を置く KV は、どちらの対象にもなりません。

本文のコマンドの `<データベース名>` には、`wrangler.jsonc` の `production` 環境の `database_name` を指定します。`production` 環境が `wrangler.jsonc` に設定されるまで、本文のコマンドは使えません。

## Time Travel

Time Travel は、D1 が変更の履歴を自動で記録する機能です。設定は不要です。過去の任意の時点へデータベースを戻せます。

戻せる期間は、Workers Free プランで 7 日、Workers Paid プランで 30 日です。出典は Cloudflare の公式文書 [D1 の Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) で、2026-11-09 に確認しました。

### 復元の前の確認

1. 戻したい時点のブックマークを取得します。`--timestamp` には UNIX 時刻または RFC 3339 の日時を指定します。

   ```sh
   npx wrangler d1 time-travel info <データベース名> --env production --timestamp="2026-11-09T00:00:00+00:00"
   ```

2. 現在のデータを `wrangler d1 export` で保存します。手順は後述の手動のエクスポートにしたがいます。

### 復元

復元は、データベースをその場で上書きする破壊的な操作です。実行中のクエリとトランザクションは取り消され、要求元はエラーを受けます。

```sh
npx wrangler d1 time-travel restore <データベース名> --env production --timestamp="2026-11-09T00:00:00+00:00"
```

復元の出力は、復元の直前の状態を示すブックマークを含みます。復元を取り消す場合は、このブックマークを `--bookmark` に指定して再び復元します。

### 復元の後の確認

1. 指定した時点より後に行った管理コマンドの操作 (停止と再開・`set-category`・`hide-images` と `show-images`) を、`npm run admin -- show <owner/repo> --remote` で確かめます。復元で失われた操作は、やり直します。
2. 指定した時点より後に登録されたプラグインは、復元で失われます。登録者は `submit_plugin` で登録し直す必要があります。
3. リリースと配布物の情報は、Cron の同期で GitHub から取り直されます。

## 手動のエクスポート

`wrangler d1 export` は、データベースのスキーマとデータを SQL のファイルに書き出します。大きな変更の前や、Time Travel の期間より長く残したい時点で取得します。

```sh
npx wrangler d1 export <データベース名> --env production --remote --output=<保存先>/2026110901-d1.sql
```

エクスポートの実行中は、データベースへのほかの要求が待たされます。利用の少ない時間帯に実行します。

書き出したファイルは、登録者の GitHub のユーザー ID と、送信元 IP アドレスのハッシュを含みます。リポジトリの外に保存し、git の追跡対象に含めないでください。

| オプション | 内容 |
| --- | --- |
| `--table=<テーブル名>` | 指定したテーブルだけを書き出す |
| `--no-schema` | `CREATE` 文を含めず、データだけを書き出す |
| `--no-data` | データを含めず、スキーマだけを書き出す |

### エクスポートからの復元

書き出したファイルは、`wrangler d1 execute` の `--file` で投入します。ファイルは `CREATE TABLE` 文を含むため、テーブルの無い空のデータベースへ投入します。

```sh
npx wrangler d1 execute <データベース名> --env production --remote --file=<保存先>/2026110901-d1.sql
```

出典は Cloudflare の公式文書 [D1 のインポートとエクスポート](https://developers.cloudflare.com/d1/best-practices/import-export-data/) で、2026-11-09 に確認しました。
