# データモデル

D1 のテーブルと、掲載状態の算出規則の仕様です。スキーマの正は `migrations/` 配下の SQL ファイルで、本文書は `migrations/0001_init.sql` から `0010_release_urls_current_name.sql` までに対応します。算出規則の実装は `src/domain/status.ts` にあります。

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
| `release_checks` | 新しい版の検査とレビューの結果。リリース 1 件につき 1 行 |
| `attestation_checks` | 証明の検証の結果。配布物 1 件につき 1 行 |
| `listing_periods` | 掲載した配布物と掲載の期間。削除しない |
| `release_suspensions` | 管理者が止めた版とマルウェアを検出した版。削除しない |
| `plugin_aliases` | プラグインの旧い URL の ID 1 つにつき 1 行 |
| `check_log` | `submit_plugin` の確認のモードの要求 1 件につき 1 行 |

OAuth のクライアント・認可・トークンの情報は D1 ではなく KV の `OAUTH_KV` に置きます。KV の形式は `@cloudflare/workers-oauth-provider` が管理します。

## plugins

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | 主キー | 内部のプラグイン ID。登録したときの `owner/repo` を小文字にした文字列で、名前の変更では変えない。URL と MCP で示す ID は、現在の `owner` と `repo` を小文字にして `/` でつないだもので、名前を変えると変わる |
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
| `display_name` | TEXT | | `.soko-kun/config.json` の `name`。外部データ。NULL のときはリポジトリ名を表示する |
| `declared_os` | TEXT | | `.soko-kun/config.json` の `os` を JSON の配列で保存した値。NULL のときは宣言が無い |
| `release_workflow` | TEXT | | 初めて証明を検証できた版の、署名したワークフローのパス (例: `.github/workflows/push.yaml`) |
| `owner_changed_at` | TEXT | | 同期で所有者の変更を検出した日時。値がある間は、まだ掲載していない新しい版を管理者の確認待ちにする。管理者が版を承認すると NULL に戻す ([ADR 0015](../decisions/0015-repository-rename-and-transfer.md)) |

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

## release_checks

新しい版の検査とレビューの結果を保存します。規則は [検査と同期](scanning.md) に、項目は [審査の基準](review-criteria.md) に記載しています。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_release_id` | INTEGER | 主キー、`releases.github_release_id` を参照、親の削除で連鎖削除 | リリース ID |
| `legacy` | INTEGER | NOT NULL、既定値 0 | 1 のとき、マイグレーション `0008` の時点で保存済みのリリース。追加の条件を当てない |
| `immutable` | INTEGER | NOT NULL、既定値 0 | 1 のとき、GitHub のリリースの API の `immutable` が true |
| `base_release_id` | INTEGER | | 差分の起点にした掲載中のリリース。初めて登録した版では NULL |
| `diff_state` | TEXT | NOT NULL、既定値 `pending` | `pending`・`passed`・`held`・`skipped`・`error` のいずれか。`skipped` は起点が無いとき |
| `diff_hits` | TEXT | | 当たった乗っ取りの兆候の ID とファイルの JSON |
| `config_state` | TEXT | NOT NULL、既定値 `pending` | `.soko-kun/config.json` の判定。`pending`・`ok`・`missing`・`invalid`・`no_declared_assets` のいずれか |
| `review_state` | TEXT | NOT NULL、既定値 `pending` | `pending`・`done`・`failed` のいずれか |
| `review_attempts` | INTEGER | NOT NULL、既定値 0 | レビューを試みた回数。Workers AI の無料枠の不足と混雑は数えない |
| `review_wait_until` | TEXT | | Workers AI の無料枠を使い切ったとき、次にレビューを試す日時 (1 時間後)。それまでレビューを行わない |
| `review_json` | TEXT | | レビューの指摘の JSON。説明と該当の箇所は外部データ |
| `review_serious` | INTEGER | NOT NULL、既定値 0 | 重大な指摘の件数 |
| `reviewed_at` | TEXT | | レビューした日時 |
| `admin_approved_at` | TEXT | | 管理者が確認待ちを承認した日時。NULL は未承認 |

## attestation_checks

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_asset_id` | INTEGER | 主キー、`assets.github_asset_id` を参照、親の削除で連鎖削除 | 配布物の ID |
| `result` | TEXT | NOT NULL、既定値 `pending` | `pending`・`passed`・`failed`・`error` のいずれか |
| `reason` | TEXT | | 失敗の理由のコード |
| `signer_workflow` | TEXT | | 検証で確かめた、署名したワークフローのパス |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 検証を試みた回数 |
| `checked_at` | TEXT | | 最後に検証した日時 |

## listing_periods

掲載した配布物と、その期間を記録します。侵害が起きたときに、影響を受けた版と期間を示すために使います。他の表の削除と連鎖せず、行を削除しません。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | NOT NULL | 内部のプラグイン ID |
| `github_release_id` | INTEGER | 主キーの一部 | リリース ID |
| `digest` | TEXT | 主キーの一部 | 配布物の `digest` |
| `tag` | TEXT | NOT NULL | タグ名 |
| `asset_name` | TEXT | NOT NULL | 配布物のファイル名。外部データ |
| `started_at` | TEXT | NOT NULL | 掲載を始めた日時 |
| `ended_at` | TEXT | | 掲載を終えた日時。掲載中は NULL |

