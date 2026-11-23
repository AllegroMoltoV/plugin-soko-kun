# CI と配備

GitHub Actions のワークフローの目的と権限、依存の更新、本番の配備の手順です。ワークフローは `.github/workflows/` に、Dependabot の設定は `.github/dependabot.yml` にあります。

## ワークフローの一覧

| ファイル | 目的 | 起動の条件 | 権限 |
| --- | --- | --- | --- |
| `ci.yml` | 静的検査とテスト、ワークフローの検査、依存の脆弱性の検査 | PR、`main` への push | `contents: read` |
| `codeql.yml` | CodeQL によるコードの脆弱性の検査 | PR、`main` への push、毎週月曜 04:23 UTC | ワークフローは `contents: read`。ジョブに `security-events: write` と `actions: read` を加える |
| `deploy.yml` | 本番への D1 のマイグレーションの適用と Worker の配備、MCP Registry への公開 | 手動実行 `workflow_dispatch` だけ | ワークフローは `contents: read`。ジョブ `deploy` は environment `production` の秘密情報を使う。ジョブ `publish-registry` だけに `id-token: write` を加える |
| `verify.yaml` | 配布物の証明の署名の検証と、新しい版のソースからの通信の API の検出。結果を Worker の受け口へ送る ([検査と同期](../design/scanning.md)) | 15 分ごとの `schedule` と、Worker の定期処理からの `workflow_dispatch` | ワークフローは `contents: read`。受け口と通信するジョブ `prepare` と `report` だけに `id-token: write` を加える |

### ci.yml

`ci.yml` は 3 つのジョブを持ちます。同じブランチで新しい実行が始まると、古い実行を取り消します。

| ジョブ | 内容 |
| --- | --- |
| `test` | Node.js 24 で `npm ci`・`npm run lint`・`npm run typecheck`・`npm test` を実行する |
| `actionlint` | ワークフローの記述を actionlint で検査する |
| `dependency-review` | PR だけで動く。PR が追加する依存に重大度 high 以上の脆弱性があれば失敗する |

### codeql.yml

`codeql.yml` は、`javascript-typescript` をビルドなしで解析します。結果は GitHub の Code scanning に送ります。GitHub の個人アカウントの private リポジトリでは Code scanning を使えないため、リポジトリが private の間は、解析が終わった後の結果の送信で失敗します。

### deploy.yml

`deploy.yml` は、本番の設定がそろうまで手動実行だけで起動します。実行の順序は次のとおりです。

1. `npm ci` と `npm test` を実行する。
2. `wrangler d1 migrations apply DB --remote --env production` で、本番の D1 にマイグレーションを適用する。
3. `wrangler deploy --env production` で Worker を配備する。

ジョブ `deploy` は environment `production` で動きます。配備は同時に 1 つだけ実行し、実行中の配備を取り消しません。ジョブ `deploy` が成功すると、ジョブ `publish-registry` が MCP Registry へ公開します。手順は [公式 MCP Registry への登録](mcp-registry.md) に記載しています。

### verify.yaml

`verify.yaml` は 3 つのジョブに分かれます。第三者の配布物とソースを処理するジョブ `scan` には `id-token: write` を付けません。MCP Registry は OIDC のトークンの `repository_owner` だけで `io.github.AllegroMoltoV/*` の公開権限を与えます。そのため、`scan` で動くツール (git・gh・grep・node・jq) の脆弱性を突かれた場合に、Registry の登録を書き換えられるトークンを発行させないためです。GitHub が用意する runner はジョブごとに別の仮想マシンで動くため、ジョブを分ければトークンを取る環境と第三者のデータを処理する環境を分けられます。

| ジョブ | 権限 | 内容 |
| --- | --- | --- |
| `prepare` | `contents: read`、`id-token: write` | 受け口から検証待ちの一覧を受け取り、ジョブの出力で `scan` へ渡す |
| `scan` | `contents: read` | 最初に OIDC のトークンを要求する環境変数が無いことを確かめる。配布物の取得とハッシュ、証明の検証、ソースの取得と通信の API の検出を行い、送る結果をジョブの出力で `report` へ渡す |
| `report` | `id-token: write` | `scan` の結果を解析せずにそのまま受け口へ送る。形の検証は受け口が行う |

