# Plugin Soko-kun (配信プラグイン倉庫くん)

[English](#english) | [日本語](#日本語)

## English

Plugin Soko-kun is an independent, open registry of third-party plugins for OBS Studio. It is designed MCP-first, so AI coding agents such as Claude Code and Codex can search for plugins and register GitHub repositories directly. A read-only web catalog is also provided at https://soko-kun.allegromoltov.jp.

This project is an unofficial service that is not affiliated with the OBS Project or OBS Forums.

### Background

OBS Studio plugins are spread across GitHub repositories and forum threads, and it is hard for users and AI agents to find them and to tell whether a download is the file the author published. Plugin Soko-kun lists plugins that their authors register from GitHub and links to the files the authors published on GitHub Releases. Before a version is listed, the service checks that the release is immutable, that every file has a build provenance attestation from the repository's own release workflow, and that no file is a known malware sample in MalwareBazaar. It also checks the change from the listed version and reviews the repository's development practices against published [review criteria](docs/design/review-criteria.md) (in Japanese). Passing the checks does not guarantee that a plugin is safe.

### Usage

Connect an MCP client to `https://soko-kun.allegromoltov.jp/mcp`.

```sh
# Claude Code
claude mcp add --transport http plugin-soko-kun https://soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add plugin-soko-kun --url https://soko-kun.allegromoltov.jp/mcp
```

Searching and viewing details work without signing in. To register a repository you administer, sign in with GitHub first: run `/mcp` in Claude Code, or `codex mcp login plugin-soko-kun` in Codex. Then ask, for example, "Register the OBS plugin in this GitHub repository". New releases are picked up automatically. Authors can ask, for example, "Check whether my plugin meets the listing conditions" before a release, and "Is the new release of my plugin listed?" after it.

The listing conditions, the security policy, and how to report a problem are on the website: [About](https://soko-kun.allegromoltov.jp/about?lang=en), [Listing policy](https://soko-kun.allegromoltov.jp/policy?lang=en), [Submit a plugin](https://soko-kun.allegromoltov.jp/submit?lang=en), [Security and disclaimer](https://soko-kun.allegromoltov.jp/security?lang=en), [Report](https://soko-kun.allegromoltov.jp/report?lang=en).

To report a vulnerability in this service, use [private vulnerability reporting](https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new).

### Claude Code skill for plugin authors

This repository is also a Claude Code plugin marketplace. Its plugin `soko-kun-plugin-dev` contains the skill `streaming-plugin-dev`, which guides Claude Code through building an OBS Studio plugin: planning, scaffolding from obs-plugintemplate, verification in OBS and in CI, releases with build provenance attestations and immutable releases, and listing on this service. Install it from your shell:

```sh
claude plugin marketplace add AllegroMoltoV/plugin-soko-kun
claude plugin install soko-kun-plugin-dev@plugin-soko-kun
```

In a Claude Code session, run `/plugin marketplace add AllegroMoltoV/plugin-soko-kun` and then `/plugin install soko-kun-plugin-dev@plugin-soko-kun`. Claude Code uses the skill when you ask it to build or publish an OBS plugin, and you can also run it as `/soko-kun-plugin-dev:streaming-plugin-dev`. The skill is in [plugins/soko-kun-plugin-dev/](plugins/soko-kun-plugin-dev/).

### Contents

| Path | Description |
| --- | --- |
| `src/` | Worker source code (MCP, OAuth, web catalog, scheduled jobs) |
| `migrations/` | D1 schema migrations |
| `scripts/` | Admin commands |
| `test/` | Tests |
| `.github/` | CI, CodeQL, deploy, and attestation verification workflows, Dependabot, funding, and the security policy |
| `wrangler.jsonc` | Cloudflare Workers configuration |
| `server.json` | Entry for the official MCP Registry |
| `glama.json` | Maintainer of the Glama server listing |
| `docs/` | Design documents, glossary, and decision records (in Japanese) |
| `.claude-plugin/` | Claude Code plugin marketplace definition |
| `plugins/` | Claude Code plugin with the skill for plugin authors |
| `LICENSE` | MIT License |

For local development, see [docs/operations/local-development.md](docs/operations/local-development.md) (in Japanese).

### AI disclosure

Anthropic Claude Code was used for almost the entire development of this service, including research, source code, Cloudflare configuration, tests, and documentation. OpenAI Codex was used to verify sign-in and submission from Codex. The author decided the requirements and design policies, reviewed the web pages and documents, and approved each deployment and external operation one by one. The author did not perform a rigorous line-by-line human review of the source code. The Claude Code skill for plugin authors was also written with Claude Code, from the author's records of building OBS Studio plugins.

## 日本語

配信プラグイン倉庫くんは、OBS Studio 向けのサードパーティ製プラグインを検索・登録できる、独立したオープンなレジストリです。MCP を主な操作手段とし、Claude Code や Codex などの AI エージェントからプラグインを探したり、GitHub リポジトリを登録したりできます。閲覧専用の Web カタログを https://soko-kun.allegromoltov.jp で提供しています。

本プロジェクトは OBS Project および OBS Forums と無関係の非公式サービスです。

### 背景

OBS Studio のプラグインは GitHub のリポジトリやフォーラムの投稿に散らばっています。そのため、利用者と AI エージェントには、プラグインを見つけることも、ダウンロードするファイルが作者の公開したものであると確かめることも難しい状況です。配信プラグイン倉庫くんは、作者が GitHub から登録したプラグインを掲載し、作者が GitHub Releases で公開したファイルへ案内します。版を掲載する前に、リリースが不変であること、すべてのファイルにそのリポジトリのリリースのワークフローが作った証明 (build provenance attestation) があること、既知のマルウェアのデータベースである MalwareBazaar に該当が無いことを確かめます。あわせて、掲載中の版からの変更を検査し、公開している[審査の基準](docs/design/review-criteria.md)にしたがってリポジトリの開発の実践をレビューします。検査を通っても、安全は保証されません。

### 使い方

MCP クライアントを `https://soko-kun.allegromoltov.jp/mcp` に接続します。

```sh
# Claude Code
claude mcp add --transport http plugin-soko-kun https://soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add plugin-soko-kun --url https://soko-kun.allegromoltov.jp/mcp
```

検索と詳細の取得は、サインインなしで使えます。自分が管理するリポジトリを登録するときは、先に GitHub でサインインします。Claude Code では `/mcp` を、Codex では `codex mcp login plugin-soko-kun` を実行します。そのうえで「この GitHub リポジトリの OBS プラグインを登録して」のように話しかけます。新しいリリースは自動で取り込みます。作者は、リリースの前に「このプラグインの掲載の条件を確かめて」、リリースのあとに「新しい版の掲載の状況を確かめて」のように話しかけて確かめられます。

掲載の条件、セキュリティの方針、問題の通報の方法は Web サイトに記載しています。[配信プラグイン倉庫くんとは？](https://soko-kun.allegromoltov.jp/about)、[掲載ポリシー](https://soko-kun.allegromoltov.jp/policy)、[プラグインを登録する](https://soko-kun.allegromoltov.jp/submit)、[セキュリティと免責](https://soko-kun.allegromoltov.jp/security)、[通報](https://soko-kun.allegromoltov.jp/report) を参照してください。

本サービスの脆弱性は、[Private vulnerability reporting](https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new) で報告してください。

### プラグインの作者向けの Claude Code のスキル

このリポジトリは Claude Code のプラグインのマーケットプレイスを兼ねています。プラグイン `soko-kun-plugin-dev` には、スキル `streaming-plugin-dev` が入っています。このスキルにしたがって、Claude Code は OBS Studio のプラグインを作ります。企画、obs-plugintemplate からの雛形の作成、OBS と CI での検証、ビルドの来歴の証明と不変のリリース、本サービスへの掲載を扱います。シェルで次のコマンドを実行して導入します。

```sh
claude plugin marketplace add AllegroMoltoV/plugin-soko-kun
claude plugin install soko-kun-plugin-dev@plugin-soko-kun
```

Claude Code のセッションの中では、`/plugin marketplace add AllegroMoltoV/plugin-soko-kun` のあとに `/plugin install soko-kun-plugin-dev@plugin-soko-kun` を実行します。OBS のプラグインの制作や公開を頼むと、Claude Code がこのスキルを使います。`/soko-kun-plugin-dev:streaming-plugin-dev` で呼び出すこともできます。スキルの本文は英語で、[plugins/soko-kun-plugin-dev/](plugins/soko-kun-plugin-dev/) にあります。

### 内容物

| パス | 内容 |
| --- | --- |
| `src/` | Worker のソースコード (MCP、OAuth、Web カタログ、定期処理) |
| `migrations/` | D1 のスキーマのマイグレーション |
| `scripts/` | 管理コマンド |
| `test/` | テスト |
| `.github/` | CI、CodeQL、配備、証明の検証のワークフロー、Dependabot、寄付の設定、セキュリティの方針 |
| `wrangler.jsonc` | Cloudflare Workers の設定 |
| `server.json` | 公式の MCP Registry への登録の定義 |
| `glama.json` | Glama のサーバーの掲載の保守者 |
| `docs/` | 設計文書、用語集、決定事項の記録 |
| `.claude-plugin/` | Claude Code のプラグインのマーケットプレイスの定義 |
| `plugins/` | プラグインの作者向けのスキルを入れた Claude Code のプラグイン |
| `LICENSE` | MIT License |

ローカルでの開発の手順は [docs/operations/local-development.md](docs/operations/local-development.md) にあります。

### AI 利用開示

本サービスの開発では、調査、ソースコード、Cloudflare の設定、テスト、文書を含むほぼすべての工程で Anthropic Claude Code を使用しました。Codex からのサインインと登録の確認には OpenAI Codex を使用しました。要件と設計の方針は作者が決めました。作者は Web の画面と文書を確認し、配備と外部への操作を 1 回ずつ承認しました。ソースコードを 1 行ずつ読む厳密な人間のレビューは行っていません。プラグインの作者向けの Claude Code のスキルも、作者が OBS Studio のプラグインを作った記録をもとに、Claude Code で書きました。

## 更新履歴

- 0.2.0 (2026-11-13): 新しい版の掲載の条件に、不変のリリース、証明の検証、exe と msi の禁止を加えました。掲載中の版からの変更の検査と、LLM による開発の実践のレビューを足し、結果と直し方を作者の AI エージェントへ list_my_plugins と確認のモードで返します。検査を通っていない版はエンドユーザーに見せず、止めた版は告知ページで知らせます。作者は .soko-kun/config.json で表示名と載せる OS を指定できます。
- 0.1.2 (2026-11-11): 複数の言語で書かれた概要を 1 つの訳にまとめ、訳を Markdown の記号で飾らないよう、機械翻訳を直しました。詳細ページの説明の画像を軽い WebP で表示し、GIF は押したときだけ再生します。
- 0.1.1 (2026-11-10): 検索の照合の対象に概要の機械翻訳を加えました。詳細ページにビルドに使った OBS の版と構造化データを出します。MCP のツールに説明と注釈を加え、公式の MCP Registry に登録しました。
- 0.1.0 (2026-11-09): https://soko-kun.allegromoltov.jp で公開しました。MCP での検索・詳細の取得・登録、閲覧専用の Web カタログ (7 言語)、MalwareBazaar との照合、ロゴと説明の画像、ダウンロード数を提供します。
- 0.0.0 (2026-11-09): リポジトリを作成しました。
