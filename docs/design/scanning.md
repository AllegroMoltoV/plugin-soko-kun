# 検査と同期

`submit_plugin` の処理・Cron の定期処理・スキャナー・無料プランの予算の仕様です。検査を Cron で進める判断は [ADR 0007](../decisions/0007-asynchronous-scanning-with-cron.md) に記載しています。

## submit_plugin の処理

`submit_plugin` は、次の順で検証し、すべて通った場合だけ保存します。いずれかで失敗した場合は、理由コードと修正方法を構造化して返します。

| 順序 | 検証 | 失敗時 |
| --- | --- | --- |
| 1 | アクセストークンがある | 401 |
| 2 | 利用者の当日の要求が 10 件未満である。失敗した要求も数える | 拒否 |
| 3 | 入力 URL が `^https://github.com/<owner>/<repo>/?$` に一致する | 拒否 |
| 4 | `GET /repos/{owner}/{repo}` で、`permissions.admin` が `true`、`private` が `false`、`archived` が `false`、`license.spdx_id` がある | 拒否 |
| 5 | `GET /repos/{owner}/{repo}/languages` が C または C++ を含む | 拒否 |
| 6 | contents API で取得した `CMakeLists.txt` が libobs を参照する。`find_package(libobs)`、または `libobs` か `OBS::libobs` へのリンクを参照とみなす | 拒否。判定できない場合も拒否 |
| 7 | `GET /repos/{owner}/{repo}/releases/latest` のリリースが、`digest` を持つ配布物を 1 件以上含む | 拒否 |
| 8 | `github_repo_id` が未登録である | 重複として拒否 |

順序 4 の要求は利用者のトークンで送ります。順序 5 以降の GitHub API は、OAuth App の認証情報で呼び出します。タグは `GET /repos/{owner}/{repo}/commits/{tag}` でコミット SHA に解決します。

保存は `db.batch()` 1 回で行います。プラグイン・リリース・配布物と、配布物ごとに両方のスキャナーの検査結果を `pending` で書き込みます。応答は、検査待ちの状態・検査の進み方・詳細ページの URL を含みます。

### 表示用の値の推定

| 値 | 推定の規則 |
| --- | --- |
| 対応 OS | 配布物の名前に含まれる語と拡張子から推定する。語の例は `windows`・`win64`・`macos`・`ubuntu`・`linux`。ソースコードの配布物は対象外 |
| 概要 | リポジトリの description。無ければ README の冒頭の段落。いずれも外部データ |
| カテゴリ | 名前と概要に含まれる語から推定する。推定できなければ `other` |

検索では、リポジトリ名の区切り文字を除いた文字列での照合も行います。

## Cron の定期処理

Cron Trigger は `*/15 * * * *` で、15 分ごとに起動します。1 回の起動では、次の順で処理します。

| 順序 | 処理 | 1 回の起動での上限 |
| --- | --- | --- |
| 1 | VirusTotal へのハッシュ照会 | 4 件 |
| 2 | MalwareBazaar へのハッシュ照会 | 10 件 |
| 3 | 同期 | 外部呼び出しの予算の残り |
| 4 | OAuth の期限切れデータの掃除。`purgeExpiredData()` を呼ぶ | |

予算に達した時点で処理を止め、残りを次回の起動へ持ち越します。

### 同期

同期は、`last_synced_at` の古いプラグインから順に処理します。

| 項目 | 規則 |
| --- | --- |
| リポジトリの取得 | `GET /repositories/{github_repo_id}` で引き直し、名前の変更と移管に追従する |
| 削除と非公開化 | 404 または非公開のとき `removed` を 1 にする |
| リリースの取得 | `releases_etag` を使った条件付き要求で取得する |
| 新しいリリース | リリースと配布物を保存し、検査結果を `pending` で作る |
| 配布物の変化 | 配布物の ID または `digest` が変わったとき、新しい `digest` の検査結果を `pending` で作る |
| 書き込み | プラグイン 1 件の更新を `db.batch()` 1 回にまとめる |
| 失敗時 | 該当するプラグインを更新しない |
| 管理停止 | `admin_suspended` を変更しない |

処理は冪等です。同じ起動を繰り返しても、結果は変わりません。

### GitHub API の異常

GitHub API の 403・429・5xx と、レート制限のヘッダー `x-ratelimit-remaining`・`retry-after` を扱います。異常を受けたプラグインの既存の情報は変更しません。

## スキャナー

| スキャナー | 照会 | 利用条件の上限 | 未登録の扱い |
| --- | --- | --- | --- |
| VirusTotal | `GET https://www.virustotal.com/api/v3/files/{sha256}` | Public API は 1 分 4 件、1 日 500 件 | 未決定。決定までは未確定とする [ADR 0006](../decisions/0006-virustotal-not-found-undecided.md) |
| MalwareBazaar | `POST https://mb-api.abuse.ch/api/v1/` に `query=get_info` と `hash`。`Auth-Key` ヘッダーが必須 | 非営利の利用に限る。量の上限の数値は公開されていない | `clean` と同じ [ADR 0005](../decisions/0005-malwarebazaar-not-found-as-clean.md) |

VirusTotal の 1 日の照会は、15 分ごとに最大 4 件のとき 384 件です。

照会に失敗した検査結果は `error` として記録し、`attempts` を増やします。`error` からの再照会の間隔と回数の上限は未決定です。

VirusTotal の Public API の利用可否は、VirusTotal へ確認中です。

## 無料プランの予算

Cloudflare Workers の無料プランの上限に対し、本サービスは次の予算を設けます。

| 対象 | 無料プランの上限 | 本サービスの予算 |
| --- | --- | --- |
| 外部呼び出し | 1 回の起動あたり 50 件。リダイレクトも 1 件と数える | 45 件 |
| D1 のクエリ | 1 回の起動あたり 50 件。`db.batch()` は 1 件 | 50 件以内。Cron の起動にも予算を設ける |
| CPU 時間 | 1 回の起動あたり 10 ms | 配布物をダウンロードしない |
| KV の書き込み | 1 日 1,000 件 | OAuth の経路に IP アドレスごとのレート制限を設ける |
| Cron Trigger | アカウントあたり 5 個 | 1 個 |

`submit_plugin` の外部呼び出しは、配布物の数を n として 6 + 2n 件です。上限の 50 件に収まるのは n が 22 以下のとき、予算の 45 件に収まるのは n が 19 以下のときです。予算を超える数の配布物を持つリリースの扱いは未決定です。

Cron の起動での D1 のクエリの予算の値は未決定です。Cron の CPU 時間は未測定です。
