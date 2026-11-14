# 検査と同期

`submit_plugin` の処理・Cron の定期処理・スキャナー・無料プランの予算の仕様です。検査を Cron で進める判断は [ADR 0007](../decisions/0007-asynchronous-scanning-with-cron.md) に記載しています。実装は `src/domain/submit.ts`・`src/domain/cron.ts`・`src/scanners.ts`・`src/budget.ts`・`src/github.ts`・`src/translate.ts`・`src/images.ts` にあります。

## submit_plugin の処理

`submit_plugin` は、次の順で検証し、すべて通った場合だけ保存します。いずれかで失敗した場合は、理由コード・説明・修正方法を構造化して返します。

| 順序 | 検証 | 失敗時の理由コード |
| --- | --- | --- |
| 1 | アクセストークンがある | 401 を返す |
| 2 | 利用者の直近 24 時間の要求が 10 件未満である | `rate_limited` |
| 3 | 入力 URL が `https://github.com/<owner>/<repo>` の形に一致する。末尾の `/` は許す | `invalid_url` |
| 4 | `GET /repos/{owner}/{repo}` でリポジトリを取得できる | `not_found` |
| 5 | `permissions.admin` が `true` である | `not_admin` |
| 6 | `private` が `false` である | `private_repository` |
| 7 | `archived` が `false` である | `archived_repository` |
| 8 | `license.spdx_id` があり、`NOASSERTION` でない | `no_license` |
| 9 | `github_repo_id` が未登録である | `duplicate` |
| 9a | 小文字にした `owner/repo` が、登録済みのプラグインの内部の ID とも、`plugin_aliases` の旧い ID とも重ならない。名前を変えたプラグインの旧い名前を、別のリポジトリに使わせないため ([ADR 0015](../decisions/0015-repository-rename-and-transfer.md)) | `name_reserved` |
| 10 | `GET /repos/{owner}/{repo}/languages` が C または C++ を含む | `not_obs_plugin` |
| 11 | contents API で取得したルートの `CMakeLists.txt` が libobs を参照する。`find_package(libobs)`、pkg-config での `pkg_check_modules` か `pkg_search_module` による `libobs` の指定、または `target_link_libraries` での `libobs` か `OBS::libobs` の指定を参照とみなす | `not_obs_plugin`。ファイルが無い場合も同じ |
| 12 | `GET /repos/{owner}/{repo}/releases/latest` で、下書きでない公開済みのリリースを取得できる | `no_release` |
| 13 | そのリリースが、`sha256:` で始まる `digest` を持つ配布物を 1 件以上含む | `no_verifiable_asset` |
| 14 | タグ名が英数字・`.`・`-`・`_` の 100 文字以内である | `unsupported_tag` |
| 15 | そのリリースの `immutable` が `true` である | `not_immutable` |
| 16 | 配布物に、拡張子が `.exe` か `.msi` のものが無い | `installer_not_allowed` |
| 17 | すべての配布物について、`GET /repos/{owner}/{repo}/attestations/{digest}` が証明を 1 件以上返す | `no_attestation` |

順序 2 の件数には、検証で失敗した要求も含めます。順序 2 で拒否した要求は件数に含めません。順序 4 より後の GitHub API が 404 を返した場合も、`not_found` を返します。GitHub API が 404 以外の異常を返した場合は `github_unavailable` を返します。入力 URL の末尾の `.git` は取り除いてから検証します。

順序 4 の要求は利用者のトークンで送ります。順序 10 以降の GitHub API は、OAuth App の認証情報で呼び出します。検証を通った後、タグを `GET /repos/{owner}/{repo}/commits/{tag}` でコミット SHA に解決します。リポジトリの description が空の場合は、`GET /repos/{owner}/{repo}/readme` で README を取得します。

### 外部呼び出しの件数

