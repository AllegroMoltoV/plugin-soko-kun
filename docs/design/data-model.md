# データモデル

D1 のテーブルと、掲載状態の算出規則の仕様です。スキーマの正は `migrations/` 配下の SQL ファイルで、本文書は `migrations/0001_init.sql` から `0004_download_snapshots.sql` までに対応します。算出規則の実装は `src/domain/status.ts` にあります。

## テーブルの一覧

| テーブル | 内容 |
| --- | --- |
| `plugins` | 登録されたプラグイン 1 件につき 1 行 |
| `releases` | プラグインの GitHub のリリース 1 件につき 1 行 |
| `assets` | リリースの配布物 1 件につき 1 行 |
| `scans` | `digest` とスキャナーの組 1 つにつき 1 行 |
| `submit_log` | `submit_plugin` の要求 1 件につき 1 行 |
| `rate_limit` | レート制限の集計の窓 1 つにつき 1 行 |
| `plugin_translations` | プラグインと翻訳先の言語の組 1 つにつき 1 行 |
| `plugin_images` | プラグインと画像の種類の組 1 つにつき 1 行 |
| `plugin_image_previews` | 説明の画像を持つプラグイン 1 つにつき 1 行 |
| `download_snapshots` | プラグインと日付の組 1 つにつき 1 行 |

OAuth のクライアント・認可・トークンの情報は D1 ではなく KV の `OAUTH_KV` に置きます。KV の形式は `@cloudflare/workers-oauth-provider` が管理します。

## plugins

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | 主キー | プラグイン ID。`owner/repo` を小文字にした文字列 |
| `github_repo_id` | INTEGER | NOT NULL、UNIQUE | GitHub のリポジトリ ID。重複登録の防止に使う。同期ではこの ID でリポジトリを引き直し、名前の変更と移管に追従する |
| `owner` | TEXT | NOT NULL | GitHub のリポジトリの所有者名 |
| `repo` | TEXT | NOT NULL | GitHub のリポジトリ名 |
| `summary` | TEXT | | 概要。外部データ |
| `license_spdx` | TEXT | NOT NULL | ライセンスの SPDX 識別子 |
| `category` | TEXT | NOT NULL、既定値 `other` | カテゴリ。`audio-filter`・`video-filter`・`source`・`transition`・`dock-ui`・`output`・`other` のいずれか |
| `admin_suspended` | INTEGER | NOT NULL、既定値 0 | 1 のとき管理停止 |
| `suspended_reason` | TEXT | | 管理停止の理由 |
| `removed` | INTEGER | NOT NULL、既定値 0 | 1 のとき、GitHub でリポジトリが削除または非公開になった |
| `submitter_github_id` | INTEGER | NOT NULL | 登録者の GitHub のユーザー ID |
| `releases_etag` | TEXT | | リリース一覧の取得で使う ETag |
| `images_tag` | TEXT | | 最後に画像を取得したときのリリースのタグ。最新リリースのタグと異なるときに画像を取得し直す |
| `images_hidden` | INTEGER | NOT NULL、既定値 0 | 1 のとき、管理者の判断で画像を表示も配信もしない |
| `created_at` | TEXT | NOT NULL | 登録日時 |
| `updated_at` | TEXT | NOT NULL | 行の更新日時。同期のたびに進む。画面の「更新日」には使わない |
| `last_synced_at` | TEXT | NOT NULL | 最後に同期した日時。同期の順序に使う |

## releases

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_release_id` | INTEGER | 主キー | GitHub のリリース ID |
| `plugin_id` | TEXT | NOT NULL、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `tag` | TEXT | NOT NULL | タグ名 |
| `name` | TEXT | | リリース名。外部データ |
| `commit_sha` | TEXT | NOT NULL | タグを解決したコミット SHA |
| `published_at` | TEXT | NOT NULL | 公開日時。掲載対象バージョンの選択に使う |
| `html_url` | TEXT | NOT NULL | GitHub のリリースのページの URL |
| `obs_build_version` | TEXT | | タグの時点の `buildspec.json` に書かれた、ビルドに使う OBS Studio の版。NULL は未取得、空文字列は取得したが値が無いことを表す。外部データ |

索引: `releases_plugin (plugin_id, published_at)`

## assets

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_asset_id` | INTEGER | 主キー | GitHub の配布物の ID |
| `release_id` | INTEGER | NOT NULL、`releases.github_release_id` を参照、親の削除で連鎖削除 | リリース ID |
| `name` | TEXT | NOT NULL | 配布物のファイル名。外部データ |
| `size` | INTEGER | NOT NULL | バイト数 |
| `digest` | TEXT | NOT NULL | GitHub が付けた `sha256:<16 進数>` の値 |
| `download_url` | TEXT | NOT NULL | GitHub の配布物のダウンロード URL |
| `os` | TEXT | | `windows`・`macos`・`linux` のいずれか。ソースコードの配布物は NULL |

索引: `assets_release (release_id)`