この分け方では、`scan` を乗っ取られた場合の結果の改ざんは防げません。`report` は、`scan` が作った結果をそのまま本サービスのトークンを付けて送ります。

ジョブの出力は、次のジョブで環境変数として受け取ります。Linux の環境変数は 1 つあたり 128 KiB までのため、`scan` は結果を ASCII だけの JSON にして 100,000 バイトずつ最大 8 個の出力に分け、`report` がつなぎ直します。8 個の合計 800,000 バイトを超えるときは、送る形 (ASCII にした後) のバイト数で大きい版から順に、通信の検出の結果を `error` に置き換えます。失敗で止めると受け口に何も届かず試行の回数も増えないため、同じ一覧で失敗を繰り返し、ほかのプラグインの証明の検証まで止まるためです。

`scan` は、当たりのファイル名を受け口が受け付ける形に整えてから送ります。受け口は、改行や NUL を含むか 200 文字を超えるファイル名の当たりを捨てるためです。改行・CR・NUL は `?` に置き換え、100 文字を超える名前は末尾の 99 文字を残して先頭を `…` にします。

## fork の PR の扱い

fork から送られた PR でも安全にワークフローを動かすため、次の規則を守ります。

- PR で起動するワークフローは `pull_request` で起動します。`pull_request` では、GitHub は fork の PR に秘密情報を渡しません。
- `ci.yml` と `codeql.yml` は秘密情報を使いません。秘密情報を使うのは `deploy.yml` だけです。
- `actions/checkout` には `persist-credentials: false` を指定し、ジョブの中に GitHub のトークンを残しません。
- `pull_request_target` で起動するワークフローを追加しないでください。`pull_request_target` は、fork の PR のコードを秘密情報のある環境で動かせてしまいます。

## Actions の固定と依存の更新

ワークフローが使う Actions は、タグではなくコミット SHA で指定します。SHA の後ろには、対応する版をコメントで添えます。タグが書き換えられても、検証済みの版だけが動きます。

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

Dependabot は、毎週、次の 2 種類の更新の PR を作ります。

| 対象 | まとめ方 | 上限 |
| --- | --- | --- |
| npm | 本番の依存と開発用の依存を、それぞれ 1 つの PR にまとめる | 開いている PR は 5 件まで |
| GitHub Actions | すべての Actions を 1 つの PR にまとめる。SHA とコメントの版を更新する | 既定値 |

Dependabot の PR も CI を通してからマージします。

このほか、Dependabot alerts と Dependabot security updates を有効にしています。security updates は、脆弱性のある依存を直す PR を、毎週の更新とは別に作ります。

## Worker の設定

`deploy.yml` と管理用スクリプトの `--remote` は、`wrangler.jsonc` の `production` 環境を使います。`production` 環境には、本番の `ORIGIN`・Workers AI の呼び出しを通す AI Gateway の `AI_GATEWAY_ID`・D1 の `database_id`・KV の `id`・Workers AI の binding (`ai`)・独自ドメインの `routes` を設定します。環境ごとの設定には既定の環境の binding が引き継がれないため、`ai` も `production` 環境に書く必要があります。Cron の `triggers` と `observability` は、既定の環境から引き継がれます。

Worker の秘密情報は、`wrangler secret put` で本番の Worker に設定します。名前と用途は [認証と認可](../design/auth.md) に記載しています。

```sh
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
npx wrangler secret put MALWAREBAZAAR_AUTH_KEY --env production
npx wrangler secret put CONTACT_EMAIL --env production
npx wrangler secret put GITHUB_DISPATCH_TOKEN --env production
npx wrangler secret put DISCORD_WEBHOOK_URL --env production
```

`DISCORD_WEBHOOK_URL` は、依頼者が Discord で管理者だけが見られるチャンネルを作り、そのチャンネルの連携サービスの設定で作った webhook の URL です。URL はチャットやファイルに残さず、依頼者が直接設定します。

本番用の GitHub OAuth App の Authorization callback URL には、`<ORIGIN>/callback` を指定します。

### 証明の検証のワークフローを起動するトークン

