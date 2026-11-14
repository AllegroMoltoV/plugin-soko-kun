# アーキテクチャ

配信プラグイン倉庫くんの構成要素と、要求の流れを説明します。各要素の詳細は、本文中で示す設計文書に記載します。

## 全体像

本サービスは、Cloudflare Workers 上の 1 つの Worker で動きます。Worker は、MCP エンドポイント・OAuth の認可サーバー・Web カタログ・定期処理・証明の検証の受け口を兼ねます。永続データは D1 に置き、OAuth の状態は KV に置きます。Workers AI は、プラグインの概要の機械翻訳と、新しい版の開発の実践のレビューのうち、文章の意図を読む項目の判定に使います。

配布物の証明の署名の検証だけは、Worker の外で行います。検証の CPU 時間が Worker の無料プランの上限に収まらないため、本サービスのリポジトリの GitHub Actions のワークフロー `verify.yaml` が検証し、結果を Worker へ送ります。この判断は [ADR 0014](../decisions/0014-attestation-verification-in-actions.md) に記載しています。

単一の Worker にまとめるのは、構成要素と運用の手間を最小にするためです。MCP と Web は共通のドメインロジックを使います。そのため、検索の条件や掲載状態の算出が経路によって食い違うことはありません。ホスティング基盤の判断は [ADR 0001](../decisions/0001-hosting-cloudflare-workers-free.md) に記載しています。

本サービスは、プラグインの情報の正を GitHub に置きます。D1 が保持するのは、GitHub から取得した情報の写しと、本サービス固有の情報です。固有の情報は、検査結果・新しい版の検査とレビューの結果・証明の検証の結果・管理停止・止めた版の記録・掲載の期間・旧い URL の ID・登録の記録・レート制限の記録・概要の機械翻訳・ロゴと説明の画像・ダウンロード数の日ごとの記録です。配布物のファイルは保持せず、利用者は GitHub から直接ダウンロードします。

```mermaid
flowchart LR
  agent[MCP クライアント] -->|/mcp| router
  browser[ブラウザー] -->|/ と /plugins/...| router
  cron[Cron Trigger 15 分ごと] --> scheduled
  verify[GitHub Actions verify.yaml 15 分ごと] -->|/internal/attestations/... OIDC のトークン付き| router
  subgraph worker[Worker]
    router[ルーター]
    router -->|未認証の要求| mcpPublic[MCP ハンドラ 認証なし]
    router -->|Authorization ヘッダー付き または 認証を要するツール| rs[リソースサーバー]
    rs --> mcpAuth[MCP ハンドラ 認証あり]
    router -->|/authorize /callback /oauth/...| as[認可サーバー]
    router --> web[Web カタログ]
    router -->|/internal/attestations/...| attest[証明の検証の受け口]
    scheduled[定期処理 検査と同期]
    mcpPublic --> domain[ドメインロジック]
    mcpAuth --> domain
    web --> domain
    scheduled --> domain
    attest --> domain
  end
  as --> kv[(KV)]
  rs --> kv
  as -->|本人確認の委譲| ghOAuth[GitHub OAuth]
  attest -->|トークンの署名の鍵| ghOidc[GitHub Actions OIDC]
  domain --> d1[(D1)]
  domain -->|リポジトリとリリースの情報| ghApi[GitHub API]
  domain -->|digest の照会| scanners[MalwareBazaar]
  domain -->|翻訳とレビューの LLM の判定| ai[Workers AI]
  verify -->|配布物と証明の取得| ghApi
```

## 要求の流れ

ルーターは、OAuth のメタデータを除く要求について、振り分ける前に送信元 IP アドレスごとのレート制限を確かめます。上限は経路ごとに異なり、[認証と認可](auth.md) に記載します。

### 検索と詳細取得

MCP クライアントは、`/mcp` へ `search_plugins` または `get_plugin` を送ります。ルーターは、`Authorization` ヘッダーの無い要求を認証なしの MCP ハンドラへ渡します。ハンドラは D1 から情報を読み、掲載状態を算出して応答します。