`digest` を持たない配布物は保存しません。

## scans

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `digest` | TEXT | 主キーの一部 | 照会した `digest` |
| `scanner` | TEXT | 主キーの一部。値は `malwarebazaar` | スキャナー |
| `result` | TEXT | NOT NULL、下表の値のいずれか | 検査結果 |
| `detail` | TEXT | | スキャナーの応答の要約 |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 照会した回数 |
| `scanned_at` | TEXT | | 最後に照会した日時 |

索引: `scans_pending (result, scanned_at)`

検査結果は `digest` ごとに持ちます。新しく現れた配布物は、同じ `digest` の過去の結果があっても `pending` に戻して照会し直します。新しく現れた配布物とは、配布物の ID と `digest` の組がそのプラグインの既存の配布物に無いものです。規則は [検査と同期](scanning.md) に記載します。

| `result` | 意味 |
| --- | --- |
| `pending` | 照会していない |
| `malicious` | MalwareBazaar が既知のマルウェアとして収録している |
| `not_found` | MalwareBazaar が `digest` を収録していない |
| `error` | 照会に失敗した |

`0001_init.sql` の制約は、VirusTotal を照会していたときの値 `clean`・`suspicious` と `scanner` の値 `virustotal` も許しますが、本サービスはこれらを記録しません。既存の VirusTotal の検査結果は `0005_drop_virustotal.sql` で削除しました。

