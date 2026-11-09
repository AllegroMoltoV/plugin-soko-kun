# データモデル

D1 のテーブルと、掲載状態の算出規則の仕様です。スキーマの正は `migrations/` 配下の SQL ファイルで、本文書は `migrations/0001_init.sql` に対応します。算出規則の実装は `src/domain/status.ts` にあります。

## テーブルの一覧

| テーブル | 内容 |
| --- | --- |
| `plugins` | 登録されたプラグイン 1 件につき 1 行 |
| `releases` | プラグインの GitHub のリリース 1 件につき 1 行 |
| `assets` | リリースの配布物 1 件につき 1 行 |
| `scans` | `digest` とスキャナーの組 1 つにつき 1 行 |
| `submit_log` | `submit_plugin` の要求 1 件につき 1 行 |
| `rate_limit` | レート制限の集計の窓 1 つにつき 1 行 |

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
| `category` | TEXT | NOT NULL、既定値 `other` | カテゴリ |
| `admin_suspended` | INTEGER | NOT NULL、既定値 0 | 1 のとき管理停止 |
| `suspended_reason` | TEXT | | 管理停止の理由 |
| `removed` | INTEGER | NOT NULL、既定値 0 | 1 のとき、GitHub でリポジトリが削除または非公開になった |
| `submitter_github_id` | INTEGER | NOT NULL | 登録者の GitHub のユーザー ID |
| `releases_etag` | TEXT | | リリース一覧の取得で使う ETag |
| `created_at` | TEXT | NOT NULL | 登録日時 |
| `updated_at` | TEXT | NOT NULL | 更新日時 |
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
| `scanner` | TEXT | 主キーの一部、`virustotal`・`malwarebazaar` のいずれか | スキャナー |
| `result` | TEXT | NOT NULL、下表の値のいずれか | 検査結果 |
| `detail` | TEXT | | スキャナーの応答の要約 |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 照会した回数 |
| `scanned_at` | TEXT | | 最後に照会した日時 |

索引: `scans_pending (result, scanned_at)`

検査結果は `digest` ごとに持ちます。新しいリリースや `digest` の変化には、別の `digest` の結果を流用しません。

| `result` | 意味 |
| --- | --- |
| `pending` | 照会していない |
| `clean` | スキャナーが検出なしと判定した |
| `malicious` | スキャナーがマルウェアとして検出した |
| `not_found` | スキャナーが `digest` を収録していない |
| `error` | 照会に失敗した |

## submit_log

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_user_id` | INTEGER | NOT NULL | 要求した利用者の GitHub のユーザー ID |
| `created_at` | TEXT | NOT NULL | 要求の日時 |
| `outcome` | TEXT | NOT NULL | 結果。失敗した要求も記録する |

索引: `submit_log_user (github_user_id, created_at)`

`submit_plugin` のレート制限は、この表の件数で判定します。上限は利用者ごとに 1 日 10 件です。

## rate_limit

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `key` | TEXT | 主キーの一部 | 送信元 IP アドレスのハッシュと経路の組 |
| `window_start` | INTEGER | 主キーの一部 | 集計の窓の開始時刻 |
| `count` | INTEGER | NOT NULL | 窓の中の要求の件数 |

窓の長さと経路ごとの上限は未決定です。

## 掲載状態の算出規則

掲載状態は列に保存せず、問い合わせのたびに算出します。この判断は [ADR 0004](../decisions/0004-computed-listing-status.md) に記載しています。

### 検査結果の解釈

| スキャナー | `clean` | `not_found` | `pending`・`error` | `malicious` |
| --- | --- | --- | --- | --- |
| `malwarebazaar` | 確定 | 確定 | 未確定 | 検出 |
| `virustotal` | 確定 | 未確定 | 未確定 | 検出 |

MalwareBazaar の `not_found` を確定とする判断は [ADR 0005](../decisions/0005-malwarebazaar-not-found-as-clean.md) に記載しています。VirusTotal の `not_found` の扱いは未決定で、決定までは未確定とします。未決定の論点は [ADR 0006](../decisions/0006-virustotal-not-found-undecided.md) に記載しています。

### 検査済みのリリース

リリースが検査済みとなるのは、次の 2 つを両方満たすときです。

- 配布物を 1 件以上持つ。
- すべての配布物について、両方のスキャナーの結果が確定である。

### 掲載対象バージョン

掲載対象バージョンは、検査済みのリリースのうち `published_at` が最も新しいものです。それより新しく検査済みでないリリースは、検査中のリリースとして別に示します。

### プラグインの掲載状態

上から順に評価し、最初に当てはまった状態を採ります。

| 順序 | 条件 | 状態 | 理由 |
| --- | --- | --- | --- |
| 1 | `admin_suspended` が 1 | 停止 | 管理停止 |
| 2 | `removed` が 1 | 掲載終了 | GitHub での削除または非公開化 |
| 3 | いずれかのリリースのいずれかの配布物で、どちらかのスキャナーの結果が `malicious` | 停止 | マルウェアの検出 |
| 4 | 掲載対象バージョンがある | 掲載中 | |
| 5 | 上のいずれにも当てはまらない | 検査待ち | |

### 状態ごとの公開範囲

| 状態 | Web の一覧と `search_plugins` | `get_plugin` | Web の詳細ページ |
| --- | --- | --- | --- |
| 掲載中 | 含める | すべての項目とダウンロード URL を返す | すべての項目とダウンロードボタンを表示する |
| 検査待ち | 含めない | 状態だけを返し、ダウンロード URL を返さない | 未決定 |
| 停止 | 含めない | 状態と理由だけを返し、ダウンロード URL を返さない | 名前と状態と理由だけを表示する |
| 掲載終了 | 含めない | 未決定 | 名前と状態と理由だけを表示する |

管理停止の解除は `admin_suspended` を 0 に戻すだけです。解除後の状態は、上の規則で算出します。