`submit_plugin` の外部呼び出しは、最大で 6 件に配布物の数を足した件数です。内訳は、リポジトリ・languages・`CMakeLists.txt`・最新リリース・タグのコミット・README の取得と、配布物ごとの証明の有無の確認です。配布物が 30 件を超えるリリースは `no_verifiable_asset` で断ります。リダイレクトを受けた場合は、リダイレクト 1 回ごとに 1 件を加えて数えます。リダイレクトを追うのは同じホストの HTTPS に限り、3 回までです。

`submit_plugin` は MalwareBazaar へ照会しません。マルウェアの照会は Cron の定期処理で行います。

### 保存

保存は `db.batch()` 1 回で行います。プラグイン・リリース・配布物と、配布物ごとに MalwareBazaar の検査結果を `pending` で書き込みます。同じ `digest` の検査結果が既にある場合も、`pending` に戻して照会し直します。

成功時の応答は、プラグイン ID・状態 `pending`・詳細ページの URL・検査する配布物の件数を含みます。順序 17 は証明の有無だけを確かめます。署名の検証は、登録のあとに下の「証明の検証の受け口」の流れで行います。

### 確認のモード

引数 `mode` が `check` のときは、登録せず、順序 3 から 17 の判定の結果を条件ごとに返します。順序 9 の重複は判定に含めません。あわせて、既定のブランチの最新のコミットのファイルで、下の「定期処理で行う検査」の順序 4 と 5 と同じレビューを行い、結果を返します。応答の形は [作者へのレビューの返し方](author-feedback.md) に記載します。上限は利用者ごとに直近 24 時間で 5 件で、`check_log` で数えます。上限を超えた要求には `rate_limited` を返します。Workers AI の無料枠の不足か混雑でレビューできなかった要求は、件数に数えません。

### 表示用の値の推定

| 値 | 推定の規則 |
| --- | --- |
| 表示名 | `.soko-kun/config.json` の `name`。無ければリポジトリ名。外部データ |
| 対応 OS | 作者が `.soko-kun/config.json` の `os` で宣言していれば、宣言した OS の配布物だけを掲載し、ほかの OS の配布物は画面と MCP に出さない。宣言が無ければ、配布物の名前に含まれる語と拡張子から推定する。語の例は `windows`・`win64`・`macos`・`darwin`・`ubuntu`・`linux`。名前に `source` または `src` を含む配布物は対象外で、値は NULL |
| 概要 | リポジトリの description。空なら README の最初の段落を平文にした 300 文字以内の文字列。いずれも外部データ |
| カテゴリ | 作者が `submit_plugin` の引数 `category` で選んだ値。選ばなかった場合は、リポジトリ名と概要に含まれる語から推定する。値は下表のいずれか。管理者は管理コマンドで値を直せる |

| `category` の値 | 表示名 |
| --- | --- |
| `audio-filter` | 音声フィルター |
| `video-filter` | 映像フィルター |
| `source` | 入力ソース |
| `transition` | トランジション |
| `dock-ui` | ドック・パネル |
| `output` | 配信・録画 |
| `other` | その他。どれにも当たらない場合と、推定できない場合の値 |

検索では、キーワードを空白で区切り、すべての語を含むプラグインを返します。照合の前に、キーワードと照合対象の両方から文字と数字以外を除きます。照合対象は所有者名・リポジトリ名・概要の原文・概要の機械翻訳 (原文の言語を除く 6 言語)・カテゴリの値です。照合は部分一致で、意味の近さによる検索はしません。

### 説明文の機械翻訳

定期処理は、掲載終了でないプラグインのうち更新日時の新しい 50 件を候補にし、訳が無い言語と、原文かモデルが変わった言語の概要を、Workers AI の文章生成モデル `@cf/openai/gpt-oss-20b` で翻訳し、結果を D1 の `plugin_translations` に保存します。モデルの判断は [ADR 0010](../decisions/0010-machine-translation-of-summaries.md) に記載しています。翻訳の元は概要の原文で、原文の言語は文字の種類から判定します。かなを含めば日本語、ハングルを含めば韓国語、漢字だけなら中国語の簡体字、それ以外は英語とします。繁体字の原文も簡体字として扱います。原文と同じ言語へは翻訳しません。