`GITHUB_DISPATCH_TOKEN` は、Worker の定期処理が `verify.yaml` を workflow_dispatch で起動するためのトークンです。依頼者が GitHub の Settings の Developer settings で、fine-grained personal access token を次の設定で作ります。

| 項目 | 設定 |
| --- | --- |
| Resource owner | AllegroMoltoV |
| Expiration | 1 年 |
| Repository access | Only select repositories で `AllegroMoltoV/plugin-soko-kun` だけ |
| Repository permissions | Actions を Read and write。Metadata の Read は自動で付く。ほかは付けない |

作ったトークンを `npx wrangler secret put GITHUB_DISPATCH_TOKEN --env production` で設定します。期限の 2 週間前に、同じ設定で新しいトークンを作って設定し直し、古いトークンを削除します。期限が切れると起動が 401 で失敗し、証明の検証は schedule が動かない限り進みません。このとき、管理コマンド `npm run admin -- pending --remote` の `attestations_waiting` が 0 より大きいまま残ります。

## 初回の配備

GitHub の個人アカウントの private リポジトリでは、environment の承認のルールと environment の secret を使えません。そのため、リポジトリを public にする前の初回の配備は、依頼者の承認を得て、ローカルの `wrangler` で行います。`wrangler` は、`wrangler login` で得た OAuth トークンで認証します。

本番の D1 と KV が無いときは、先に作り、出力された ID を `wrangler.jsonc` の `env.production` の `d1_databases` の `database_id` と `kv_namespaces` の `id` に書きます。どちらも Cloudflare のアカウントに資源を作る操作のため、依頼者の承認を得てから行います。

```sh
npx wrangler d1 create plugin-soko-kun
npx wrangler kv namespace create OAUTH_KV
```

Worker の秘密情報は、[Worker の設定](#worker-の設定) のコマンドで設定します。値の入力は依頼者が行います。

```sh
npx wrangler d1 migrations apply DB --remote --env production
npx wrangler deploy --env production
```

配備のあと、`<ORIGIN>/` と `<ORIGIN>/mcp` が応答することを確かめます。

## public にした後に設定する項目

次の項目は、リポジトリと Cloudflare の設定です。CI からは設定しません。リポジトリの設定は、依頼者の承認を得て Claude Code が `gh` で行います。Cloudflare の API トークンは依頼者が作ります。リポジトリを public にしたら、2 回目以降の配備の前に、すべて設定します。

### リポジトリの設定

| 項目 | 設定 |
| --- | --- |
| ブランチ保護 | ruleset で `main` を保護する。ブランチの削除と force push を禁じる。PR を必須にし、マージには 1 名以上の承認と、`test`・`actionlint`・`dependency-review`・`analyze` の成功を求める。依頼者の作業で `main` へ直接 push するときに限り、`gh` で ruleset を一時的に無効にし、push の後に有効へ戻す |
| Secret scanning | 有効にする |
| Push protection | 有効にする。秘密情報を含む push を拒否する |
| Private vulnerability reporting | 有効にする。`/report` の非公開の通報の受付先である |
| environment `production` | 依頼者の承認を必須にする保護ルールを設定する。配備できるブランチを `main` に限る |

### environment production の秘密情報と変数

| 名前 | 種類 | 内容 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | environment の secret | Cloudflare の API トークン。権限は、アカウントの Workers Scripts の編集と D1 の編集、ゾーン allegromoltov.jp の Workers Routes の編集に限る。Workers Routes の編集は、独自ドメイン (`routes` の `custom_domain`) を含む配備に必要である |
| `CLOUDFLARE_ACCOUNT_ID` | environment の変数 | Cloudflare のアカウント ID |

`deploy.yml` は、`CLOUDFLARE_API_TOKEN` を `secrets` から、`CLOUDFLARE_ACCOUNT_ID` を `vars` から読みます。

## 2 回目以降の配備

1. GitHub の Actions の画面で `Deploy` を選び、`main` を指定して実行します。
2. environment `production` の承認を求められたら、依頼者が内容を確認して承認します。
3. ジョブの成功を確認します。
4. `<ORIGIN>/` と `<ORIGIN>/mcp` が応答することを確認します。
