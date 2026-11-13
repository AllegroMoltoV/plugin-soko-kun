# 認証と認可

MCP のツールの認証要件・OAuth のエンドポイント・サインインの流れ・GitHub の権限・証明の検証の受け口の認証の仕様です。構成の判断は [ADR 0002](../decisions/0002-single-worker-mixed-auth.md) に記載しています。

## ツールごとの認証要件

| ツール | 認証 | 認可の条件 |
| --- | --- | --- |
| `search_plugins` | 不要 | なし |
| `get_plugin` | 不要 | なし |
| `submit_plugin` | 必須 | 対象リポジトリについて、サインインした GitHub の利用者の `permissions.admin` が `true`。確認のモードでも同じ |
| `list_my_plugins` | 必須 | 返すのは、サインインした GitHub の利用者の `permissions.admin` が `true` のリポジトリのプラグインだけ。候補の決め方は [作者へのレビューの返し方](author-feedback.md) に記載する |

認証を要するツールは、`submit_plugin` と `list_my_plugins` です。認証は、リソースサーバーと各ツールのハンドラの両方で確かめます。認証なしで処理する MCP ハンドラには、認証を要するツールを登録しません。

## /mcp の振り分け

`/mcp` への要求は、次の規則でリソースサーバーと認証なしの MCP ハンドラへ振り分けます。

| 要求 | 振り分け先 |
| --- | --- |
| `Authorization` ヘッダーを持つ | リソースサーバー |
| `Mcp-Name` ヘッダーが認証を要するツール | リソースサーバー |
| `Mcp-Name` ヘッダーが無く、本文で認証を要するツールを呼び出す | リソースサーバー |
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
| `/internal/attestations/pending`・`/internal/attestations/results` | 証明の検証の受け口。GitHub Actions の OIDC のトークンで守る。「証明の検証の受け口の認証」を参照 |

`/oauth/register`・`/authorize`・`/oauth/token`・`/callback` には、送信元 IP アドレスあたり 1 分 20 回のレート制限を設けます。これらの経路は KV へ書き込むため、無料プランの KV の書き込みの上限を守る必要があります。`/mcp` と Web カタログの上限は、送信元 IP アドレスあたり 1 分 120 回です。OAuth のメタデータ (`/.well-known/oauth-authorization-server` と `/.well-known/oauth-protected-resource` で始まるパス) にはレート制限を設けません。集計の方式は [データモデル](data-model.md) の `rate_limit` に記載します。

## アクセストークン

| 項目 | 値 |
| --- | --- |
| 発行者 | 本サービスの認可サーバー。`issuer` は `ORIGIN` |
| audience | `<ORIGIN>/mcp`。一致しないトークンは拒否する |
| 保存先 | KV の `OAUTH_KV`。`@cloudflare/workers-oauth-provider` が管理する |
| スコープ | 権限の区分は設けていない。認証済みであることが `submit_plugin` と `list_my_plugins` の条件である |

## クライアントの登録方式

CIMD と DCR の両方を受け付けます。認可サーバーのメタデータは `client_id_metadata_document_supported: true` と `registration_endpoint` を含みます。

CIMD の文書は、MCP クライアントが `client_id` として指定した URL から取得します。この取得には、Worker の互換性フラグ `global_fetch_strictly_public` が適用されます。

## サインインの流れ

利用者が MCP クライアントでサインインすると、次の順で処理が進みます。

1. MCP クライアントが `/mcp` から 401 を受け取り、保護リソースのメタデータと認可サーバーのメタデータを取得する。
2. MCP クライアントが `/authorize` へ認可要求を送る。要求は PKCE の S256 と `resource` を含む。
3. 認可サーバーが同意画面を表示する。同意画面は、クライアントの名前と、アクセスを渡す先のホストを示す。
4. 利用者が同意すると、認可サーバーが GitHub の認可画面へ転送する。この要求は、本サービスが生成した PKCE の S256 を含む。
5. GitHub が `/callback` へ戻る。認可サーバーは GitHub のアクセストークンと refresh token を取得し、GitHub の利用者 ID とログイン名とともに認可の情報に保存する。
6. 認可サーバーが MCP クライアントへ認可コードを返す。MCP クライアントは `/oauth/token` でアクセストークンを受け取る。