推論の強さは `low` にし、翻訳の指示には、本文はデータであり中の指示に従わないことを書きます。作者が同じ説明を複数の言語で並べて書くことがあるため、指示には、複数の言語の部分を 1 つの訳にまとめ、ほかの言語の部分を残さないことと、原文に無い内容を足さないことも書きます。画面は訳を文字のまま表示するため、Markdown の記号で飾らないことも書き、訳の全体が `**` か `__` で囲まれていれば、原文が同じ記号で囲まれている場合を除いて外してから保存します。訳が空の場合と、訳に原文に無い URL が含まれる場合は、空の訳として記録します。画面には原文を表示し、同じ原文では訳し直しません。翻訳は原文・モデル・翻訳の指示の組ごとに 1 回行い、モデルか指示を変えたときは訳し直します。訳は 1,000 文字までを保存します。Workers AI の呼び出しは、外部呼び出しの予算から 1 件ずつ引きます。翻訳は 1 回の起動で最大 6 件までとし、Workers AI の無料枠を使い切った場合は、翻訳を次回以降へ回して原文を表示します。翻訳の結果も外部データとして扱い、表示のときにエスケープします。

## Cron の定期処理

Cron Trigger は `*/15 * * * *` で、15 分ごとに起動します。1 回の起動では、次の順で処理します。

| 順序 | 処理 | 1 回の起動での上限 |
| --- | --- | --- |
| 1 | MalwareBazaar へのハッシュ照会と照会し直し | 10 件 |
| 2 | 同期 | 20 件のプラグイン。外部呼び出しの予算の残りが 6 件未満、または D1 のクエリの予算の残りが 3 件未満になった時点で止める |
| 3 | 新しい版の検査 | 1 件のリリース。外部呼び出しの予算の残りが 15 件未満なら行わない |
| 4 | ダウンロード数の記録 | 10 件のプラグイン |
| 5 | 説明文の機械翻訳 | 6 件 |
| 6 | 60 分より前の `rate_limit` の行の削除 | |
| 7 | OAuth の期限切れデータの掃除。`purgeExpiredData()` を呼ぶ | |

同期が GitHub のレート制限か障害で止まった起動では、順序 3 と 4 を行いません。予算に達した時点で処理を止め、残りを次回の起動へ持ち越します。予算による停止とレート制限による停止の後も、順序 6 と 7 を実行します。それ以外の例外で順序 1 から 5 が中断した場合、その起動は失敗として終わり、順序 6 と 7 を実行しません。

### 照会の対象

照会の対象は、結果が `pending` の検査結果と、結果が `error` で照会の回数が 5 回未満の検査結果と、下の「掲載中の配布物の照会し直し」の対象です。最後に照会した日時が無いものを先に、次に照会した日時の古いものから処理します。

MalwareBazaar の Auth-Key が設定されていない場合、照会を行いません。検査結果は `pending` のまま残り、プラグインは検査待ちのままです。

MalwareBazaar が 429 を返した場合は、その起動の照会を止めます。照会できなかった検査結果は次回の起動で処理します。

### 同期

同期の対象は、掲載終了のものを含むすべてのプラグインです。`last_synced_at` の古いものから順に処理します。掲載終了のリポジトリが GitHub で公開に戻れば、`removed` を 0 に戻します。一時的な 404 で恒久に掲載から外さないためです。同期で取得するリリースは、GitHub の最新リリースだけです。