同期は、掲載対象のリリースが変わったときに、新しい掲載対象の配布物の行を足し、それまでの掲載対象の行の `ended_at` を埋めます。

## release_suspensions

管理者が止めた版と、マルウェアを検出した版を記録します。告知ページと警告の表示に使います。他の表の削除と連鎖せず、行を削除しません。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | INTEGER | 主キー | 連番 |
| `plugin_id` | TEXT | NOT NULL | 内部のプラグイン ID |
| `github_release_id` | INTEGER | NOT NULL、UNIQUE | リリース ID。同じ版を止め直すと、告知の文を書き換える |
| `tag` | TEXT | NOT NULL | タグ名 |
| `reason` | TEXT | NOT NULL | `admin`・`malicious` のいずれか |
| `note` | TEXT | | 管理者が書く告知の文 |
| `suspended_at` | TEXT | NOT NULL | 止めた日時 |

止めた版の配布物と掲載の期間は、`listing_periods` から求めます。

## plugin_aliases

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `alias` | TEXT | 主キー | 旧い URL の ID。`owner/repo` を小文字にした文字列 |
| `name` | TEXT | | 旧い `owner/repo` を、大文字と小文字を保ったまま記録した文字列。名前を変える前に作られた証明の検証に使う。マイグレーション 0009 より前の行は、現在の所有者名と `alias` のリポジトリ名から作った値 |
| `plugin_id` | TEXT | NOT NULL、`plugins.id` を参照、親の削除で連鎖削除 | 内部のプラグイン ID |
| `created_at` | TEXT | NOT NULL | 記録した日時 |

同期で `owner` か `repo` が変わったとき、変わる前の ID を記録します。旧い ID の詳細ページは新しい ID へ 301 で転送し、`get_plugin` は旧い ID も受け付けます。旧い ID は、現在の名前の一致より優先して、記録した元のプラグインに向けます。旧い名前に別のリポジトリが作られても、旧い URL の行き先を変えないためです。

## check_log

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_user_id` | INTEGER | NOT NULL | 要求した利用者の GitHub のユーザー ID |
| `created_at` | TEXT | NOT NULL | 要求の日時 |

確認のモードの上限は、利用者ごとに直近 24 時間で 5 件です。

## 掲載状態の算出規則

掲載状態は列に保存せず、問い合わせのたびに算出します。この判断は [ADR 0004](../decisions/0004-computed-listing-status.md) に記載しています。

### 検査結果の解釈

| スキャナー | `not_found` | `pending`・`error` | `malicious` |
| --- | --- | --- | --- |
| `malwarebazaar` | 確定 | 未確定 | 検出 |

MalwareBazaar の `not_found` を確定とする判断は [ADR 0005](../decisions/0005-malwarebazaar-not-found-as-clean.md) に、VirusTotal を照会先から外した判断は [ADR 0012](../decisions/0012-drop-virustotal.md) に記載しています。

### 検査済みのリリース

リリースが検査済みとなるのは、次をすべて満たすときです。

- 配布物を 1 件以上持つ。
- すべての配布物について、MalwareBazaar の結果が確定である。
- `release_suspensions` に記録されていない。

`release_checks` の `legacy` が 0 のリリースは、さらに次をすべて満たす必要があります。

- `immutable` が 1 である。
- 配布物に、拡張子が `.exe` か `.msi` のものが無い。
- すべての配布物の `attestation_checks` の結果が `passed` である。
- `config_state` が `ok` か `missing` である。
- `diff_state` が `passed` か `skipped` である。または `admin_approved_at` がある。
- `review_state` が `done` で `review_serious` が 0 である。または `admin_approved_at` がある。

### 掲載対象バージョン

掲載対象バージョンは、検査済みのリリースのうち `published_at` が最も新しいものです。それより新しく検査済みでないリリースは、作者向けの `list_my_plugins` にだけ示し、エンドユーザー向けの画面と MCP のツールには示しません。

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
| 掲載中 | 含める | 掲載対象バージョンの項目とダウンロード URL を返す | 掲載対象バージョンとダウンロードボタンを表示する |
| 検査待ち | 含めない | 未登録と同じ `not_found` を返す | 404 を返す |
| 停止 | 含めない | 状態・理由・止めた版の警告を返し、ダウンロード URL を返さない | 掲載停止の警告を表示する。noindex にする |
| 掲載終了 | 含めない | 状態と理由だけを返し、ダウンロード URL を返さない | [画面構成](ui.md) の掲載中以外の要素だけを表示する。noindex にする |

検査待ちのプラグインを未登録と同じに扱うのは、エンドユーザーに検査中という分かりにくい状態を見せないためです。作者は `list_my_plugins` で状態と理由を確かめます。

掲載中のプラグインでも、`release_suspensions` に記録された版があれば、詳細ページと `get_plugin` に止めた版の警告を示します。

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