## submit_log

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_user_id` | INTEGER | NOT NULL | 要求した利用者の GitHub のユーザー ID |
| `created_at` | TEXT | NOT NULL | 要求の日時 |
| `outcome` | TEXT | NOT NULL | 結果。成功は `accepted`、失敗は理由コード |

索引: `submit_log_user (github_user_id, created_at)`

`submit_plugin` のレート制限は、この表の件数で判定します。上限は利用者ごとに直近 24 時間で 10 件です。検証で失敗した要求も数えます。レート制限で拒否した要求は記録しません。

## rate_limit

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `key` | TEXT | 主キーの一部 | `<経路>:<送信元 IP アドレス>` の SHA-256 を 16 進数で表した文字列。IP アドレスをそのまま保存しない |
| `window_start` | INTEGER | 主キーの一部 | 集計の窓の開始時刻。UNIX 時刻のミリ秒を 60,000 で割って切り捨てた値 |
| `count` | INTEGER | NOT NULL | 窓の中の要求の件数 |

集計は長さ 1 分の固定窓で行います。経路ごとの上限は次のとおりです。

| 経路 | 対象のパス | 上限 |
| --- | --- | --- |
| `oauth` | `/authorize`・`/callback`・`/oauth/token`・`/oauth/register` | IP アドレスあたり 1 分 20 回 |
| `public` | `/mcp` と Web カタログ | IP アドレスあたり 1 分 120 回 |

`/.well-known/oauth-authorization-server` と `/.well-known/oauth-protected-resource` で始まる OAuth のメタデータには、レート制限を設けません。それ以外の `/.well-known/` 配下は `public` の経路として数えます。送信元 IP アドレスは要求ヘッダー `CF-Connecting-IP` から得ます。上限を超えた要求には、429 と `Retry-After: 60` を返します。60 分より前の窓の行は、Cron の定期処理で削除します。

## 掲載状態の算出規則

掲載状態は列に保存せず、問い合わせのたびに算出します。この判断は [ADR 0004](../decisions/0004-computed-listing-status.md) に記載しています。

### 検査結果の解釈

| スキャナー | `not_found` | `pending`・`error` | `malicious` |
| --- | --- | --- | --- |
| `malwarebazaar` | 確定 | 未確定 | 検出 |

MalwareBazaar の `not_found` を確定とする判断は [ADR 0005](../decisions/0005-malwarebazaar-not-found-as-clean.md) に、VirusTotal を照会先から外した判断は [ADR 0012](../decisions/0012-drop-virustotal.md) に記載しています。

### 検査済みのリリース

リリースが検査済みとなるのは、次の 2 つを両方満たすときです。

- 配布物を 1 件以上持つ。
- すべての配布物について、MalwareBazaar の結果が確定である。

### 掲載対象バージョン

掲載対象バージョンは、検査済みのリリースのうち `published_at` が最も新しいものです。それより新しく検査済みでないリリースは、検査中のリリースとして別に示します。

### プラグインの掲載状態

上から順に評価し、最初に当てはまった状態を採ります。

| 順序 | 条件 | 状態 | 理由 |
| --- | --- | --- | --- |
| 1 | `admin_suspended` が 1 | 停止 | 管理停止 |
| 2 | `removed` が 1 | 掲載終了 | GitHub での削除または非公開化 |
| 3 | いずれかのリリースのいずれかの配布物で、MalwareBazaar の結果が `malicious` | 停止 | マルウェアの検出 |
| 4 | 掲載対象バージョンがある | 掲載中 | |
| 5 | 上のいずれにも当てはまらない | 検査待ち | |

### 状態ごとの公開範囲

| 状態 | Web の一覧・`search_plugins`・サイトマップ | `get_plugin` | Web の詳細ページ |
| --- | --- | --- | --- |
| 掲載中 | 含める | すべての項目とダウンロード URL を返す | すべての項目とダウンロードボタンを表示する |
| 検査待ち | 含めない | 状態と理由だけを返し、ダウンロード URL を返さない | [画面構成](ui.md) の掲載中以外の要素だけを表示する。noindex にする |
| 停止 | 含めない | 状態と理由だけを返し、ダウンロード URL を返さない | 同上。管理停止の理由があれば表示する |
| 掲載終了 | 含めない | 状態と理由だけを返し、ダウンロード URL を返さない | 同上 |

掲載中以外の `get_plugin` の応答が含む項目は、プラグイン ID・名前・作者・GitHub のリポジトリの URL・状態・理由・案内文・詳細ページの URL です。理由の値は `admin`・`removed`・`malicious` のいずれかで、検査待ちでは `null` です。

詳細ページの noindex は、応答ヘッダー `X-Robots-Tag: noindex` で示します。

管理停止の解除は `admin_suspended` を 0 に戻すだけです。解除後の状態は、上の規則で算出します。

## plugin_translations

プラグインの概要の機械翻訳を保存します。翻訳の方針は [ADR 0010](../decisions/0010-machine-translation-of-summaries.md) に記載しています。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キーの一部、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `lang` | TEXT | 主キーの一部 | 翻訳先の言語。`ja`・`en`・`zh-Hans`・`zh-Hant`・`ko`・`pt-BR`・`es-419` のいずれか |
| `source_hash` | TEXT | NOT NULL | 翻訳に使ったモデルの名前・翻訳の指示・概要を合わせた文字列の SHA-256。概要・モデル・指示のどれかが変わると一致しなくなり、翻訳し直す |
| `text` | TEXT | NOT NULL | 翻訳した概要。外部データとして扱う。訳を採用しなかった場合は空の文字列で、画面は原文を表示する |
| `translated_at` | TEXT | NOT NULL | 翻訳した日時 |

## plugin_images

プラグインのロゴと説明の画像を保存します。取得の規則は [検査と同期](scanning.md) に、自分のドメインから配信する判断は [ADR 0011](../decisions/0011-plugin-images-hosted-by-worker.md) に記載しています。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キーの一部、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `kind` | TEXT | 主キーの一部、`logo`・`image` のいずれか | 画像の種類 |
| `blob_sha` | TEXT | NOT NULL | GitHub の blob の SHA。変わったときだけダウンロードし直す |
| `content_type` | TEXT | NOT NULL | `image/png`・`image/jpeg`・`image/gif`・`image/webp` のいずれか。先頭のバイト列から判定した値 |
| `width` | INTEGER | NOT NULL | 幅の px 数 |
| `height` | INTEGER | NOT NULL | 高さの px 数 |
| `bytes` | BLOB | NOT NULL | 画像の本体。外部データ |
| `fetched_at` | TEXT | NOT NULL | 取得した日時 |

画像は `/plugins/<owner>/<repo>/logo` と `/plugins/<owner>/<repo>/image` で配信します。URL のクエリに blob の SHA を付け、画像が変わったときに閲覧者のキャッシュを使わせないようにします。配信するのは掲載中のプラグインで、`images_hidden` が 0 のときだけです。応答には、ほかの画面と同じ `Content-Security-Policy` (`default-src 'none'` を基本とする) と `X-Content-Type-Options: nosniff` を付けます。

## plugin_image_previews

説明の画像から定期処理が作った、表示用の WebP の画像を保存します。作り方は [検査と同期](scanning.md) に記載しています。`plugin_images` の `kind` には `CHECK` の制約があり種類を足せないため、別の表にします。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キー、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `source_sha` | TEXT | NOT NULL | 元にした説明の画像の blob の SHA。`plugin_images` の値と違えば作り直す |
| `width` | INTEGER | NOT NULL | 幅の px 数 |
| `height` | INTEGER | NOT NULL | 高さの px 数 |
| `bytes` | BLOB | NOT NULL | WebP の画像の本体 |
| `made_at` | TEXT | NOT NULL | 作った日時 |

表示用の画像は `/plugins/<owner>/<repo>/preview` で配信します。配信の条件と応答ヘッダーは、説明の画像と同じです。元の画像の SHA が保存済みの値と違う行は配信しません。

## download_snapshots

プラグインの GitHub でのダウンロード数を、1 日 1 回記録します。記録の規則は [検査と同期](scanning.md) に記載しています。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キーの一部、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `day` | TEXT | 主キーの一部 | 記録した日 (UTC)。`YYYY-MM-DD` の形 |
| `total` | INTEGER | NOT NULL | 新しい順に最大 100 件のリリースのうち、下書きを除くものの配布物の `download_count` の合計 |