| 項目 | 規則 |
| --- | --- |
| リポジトリの取得 | `GET /repositories/{github_repo_id}` で引き直す。所有者名・リポジトリ名を更新し、名前の変更と移管に追従する。変わったときは、変わる前の URL の ID と、大文字と小文字を保った旧い名前を `plugin_aliases` に記録する。所有者が変わったときは、`plugins` の `owner_changed_at` に日時を記録する (既に値があれば残す)。ライセンスは、GitHub が `NOASSERTION` 以外の値を返したときだけ更新する。description が空でなく、保存している概要と異なるときは、概要を description で更新する。ただし、確認待ちの新しい版があるあいだは更新しない。description が空のときは、保存している概要を残す |
| 削除と非公開化 | 404 または非公開のとき `removed` を 1 にする |
| リリースの取得 | `GET /repos/{owner}/{repo}/releases/latest` を、`releases_etag` を使った条件付き要求で送る。304 のときはリリースと配布物を変更しない |
| 対象外のリリース | 下書き・未公開・`digest` を持つ配布物が無い・タグ名が規則に合わない、のいずれかに当てはまるリリースは保存しない |
| リリースの保存 | タグをコミット SHA に解決し、リリースを追加または更新する |
| 外された配布物 | リリースから外された配布物を `assets` から削除する |
| 配布物の保存 | 配布物を追加または更新する |
| 新しく現れた配布物 | 配布物の ID と `digest` の組が、そのプラグインの既存の配布物に無い場合、検査結果を `pending` に戻す。同じ `digest` の過去の結果があっても照会し直す |
| 既知の配布物 | 配布物の ID と `digest` の組が既存の配布物にある場合、検査結果を変更しない。ダウンロード数の変化などで ETag が変わっても照会し直さない |
| 新しい版の検査の準備 | 下の「新しい版の検査」の「同期で行う判定」を行う |
| 掲載の期間 | 掲載対象のリリースが変わったとき、`listing_periods` を更新する |
| 書き込み | プラグイン 1 件の更新を `db.batch()` 1 回にまとめる |
| 管理停止 | `admin_suspended` を変更しない |
| 画像 | 下の「画像の取得」の規則で取得する |
| ビルドに使った OBS の版 | 下の「ビルドに使った OBS の版の取得」の規則で取得する |

既知の配布物を照会し直さないのは、照会の件数を抑えるためです。

処理は冪等です。同じ起動を繰り返しても、結果は変わりません。

### ビルドに使った OBS の版の取得

obs-plugintemplate を元にしたプラグインは、リポジトリの直下の `buildspec.json` の `dependencies.obs-studio.version` に、ビルドに使う OBS Studio の版を書きます。この値を、最新リリースのタグの時点で取得し、そのリリースの `obs_build_version` に保存します。取得するのは、最新リリースの `obs_build_version` が NULL のときだけです。

| 項目 | 規則 |
| --- | --- |
| 取得 | `GET /repos/{owner}/{repo}/contents/buildspec.json?ref={tag}` を `application/vnd.github.raw+json` で取得する。上限は 64 KB |
| 値の確認 | JSON として読み、`dependencies.obs-studio.version` が `数字.数字` または `数字.数字.数字` (各 1〜3 桁) の形のときだけ保存する |
| 値が無い場合 | ファイルが無い、JSON でない、値の形が合わない、上限を超える、のいずれかのときは空文字列を保存し、同じリリースでは取得し直さない |

この値は作者がビルドに使った版であり、動作を保証する範囲ではありません。そのため画面と MCP では「ビルドに使った OBS」として示し、「対応」とは書きません。

### 画像の取得

作者がリポジトリの `.soko-kun/` に置いたロゴと説明の画像を取得します。取得するのは、最新リリースのタグが前回の取得の時点から変わったときと、まだ一度も取得していないときだけです。画像はタグの時点のファイルを使うため、作者が画像を変えるには新しいリリースを公開します。

