# 公式 MCP Registry への登録

MCP クライアントの利用者が本サービスを見つけられるよう、本サービスの MCP サーバーを公式の MCP Registry (https://registry.modelcontextprotocol.io) に登録します。Registry の情報は、ほかの MCP サーバーの一覧にも取り込まれます。

## 登録の定義

登録の内容は、リポジトリの直下の `server.json` に置きます。本サービスは利用者の PC に導入するパッケージを持たないため、`remotes` に Streamable HTTP のエンドポイントだけを書きます。

| 項目 | 値 |
| --- | --- |
| `name` | `io.github.AllegroMoltoV/plugin-soko-kun`。`io.github.<アカウント名>/` で始まる名前は、GitHub のアカウントでの認証で所有を示せる |
| `description` | Registry の上限の 100 文字以内。宣伝の語を並べない |
| `version` | 本サービスの版。README の更新履歴と `package.json` の `version` にそろえる |
| `remotes` | `streamable-http` と `https://soko-kun.allegromoltov.jp/mcp` |

## 登録と更新の手順

Registry への書き込みには、`AllegroMoltoV` の GitHub アカウントでの認証が要ります。認証はブラウザーでの確認を伴うため、依頼者が実行します。

1. 公式の配布物から `mcp-publisher` を入手します。手順は Registry の Quickstart (https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) にあります。
2. リポジトリの直下で `mcp-publisher validate` を実行し、`server.json` の形を確かめます。
3. `mcp-publisher login github` を実行し、表示に従って GitHub で認証します。
4. `mcp-publisher publish` を実行します。
5. `https://registry.modelcontextprotocol.io/v0/servers?search=plugin-soko-kun` で、登録された内容を確かめます。

エンドポイント、説明、版を変えたときは、`server.json` を直し、`version` を上げてから、同じ手順で登録し直します。