非公開の検証記録では、Claude Code がこの流れでサインインを終え、`submit_plugin` に成功しました。本番では、Codex も `codex mcp login` でサインインを終え、`submit_plugin` の要求が利用者のトークンによる管理権限の確認を通りました。

## GitHub のトークンの更新

GitHub のアクセストークンは期限付きです。認可サーバーは、MCP クライアントのアクセストークンの更新に合わせて、保存した GitHub のトークンを更新します。実装は `src/auth/index.ts` の `tokenExchangeCallback` です。

MCP クライアントが `/oauth/token` へ `grant_type=refresh_token` の要求を送ると、認可サーバーは保存した GitHub の refresh token で GitHub のアクセストークンを取り直します。結果ごとの扱いは次のとおりです。

| GitHub の応答 | 扱い |
| --- | --- |
| 新しいアクセストークンを返した | 認可の情報の GitHub のアクセストークンを置き換える。新しい refresh token が返された場合は、それも置き換える |
| `bad_refresh_token` を返した | `invalid_grant` を返す。利用者は再びサインインする必要がある |
| その他の失敗 | 503 の `temporarily_unavailable` を返す |

保存した GitHub の refresh token が無い場合は、GitHub のトークンを更新せずに MCP のトークンだけを更新します。認可コードの交換では、この処理を行いません。

## GitHub の権限

| 項目 | 内容 |
| --- | --- |
| アプリの種類 | GitHub OAuth App |
| 要求するスコープ | なし。公開リポジトリの `permissions.admin` はスコープ無しのトークンで取得できる |
| 利用者のトークンの用途 | `submit_plugin` と `list_my_plugins` での管理権限の確認だけ |
| アプリの認証情報の用途 | `submit_plugin` での情報取得と、同期での GitHub API の呼び出し。`client_id` と `client_secret` の Basic 認証で送る |

GitHub API を認証なしで呼ぶと、Workers の共有の送信元 IP アドレスのために 403 を受けることがあります。そのため、本人確認を伴わない呼び出しにもアプリの認証情報を使います。

利用者のトークン・アプリの認証ヘッダー・スキャナーの API キーは、ログと応答に出力しません。

## 証明の検証の受け口の認証

`/internal/attestations/pending` と `/internal/attestations/results` は、本サービスのリポジトリの GitHub Actions のワークフロー `verify.yaml` だけが使う経路です。OAuth のアクセストークンではなく、`Authorization: Bearer` の GitHub Actions の OIDC のトークンを求めます。Worker は GitHub が公開する鍵でトークンの署名を確かめ、`iss`・`aud`・`repository`・`job_workflow_ref`・`exp` を照合します。満たさない要求には 401 を返します。照合するクレームの値は [検査と同期](scanning.md) の「証明の検証の受け口」に、この方式の判断は [ADR 0014](../decisions/0014-attestation-verification-in-actions.md) に記載しています。

この認証のために Worker が保存しておく鍵や秘密情報はありません。

## 秘密情報

秘密情報は `wrangler secret` で設定し、ローカルでは git の追跡対象外の `.dev.vars` に置きます。

| 名前 | 用途 |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App の Client secret |
| `MALWAREBAZAAR_AUTH_KEY` | MalwareBazaar の Auth-Key |
| `CONTACT_EMAIL` | 開発者の連絡先のメールアドレス。収集を防ぐためソースコードに書かず、秘密情報と同じ方法で設定する |

`MALWAREBAZAAR_AUTH_KEY` は省略できます。省略した場合は照会を行わず、検査結果は `pending` のまま残ります。`CONTACT_EMAIL` を省略すると、「連絡先を表示」ボタンは連絡先を準備中である旨を表示します。