| 項目 | 規則 |
| --- | --- |
| ファイル名 | ロゴは `logo`、説明の画像は `image` に、拡張子 `.png`・`.jpg`・`.jpeg`・`.gif`・`.webp` のいずれかを付ける。大文字と小文字を区別しない |
| 一覧の取得 | `GET /repos/{owner}/{repo}/contents/.soko-kun?ref={tag}` で、ファイル名・blob の SHA・大きさを得る。404 のときは画像が無いとみなす |
| ダウンロード | blob の SHA が保存済みの画像と同じときはダウンロードしない。違うときだけ、`GET /repos/{owner}/{repo}/contents/.soko-kun/{ファイル名}?ref={tag}` を `application/vnd.github.raw+json` で取得する。取得先を `api.github.com` に限るため、一覧が返す `download_url` は使わない |
| 形式の確認 | 先頭のバイト列から PNG・JPEG・GIF・WebP のいずれかを判定する。拡張子と食い違う場合と、判定できない場合は保存しない。SVG は受け付けない |
| 大きさの上限 | ロゴは 256 KB かつ 1,024 px 四方まで。説明の画像は 1.5 MB かつ 4,096 px 四方まで。超える場合は保存しない |
| 保存 | 画像の本体・形式・幅・高さ・blob の SHA を `plugin_images` に保存する。リポジトリから消えた画像と、確認を通らなかった画像は削除する |
| 書き込み | プラグインの同期と同じ `db.batch()` にまとめる |

画像の取得の外部呼び出しは、一覧の 1 件と、ダウンロードの最大 2 件です。同期の 1 件の外部呼び出しは、画像を含めて最大 6 件になります。説明の画像の上限を 1.5 MB とするのは、D1 の 1 行の上限が 2 MB のためです。

### 説明の画像の表示用の画像

詳細ページを軽く表示できるよう、定期処理は説明の画像から表示用の WebP の画像を作り、`plugin_image_previews` に保存します。表示のときに変換はしません。

| 項目 | 規則 |
| --- | --- |
| 対象 | 保存済みの説明の画像のうち、表示用の画像が無いものと、元の画像の blob の SHA が変わったもの |
| 変換 | Cloudflare の画像の変換 (`allegromoltov.jp` のゾーンで有効、元の画像はこのゾーンに限る) を `/cdn-cgi/image/anim=false,format=webp,quality=80,width=1280/plugins/<owner>/<repo>/image?v=<blob の SHA>` で呼ぶ。`Accept` に `image/webp` を付ける。付けないと PNG が返る。アニメーションの GIF は最初のコマだけの静止画になる |
| 確認 | 応答が先頭のバイト列で WebP と判定でき、幅と高さが読めるものだけを保存する |
| 件数 | 1 回の起動で 2 件まで。外部呼び出しの予算から 1 件ずつ引く |
| 失敗 | 保存せず、次回の起動で作り直す。月 5,000 件の無料枠を超えた場合も同じ。表示用の画像が無いあいだ、詳細ページは元の画像の代わりを表示する (画面構成を参照) |

### ダウンロード数の記録

プラグインごとに 1 日 1 回、GitHub の配布物のダウンロード数を記録します。数は GitHub での全ダウンロードの数で、このサイトを経由したものに限りません。

| 項目 | 規則 |
| --- | --- |
| 対象 | 掲載終了でないプラグインのうち、その日 (UTC) の記録がまだ無いもの。記録の古いものから処理する |
| 取得 | `GET /repos/{owner}/{repo}/releases?per_page=100` を 1 回送る。返った最大 100 件のリリースのうち、下書きを除くものの配布物の `download_count` を合計する。101 件目以降のリリースは数えない |
| 保存 | プラグイン・日付・合計を `download_snapshots` に保存する。15 日より前の記録は削除する |
| 書き込み | 1 回の起動の記録を `db.batch()` 1 回にまとめる |
| 異常 | GitHub のレート制限と障害では、その起動の記録を止める。それ以外の異常 (404 を含む) を受けたプラグインは記録せず、次回の起動で処理する。掲載終了の判定は同期だけが行う |

