# CI と配備

GitHub Actions のワークフローの目的と権限、依存の更新、本番の配備の手順です。ワークフローは `.github/workflows/` に、Dependabot の設定は `.github/dependabot.yml` にあります。

## ワークフローの一覧

| ファイル | 目的 | 起動の条件 | 権限 |
| --- | --- | --- | --- |
| `ci.yml` | 静的検査とテスト、ワークフローの検査、依存の脆弱性の検査 | PR、`main` への push | `contents: read` |
| `codeql.yml` | CodeQL によるコードの脆弱性の検査 | PR、`main` への push、毎週月曜 04:23 UTC | ワークフローは `contents: read`。ジョブに `security-events: write` と `actions: read` を加える |
| `deploy.yml` | 本番への D1 のマイグレーションの適用と Worker の配備 | 手動実行 `workflow_dispatch` だけ | `contents: read`。environment `production` の秘密情報を使う |

### ci.yml

`ci.yml` は 3 つのジョブを持ちます。同じブランチで新しい実行が始まると、古い実行を取り消します。

| ジョブ | 内容 |
| --- | --- |
| `test` | Node.js 24 で `npm ci`・`npm run lint`・`npm run typecheck`・`npm test` を実行する |
| `actionlint` | ワークフローの記述を actionlint で検査する |
| `dependency-review` | PR だけで動く。PR が追加する依存に重大度 high 以上の脆弱性があれば失敗する |

### codeql.yml

`codeql.yml` は、`javascript-typescript` をビルドなしで解析します。結果は GitHub の Code scanning に送ります。

### deploy.yml

`deploy.yml` は、本番の設定がそろうまで手動実行だけで起動します。実行の順序は次のとおりです。

1. `npm ci` と `npm test` を実行する。
2. `wrangler d1 migrations apply DB --remote --env production` で、本番の D1 にマイグレーションを適用する。
3. `wrangler deploy --env production` で Worker を配備する。

ジョブは environment `production` で動きます。配備は同時に 1 つだけ実行し、実行中の配備を取り消しません。

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

## 本番の前に依頼者が設定する項目

次の項目は、リポジトリと Cloudflare の管理画面での設定です。Claude Code や CI からは設定しません。本番の配備の前に、すべて設定します。

### リポジトリの設定

| 項目 | 設定 |
| --- | --- |
| ブランチ保護 | `main` への直接の push を禁じ、PR を必須にする。`test`・`actionlint`・`dependency-review`・`analyze` の成功をマージの条件にする |
| Secret scanning | 有効にする |
| Push protection | 有効にする。秘密情報を含む push を拒否する |
| Private vulnerability reporting | 有効にする。`/report` の非公開の通報の受付先である |
| Dependabot alerts | 有効にする |
| environment `production` | 依頼者の承認を必須にする保護ルールを設定する。配備できるブランチを `main` に限る |

### environment production の秘密情報と変数

| 名前 | 種類 | 内容 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | environment の secret | Cloudflare の API トークン。権限は Workers Scripts の編集と D1 の編集に限る |
| `CLOUDFLARE_ACCOUNT_ID` | environment の変数 | Cloudflare のアカウント ID |

`deploy.yml` は、`CLOUDFLARE_API_TOKEN` を `secrets` から、`CLOUDFLARE_ACCOUNT_ID` を `vars` から読みます。

### Worker の設定

`deploy.yml` と管理用スクリプトの `--remote` は、`wrangler.jsonc` の `production` 環境を使います。`production` 環境には、本番の `ORIGIN`・D1 の `database_id`・KV の `id` と、Workers AI の binding (`ai`) を設定します。環境ごとの設定には既定の環境の binding が引き継がれないため、`ai` も `production` 環境に書く必要があります。

Worker の秘密情報は、`wrangler secret put` で本番の Worker に設定します。名前と用途は [認証と認可](../design/auth.md) に記載しています。

```sh
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
npx wrangler secret put MALWAREBAZAAR_AUTH_KEY --env production
npx wrangler secret put CONTACT_EMAIL --env production
```

本番用の GitHub OAuth App の Authorization callback URL には、`<ORIGIN>/callback` を指定します。

## 配備の実行

1. GitHub の Actions の画面で `Deploy` を選び、`main` を指定して実行します。
2. environment `production` の承認を求められたら、依頼者が内容を確認して承認します。
3. ジョブの成功を確認します。
4. `<ORIGIN>/` と `<ORIGIN>/mcp` が応答することを確認します。