ブラウザーからの要求も、同じドメインロジックを通ります。Web カタログは閲覧専用で、HTML を返すだけです。

### 登録と作者への結果の返却

`submit_plugin` と `list_my_plugins` の呼び出しは、ルーターがリソースサーバーへ渡します。アクセストークンを持たない要求には 401 を返し、MCP クライアントにサインインを促します。サインインの流れは [認証と認可](auth.md) に記載します。

検証を通ったトークンの要求は、認証ありの MCP ハンドラが処理します。`submit_plugin` では、ドメインロジックが GitHub API で管理権限とリポジトリの情報を確かめ、D1 に保存します。保存した直後のプラグインは検査待ちです。確認のモードの `submit_plugin` は保存せず、掲載の条件の判定とレビューの結果を返します。`list_my_plugins` は、利用者が管理者であるリポジトリのプラグインについて、版ごとの検査とレビューの結果を返します。作者への返し方は [作者へのレビューの返し方](author-feedback.md) に記載します。1 つの Worker で認証混在にする判断は [ADR 0002](../decisions/0002-single-worker-mixed-auth.md) に記載しています。

### 検査と同期

Cron Trigger は 15 分ごとに Worker の定期処理を起動します。定期処理は、検査待ちの `digest` と掲載中の配布物の `digest` をスキャナーへ照会し、残りの予算で登録済みのプラグインの同期・新しい版の検査・ダウンロード数の記録・概要の機械翻訳を行います。新しい版の検査では、乗っ取りの兆候を差分からルールで判定し、開発の実践を、機械的に決まる項目はルールで、文章の意図を読む項目は Workers AI の LLM でレビューします。検査を登録時に行わず定期処理で進める理由は [ADR 0007](../decisions/0007-asynchronous-scanning-with-cron.md) に、新しい版の掲載の条件は [ADR 0013](../decisions/0013-release-provenance-and-review.md) に記載しています。予算と処理の順序は [検査と同期](scanning.md) に記載します。

### 証明の検証

GitHub Actions のワークフロー `verify.yaml` は 15 分ごとに動作し、GitHub Actions の OIDC のトークンを添えて `/internal/attestations/pending` から検証待ちの配布物の一覧を受け取ります。ワークフローは配布物を取得して証明の署名を検証し、結果を同じくトークンを添えて `/internal/attestations/results` へ送ります。Worker は、GitHub が公開する鍵でトークンの署名とクレームを確かめてから一覧を返し、結果を D1 に書きます。受け付けるのは本サービスのリポジトリの main で動作する `verify.yaml` のトークンだけです。トークンの条件は [検査と同期](scanning.md) に記載します。

## 外部データの扱い

GitHub から取得した文字列は、外部データとして扱います。MCP の応答では外部データを専用のフィールドに入れ、ツールの説明で指示として扱わないことを明記します。Web では、テンプレートの自動エスケープで無害化します。Workers AI に渡すリポジトリの内容も外部データであり、指示には中の指示に従わないことを書きます。LLM が書いたレビューの説明と該当の箇所は、MCP の応答でデータとして扱うよう明記します。

ドメインロジックは、外部への要求を `api.github.com`・`mb-api.abuse.ch`・`token.actions.githubusercontent.com` の固定のホストにだけ送ります。利用者が入力した URL からは owner と repo だけを取り出し、その URL へは要求を送りません。これにより、SSRF を防ぎます。

例外は、認可サーバーが取得する CIMD の文書です。CIMD の文書の URL は MCP クライアントが指定します。Worker の互換性フラグ `global_fetch_strictly_public` を有効にし、公開されたインターネット上のホストにだけ要求を送るようにしています。

本サービスは、プラグインのインストールやコマンドの実行の機能を持ちません。

## 関連文書

- [データモデル](data-model.md)
- [認証と認可](auth.md)
- [検査と同期](scanning.md)
- [審査の基準](review-criteria.md)
- [作者へのレビューの返し方](author-feedback.md)
- [多言語対応](i18n.md)
- [画面構成](ui.md)