週間のダウンロード数は、最新の記録と、7 日以上前の記録のうち最も新しいものとの差です。7 日以上前の記録が無いプラグインは、週間の数を求めません。

### GitHub API の異常

GitHub API の応答は、次の規則で分類します。

| 応答 | 分類 | 同期での扱い |
| --- | --- | --- |
| 404 | 未検出 | リポジトリの取得では `removed` を 1 にする |
| 429、または `x-ratelimit-remaining` が 0 の 403 | レート制限 | その起動の同期を止める |
| 上記以外の 403、401 | 権限なし | そのプラグインの最終同期の時刻だけを進め、次のプラグインへ進む |
| 5xx などその他 | 利用不可 | その起動の同期を止める |

異常を受けたプラグインの既存の情報は変更しません。

## 新しい版の検査

[ADR 0013](../decisions/0013-release-provenance-and-review.md) の条件を確かめる処理です。項目は [審査の基準](review-criteria.md) に、掲載状態への反映は [データモデル](data-model.md) の算出規則に記載しています。同期で新しいリリースを保存したとき、`release_checks` の行を作ります。マイグレーション `0008` の時点で保存済みのリリースは `legacy` を 1 にし、以下の処理を行いません。

### 同期で行う判定

同期は、新しいリリースを保存するときに次を判定し、`release_checks` に書きます。外部呼び出しは増えません。

| 項目 | 規則 |
| --- | --- |
| 不変 | 最新リリースの API の応答の `immutable` を `immutable` に保存する |
| 配布の形 | 配布物の名前の拡張子から、Windows 向けの `.exe` と `.msi` の有無を判定する。算出規則が参照する |
| 差分の起点 | その時点の掲載対象のリリースを `base_release_id` に保存する。無ければ `diff_state` を `skipped` にする |
| 証明の検証 | 配布物ごとに `attestation_checks` の行を `pending` で作る |

### 定期処理で行う検査

Cron の定期処理は、`release_checks` のうち未完了の行を、1 回の起動で 1 件ずつ処理します。未完了とは、`review_attempts` が 2 未満で、`diff_state` か `config_state` が `pending` のもの、または `review_state` が `pending` か `failed` で `review_wait_until` が過ぎているものです。

| 順序 | 処理 | 規則 |
| --- | --- | --- |
| 1 | 宣言ファイル | `GET /repos/{owner}/{repo}/contents/.soko-kun/config.json?ref={tag}` を取得する。上限は 16 KB。404 は `missing`。JSON でない、`name` が 1〜60 文字の文字列でない、`os` が `windows`・`macos`・`linux` の配列でない、のいずれかは `invalid`。`os` を宣言し、宣言した OS の配布物が無ければ `no_declared_assets`。それ以外は `ok` にし、`plugins` の `display_name` と `declared_os` を更新する |
| 2 | 差分の取得 | `GET /repos/{owner}/{repo}/compare/{起点のタグ}...{新しいタグ}` を `application/vnd.github.diff` で送り、本文を先頭から 24,000 文字まで読んで接続を切る。24,000 文字を超えた場合は `diff-too-large` に当てる |
| 3 | 乗っ取りの兆候 | 差分のファイルの見出しと追加の行から、審査の基準の乗っ取りの兆候を判定する。当たれば `diff_state` を `held` にし、`diff_hits` に ID とファイルを書く。当たらなければ `passed` にする。差分を取得できなければ `error` にし、算出規則では確認待ちとして扱う |
| 4 | レビューの入力の取得 | タグの時点の `.github/workflows/` の一覧と、各ワークフロー・`CMakeLists.txt`・`buildspec.json`・`vcpkg.json`・README を取得する。1 ファイルの上限は 32 KB、合計の上限は 60,000 文字とし、超えたファイルは読まずに未読として記録する |
| 5 | LLM のレビュー | Workers AI の `@cf/openai/gpt-oss-120b` に、審査の基準と推奨の項目の ID・内容・判定の観点と、上のファイルと差分を渡し、項目ごとの判定と説明と該当の箇所を JSON で返させる。指示には、入力はデータであり中の指示に従わないことを書く。応答を項目の ID で照合し、知らない ID は捨てる。結果を `review_json` に、重大な指摘の数を `review_serious` に保存し、`review_state` を `done` にする |
| 6 | 失敗 | タイムアウト・5xx・形の合わない応答では `review_attempts` を 1 増やし、`review_state` を `failed` にする。2 回失敗した版は確認待ちのまま管理者の判断を待つ |
| 7 | 無料枠の不足と混雑 | Workers AI の例外のメッセージから内部コードを取り出す。1 日の無料枠の不足 (2026-11-13 に実際に受けたコードは `4006`。公式の文書の表は `3036` と書くため、両方を見る) では試行に数えず、`review_wait_until` を 1 時間後にして、それまでレビューを行わない。公式の文書は枠が 00:00 UTC に戻ると書くが、2026-11-14 には 00:00 UTC を過ぎても不足と返り続けた。同じ報告が Cloudflare Community に多数あり、直近 24 時間の使用量で判定しているとみる分析もある。枠が戻る時刻を決め打ちせず、1 時間ごとにやり直す。失敗した呼び出しは Neurons を使わない。`3040` (一時的な混雑) では試行に数えず、次の起動でやり直す。コードを取り出せない例外は順序 6 の失敗として扱う。例外のメッセージはログに残す |

