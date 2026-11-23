# 公式 MCP Registry への登録

MCP クライアントの利用者が本サービスを見つけられるよう、本サービスの MCP サーバーを公式の MCP Registry (https://registry.modelcontextprotocol.io) に登録します。Registry の情報は、ほかの MCP サーバーの一覧にも取り込まれます。

## 登録の定義

登録の内容は、リポジトリの直下の `server.json` に置きます。本サービスは利用者の PC に導入するパッケージを持たないため、`remotes` に Streamable HTTP のエンドポイントだけを書きます。

| 項目 | 値 |
| --- | --- |
| `name` | `io.github.AllegroMoltoV/plugin-soko-kun`。`io.github.<アカウント名>/` で始まる名前は、GitHub のアカウントでの認証で所有を示せる |
| `description` | Registry の上限の 100 文字以内。宣伝の語を並べない |
| `version` | 本サービスの版。README の更新履歴、`package.json` と `package-lock.json` の `version`、`src/mcp/server.ts` の MCP の `serverInfo` の `version` にそろえる |
| `remotes` | `streamable-http` と `https://soko-kun.allegromoltov.jp/mcp` |
| `icons` | `/logo.png` (256 x 256 px) と `/logo.svg`。MCP の `serverInfo` のアイコンと同じもの |

## 登録と更新の手順

Registry への公開は、`.github/workflows/deploy.yml` の job `publish-registry` が行います。この job は job `deploy` が成功した後に動き、GitHub Actions の OIDC (`mcp-publisher login github-oidc`) で認証するため、版ごとのデバイスコードの入力が要りません。job は次の順に処理します。

1. `server.json` と `package.json` の `version` を比べ、食い違えば止めます。
2. Registry の API で、同じ名前と版の登録の有無を確かめます。登録済みなら、以降を飛ばして成功で終わります。未登録なら公開へ進みます。API の応答が 200 と 404 のどちらでもないときは止めます。
3. `mcp-publisher` を v1.8.9 に固定して取得し、cosign で Sigstore のバンドルを検証してから展開します。
4. `mcp-publisher login github-oidc` で認証し、`mcp-publisher publish` で公開します。

エンドポイント、説明、版を変えたときは、`server.json` を直し、`version` を上げてから、`deploy.yml` を実行します。公開に失敗したときは、同じ実行の job `publish-registry` だけを再実行できます。deploy は再実行しません。公開後は、`https://registry.modelcontextprotocol.io/v0/servers?search=plugin-soko-kun&version=latest` で、登録された内容を確かめます。

### 名前空間の権限

Registry は、OIDC のトークンの `repository_owner` だけから `io.github.<所有者>/*` の権限を与えます。environment、ワークフロー、ブランチは見ません。そのため、所有者のリポジトリで `id-token: write` を持つすべてのワークフローが、この名前空間の全体へ公開できます。`production` の承認は、この経路を守りません。job `publish-registry` に `environment` を付けないのは、このためです。公開は `needs` により、承認済みの deploy の後に限られます。

同じ理由で、第三者のデータを処理するジョブには `id-token: write` を付けません。`verify.yaml` の分け方は [CI と配備](ci-cd.md) に記載しています。

### 手で公開する手順

ワークフローが使えないときは、`AllegroMoltoV` の GitHub アカウントで認証して手で公開します。公開は外部への書き込みなので、依頼者の承認を得てから行います。GitHub のデバイスコードの認可は、依頼者のブラウザーで行います。

1. 公式の GitHub のリリースから `mcp-publisher` を入手します。手順は Registry の Quickstart (https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) にあります。Windows では、配布物の展開に Git Bash の `tar` ではなく Windows 標準の `tar.exe` を使います。
2. リポジトリの直下で `mcp-publisher validate` を実行し、`server.json` の形を確かめます。
3. `mcp-publisher login github` を実行します。表示されたコードを `https://github.com/login/device` に入力し、MCP Registry Login (Prod) を認可します。
4. `mcp-publisher publish` を実行します。

版を上げたときは、同じ版の GitHub のリリースを `v0.1.1` の形のタグで作ります。リリースの説明には README の更新履歴の文を使います。

## Glama

MCP サーバーの一覧サイトの Glama (https://glama.ai) には、本サービスが 2 か所に載っています。

| 掲載 | URL | 内容 |
| --- | --- | --- |
| コネクター | https://glama.ai/mcp/connectors/jp.allegromoltov.soko-kun/plugin-soko-kun | 本番のエンドポイントに接続して確かめた掲載。所有は DNS の TXT レコード `_glama-claim.soko-kun.allegromoltov.jp` で示している |
| サーバー | https://glama.ai/mcp/servers/AllegroMoltoV/plugin-soko-kun | Glama が GitHub のリポジトリから作った掲載。コネクターへ案内される |

リポジトリの直下の `glama.json` は、サーバーの掲載の保守者を示すファイルです。`maintainers` に `AllegroMoltoV` を書きます。

サーバーの掲載では、Glama のリリースを作りません。Glama のリリースは、Glama がサーバーを Docker で起動して作ります。本サービスは Cloudflare Workers の上でだけ動くため、起動できません。そのため、サーバーの掲載の品質の評価は付きません。ツールの品質の評価は、コネクターの掲載に付きます。
