# ローカルでの開発

手元の PC で Worker を起動し、Web カタログ・MCP・Cron の定期処理を確かめる手順です。ローカルの D1 と KV は、`wrangler` が `.wrangler/state/` に作ります。概要の機械翻訳だけは、ローカルでも実環境の Workers AI を呼びます。そのため、`wrangler login` で Cloudflare にログインしておく必要があり、翻訳の分だけ Workers AI の無料枠を使います。

## 前提

- Node.js 24 と npm が使えること。CI も Node.js 24 で動かしています。
- ローカル用の GitHub OAuth App を作成済みであること。Authorization callback URL には `http://localhost:8787/callback` を指定します。
- 検査の照会を確かめる場合は、MalwareBazaar の Auth-Key を取得済みであること。

## 依存の導入

リポジトリの直下で次を実行します。`package-lock.json` のとおりに依存を導入します。

```sh
npm ci
```

## 秘密情報の設定

秘密情報は、リポジトリの直下の `.dev.vars` に置きます。`.dev.vars` は `.gitignore` で git の追跡対象から外しています。

```sh
GITHUB_CLIENT_ID=<ローカル用の GitHub OAuth App の Client ID>
GITHUB_CLIENT_SECRET=<ローカル用の GitHub OAuth App の Client secret>
MALWAREBAZAAR_AUTH_KEY=<MalwareBazaar の Auth-Key>
CONTACT_EMAIL=<開発者の連絡先のメールアドレス>
```

`MALWAREBAZAAR_AUTH_KEY` は省略できます。鍵が無いときは照会を行いません。その場合、登録したプラグインは検査待ちのまま残ります。`CONTACT_EMAIL` を省略すると、「連絡先を表示」ボタンは連絡先を準備中である旨を表示します。

`ORIGIN` は `wrangler.jsonc` の `vars` で `http://localhost:8787` に設定しています。

## データベースの作成

ローカルの D1 に、`migrations/` 配下のマイグレーションを適用します。

```sh
npm run db:migrate:local
```

## Worker の起動

次のコマンドで Worker を起動します。`npm run dev` は `wrangler dev` を実行します。

```sh
npm run dev
```

起動後は、ブラウザーで `http://localhost:8787/` を開くと Web カタログを表示できます。MCP のエンドポイントは `http://localhost:8787/mcp` です。

## Cron の手動実行

ローカルでは Cron Trigger が自動で起動しません。定期処理を確かめるには、`--test-scheduled` を付けて Worker を起動します。

```sh
npx wrangler dev --test-scheduled
```

別の端末から `/__scheduled` へ要求を送ると、定期処理が 1 回動きます。

```sh
curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
```

`wrangler dev` の端末には、`{"event":"cron",...}` の形の行が出力されます。この行は、照会した件数・同期した件数・同期に失敗した件数・翻訳した件数・ダウンロード数を記録した件数・使った外部呼び出しと D1 のクエリの件数・停止の理由を含みます。

## テストと静的検査

変更を提出する前に、次の 3 つを実行します。CI も同じコマンドを実行します。

```sh
npm test
npm run typecheck
npm run lint
```

`npm test` は、Miniflare 上でテスト用の値を与えて動きます。`.dev.vars` の秘密情報は使いません。外部の API への要求はテストの中で模擬します。

## MCP クライアントからの接続

ローカルの Worker に MCP クライアントを接続すると、`search_plugins`・`get_plugin`・`submit_plugin` を会話から呼び出せます。`search_plugins` と `get_plugin` はサインインなしで使えます。`submit_plugin` には、GitHub でのサインインが必要です。

### Claude Code

次のコマンドで MCP サーバーを追加します。

```sh
claude mcp add --transport http plugin-soko-kun http://localhost:8787/mcp
```

`submit_plugin` を使う前に、Claude Code で `/mcp` を実行し、`plugin-soko-kun` を選んでサインインします。ブラウザーで同意画面と GitHub の認可画面を経ると、サインインが終わります。

### Codex

次のコマンドで MCP サーバーを追加します。

```sh
codex mcp add plugin-soko-kun --url http://localhost:8787/mcp
```

このサーバーは検索と詳細の取得をサインインなしで受け付けるため、`codex mcp add` はサインインの要否を判定できず、自動ではサインインを始めません。`submit_plugin` を使う前に、次のコマンドでサインインします。ブラウザーで同意画面と GitHub の認可画面を経ると、サインインが終わります。

```sh
codex mcp login plugin-soko-kun
```

## 管理用スクリプトの実行

管理用スクリプトは、`--remote` を付けない場合にローカルの D1 を更新します。使い方は [掲載停止と再開](suspend.md) に記載します。

```sh
npm run admin -- show <owner/repo>
```