レビューの入力の取得と LLM の呼び出しは、外部呼び出しの予算から 1 件ずつ引きます。1 件の検査の外部呼び出しは最大で 15 件です。予算の残りが 15 件未満のときは、次回の起動へ回します。

確認待ちの間は、同期で概要を description に追従させません。

### 証明の検証の受け口

証明の署名の検証は、本サービスのリポジトリの GitHub Actions のワークフロー `verify.yaml` が行います。判断は [ADR 0014](../decisions/0014-attestation-verification-in-actions.md) に記載しています。Worker は次の 2 つの経路を持ちます。

| 経路 | 内容 |
| --- | --- |
| `GET /internal/attestations/pending` | `attestation_checks` の結果が `pending` か、`error` で試行が 5 回未満の配布物を、最大 50 件返す。各件に、配布物の ID・ダウンロード URL・`digest`・リポジトリ・リポジトリ ID・旧い名前の一覧・タグ・タグのコミット・記録したリリースのワークフローを含める |
| `POST /internal/attestations/results` | 配布物ごとの結果 (`passed`・`failed`・`error`、理由のコード、署名したワークフロー) を受け取り、`attestation_checks` に書く。`plugins` の `release_workflow` が NULL で、結果が `passed` なら、署名したワークフローを記録する |

どちらの経路も、`Authorization: Bearer` の GitHub Actions の OIDC のトークンを求めます。Worker は、`https://token.actions.githubusercontent.com/.well-known/jwks` の鍵で RS256 の署名を確かめ、次をすべて満たすときだけ処理します。満たさなければ 401 を返します。

| クレーム | 値 |
| --- | --- |
| `iss` | `https://token.actions.githubusercontent.com` |
| `aud` | `soko-kun` |
| `repository` | `AllegroMoltoV/plugin-soko-kun` |
| `job_workflow_ref` | `AllegroMoltoV/plugin-soko-kun/.github/workflows/verify.yaml@refs/heads/main` |
| `exp` | 現在より後 |

