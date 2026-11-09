# 認証と認可

MCP のツールの認証要件・OAuth のエンドポイント・サインインの流れ・GitHub の権限の仕様です。構成の判断は [ADR 0002](../decisions/0002-single-worker-mixed-auth.md) に記載しています。

## ツールごとの認証要件

| ツール | 認証 | 認可の条件 |
| --- | --- | --- |
| `search_plugins` | 不要 | なし |
| `get_plugin` | 不要 | なし |
| `submit_plugin` | 必須 | 対象リポジトリについて、サインインした GitHub の利用者の `permissions.admin` が `true` |

認証は、リソースサーバーと `submit_plugin` のハンドラの両方で確かめます。認証なしで処理する MCP ハンドラには `submit_plugin` を登録しません。

## /mcp の振り分け

`/mcp` への要求は、次の規則でリソースサーバーと認証なしの MCP ハンドラへ振り分けます。

| 要求 | 振り分け先 |
| --- | --- |
| `Authorization` ヘッダーを持つ | リソースサーバー |
| `Mcp-Name` ヘッダーが `submit_plugin` | リソースサーバー |
| `Mcp-Name` ヘッダーが無く、本文で `submit_plugin` を呼び出す | リソースサーバー |
| `Mcp-Name` ヘッダーと本文のツール名が食い違う | 拒否 |
| 上のいずれにも当てはまらない | 認証なしの MCP ハンドラ |

リソースサーバーは、トークンが無い要求と検証に失敗した要求に 401 を返します。偽のトークンには `error="invalid_token"` を返します。

MCP の実装は `@modelcontextprotocol/server` の `createMcpHandler` を使い、セッションを持たない形で動かします。

## エンドポイント

| パス | 役割 |
| --- | --- |
| `/mcp` | MCP エンドポイント。リソースサーバーが保護する |
| `/.well-known/oauth-protected-resource` | 保護リソースのメタデータ。RFC 9728 |
| `/.well-known/oauth-authorization-server` | 認可サーバーのメタデータ。RFC 8414 |
| `/oauth/register` | DCR のクライアント登録 |
| `/authorize` | 認可要求の受付と同意画面 |
| `/callback` | GitHub での認可からの戻り先 |
| `/oauth/token` | アクセストークンの発行 |

`/oauth/register`・`/authorize`・`/oauth/token`・`/callback` には、送信元 IP アドレスごとのレート制限を設けます。KV の書き込みの上限を守るためです。

## アクセストークン

| 項目 | 値 |
| --- | --- |
| 発行者 | 本サービスの認可サーバー。`issuer` は `ORIGIN` |
| audience | `<ORIGIN>/mcp`。一致しないトークンは拒否する |
| 保存先 | KV の `OAUTH_KV`。`@cloudflare/workers-oauth-provider` が管理する |
| スコープ | 権限の区分は設けていない。認証済みであることが `submit_plugin` の条件である |

## クライアントの登録方式

CIMD と DCR の両方を受け付けます。認可サーバーのメタデータは `client_id_metadata_document_supported: true` と `registration_endpoint` を含みます。

CIMD の文書は、MCP クライアントが `client_id` として指定した URL から取得します。この取得には、Worker の互換性フラグ `global_fetch_strictly_public` が適用されます。

## サインインの流れ

利用者が MCP クライアントでサインインすると、次の順で処理が進みます。

1. MCP クライアントが `/mcp` から 401 を受け取り、保護リソースのメタデータと認可サーバーのメタデータを取得する。
2. MCP クライアントが `/authorize` へ認可要求を送る。要求は PKCE の S256 と `resource` を含む。
3. 認可サーバーが同意画面を表示する。同意画面は、クライアントの名前と、アクセスを渡す先のホストを示す。
4. 利用者が同意すると、認可サーバーが GitHub の認可画面へ転送する。この要求は、本サービスが生成した PKCE の S256 を含む。
5. GitHub が `/callback` へ戻る。認可サーバーは GitHub のアクセストークンを取得し、認可の情報に保存する。
6. 認可サーバーが MCP クライアントへ認可コードを返す。MCP クライアントは `/oauth/token` でアクセストークンを受け取る。

非公開の検証記録では、Claude Code がこの流れでサインインを終え、`submit_plugin` に成功しました。Codex での通し確認は本番公開時に行います。

## GitHub の権限

| 項目 | 内容 |
| --- | --- |
| アプリの種類 | GitHub OAuth App |
| 要求するスコープ | なし。公開リポジトリの `permissions.admin` はスコープ無しのトークンで取得できる |
| 利用者のトークンの用途 | `submit_plugin` での管理権限の確認だけ |
| アプリの認証情報の用途 | `submit_plugin` での情報取得と、同期での GitHub API の呼び出し。`client_id` と `client_secret` の Basic 認証で送る |

GitHub API を認証なしで呼ぶと、Workers の共有の送信元 IP アドレスのために 403 を受けることがあります。そのため、本人確認を伴わない呼び出しにもアプリの認証情報を使います。

利用者のトークン・アプリの認証ヘッダー・スキャナーの API キーは、ログと応答に出力しません。

## 秘密情報

秘密情報は `wrangler secret` で設定し、ローカルでは git の追跡対象外の `.dev.vars` に置きます。

| 名前 | 用途 |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App の Client secret |
| `VIRUSTOTAL_API_KEY` | VirusTotal の API キー |
| `MALWAREBAZAAR_AUTH_KEY` | MalwareBazaar の Auth-Key |