ワークフローは、`gh attestation verify <配布物> --repo <リポジトリ> --source-ref refs/tags/<タグ> --source-digest <タグのコミット>` に、記録したリリースのワークフローがあれば `--signer-workflow <リポジトリ>/<ワークフローのパス>` を加えて実行します。現在の名前で通らなければ、旧い名前を新しい順に `<リポジトリ>` に入れて試します。名前を変える前に作られた証明は、作られたときの名前 (大文字と小文字の区別を含む) でしか検証に通らないためです。通った証明でも、証明書の `sourceRepositoryIdentifier` がリポジトリ ID と違えば `failed` (`repository_id_mismatch`) にします。ダウンロードした配布物の SHA-256 が `digest` と違えば `failed` にします。

ワークフローは、Worker の定期処理が workflow_dispatch で起動します。定期処理は、毎回の最後に、上の `GET /internal/attestations/pending` と同じ条件の配布物の有無を D1 で確かめます。あれば、`POST https://api.github.com/repos/AllegroMoltoV/plugin-soko-kun/actions/workflows/verify.yaml/dispatches` に `{"ref":"main"}` を送ります。同じ回の同期で見つけた配布物も、その回のうちに起動の対象になります。この起動のために、定期処理は最初に外部呼び出し 1 件と D1 のクエリ 1 件を予算から取り分けておきます。起動には秘密情報 `GITHUB_DISPATCH_TOKEN` を使い、無い環境では起動しません。起動が失敗しても定期処理は止めず、失敗をログに出します。ワークフローには 15 分ごとの schedule も残しますが、GitHub の schedule は起動しないことがあるため、予備の扱いです。

### 掲載中の配布物の照会し直し

MalwareBazaar への照会の対象に、掲載対象のリリースの配布物のうち、結果が `not_found` で最後に照会してから 7 日以上たったものを加えます。`pending` と `error` の照会を先に行い、残りの件数で照会し直します。`malicious` に変わった場合は、プラグインが停止になり、その版を `release_suspensions` に記録します。

## スキャナー

| スキャナー | 照会 | 利用条件の上限 |
| --- | --- | --- |
| MalwareBazaar | `POST https://mb-api.abuse.ch/api/v1/` に `query=get_info` と `hash`。`Auth-Key` ヘッダーが必須 | 非営利の利用に限る。量の上限の数値は公開されていない |

VirusTotal は照会先にしません。この判断は [ADR 0012](../decisions/0012-drop-virustotal.md) に記載しています。

### MalwareBazaar の判定

| 応答 | 検査結果 |
| --- | --- |
| `query_status` が `ok` | `malicious`。既知のマルウェアの検体として収録されている |
| `query_status` が `hash_not_found` | `not_found` |
| 429 | 記録しない。その起動の照会を止める |
| その他 | `error` |

MalwareBazaar の `not_found` は確定として扱い、掲載を止めません。この判断は [ADR 0005](../decisions/0005-malwarebazaar-not-found-as-clean.md) に記載しています。

照会のたびに `attempts` を 1 増やし、`scanned_at` を更新します。

## 無料プランの予算

Cloudflare Workers の無料プランの上限に対し、本サービスは次の予算を設けます。予算は `src/budget.ts` の `Budget` で数えます。

| 対象 | 無料プランの上限 | 本サービスの予算 |
| --- | --- | --- |
| 外部呼び出し | 1 回の起動あたり 50 件。リダイレクトも 1 件と数える | 45 件 |
| D1 のクエリ | 1 回の起動あたり 50 件。`db.batch()` は 1 件 | Cron の順序 1 から 5 で 45 件。順序 6 と 7 は予算の外で実行する |
| CPU 時間 | 1 回の起動あたり 10 ms | 配布物をダウンロードしない。画像は大きさの上限を設け、先頭のバイト列だけを解析する。差分は diff の形式で先頭の 24,000 文字だけを読み、JSON の compare を解析しない。証明の署名の検証は Worker で行わない |
| KV の書き込み | 1 日 1,000 件 | OAuth の経路に IP アドレスごとのレート制限を設ける |
| Cron Trigger | アカウントあたり 5 個 | 1 個 |

Cron の CPU 時間は未測定です。
