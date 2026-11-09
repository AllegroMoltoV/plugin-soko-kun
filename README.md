# Plugin Soko-kun (配信プラグイン倉庫くん)

[English](#english) | [日本語](#日本語)

## English

Plugin Soko-kun is an independent, open registry of third-party plugins for OBS Studio. It is designed MCP-first, so AI coding agents such as Claude Code and Codex can search for plugins and register GitHub repositories directly. A read-only web catalog is also provided at https://soko-kun.allegromoltov.jp.

This project is an unofficial service that is not affiliated with the OBS Project or OBS Forums.

### Background

OBS Studio plugins are spread across GitHub repositories and forum threads, and it is hard for users and AI agents to find them and to tell whether a download is the file the author published. Plugin Soko-kun lists plugins that their authors register from GitHub, links to the files the authors published on GitHub Releases, and checks each file against MalwareBazaar, a database of known malware samples. A file with no match is not guaranteed to be safe.

### Usage

Connect an MCP client to `https://soko-kun.allegromoltov.jp/mcp`.

```sh
# Claude Code
claude mcp add --transport http plugin-soko-kun https://soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add plugin-soko-kun --url https://soko-kun.allegromoltov.jp/mcp
```

Searching and viewing details work without signing in. To register a repository you administer, sign in with GitHub first: run `/mcp` in Claude Code, or `codex mcp login plugin-soko-kun` in Codex. Then ask, for example, "Register the OBS plugin in this GitHub repository".

The listing conditions, the security policy, and how to report a problem are on the website: [About](https://soko-kun.allegromoltov.jp/about?lang=en), [Listing policy](https://soko-kun.allegromoltov.jp/policy?lang=en), [Submit a plugin](https://soko-kun.allegromoltov.jp/submit?lang=en), [Security and disclaimer](https://soko-kun.allegromoltov.jp/security?lang=en), [Report](https://soko-kun.allegromoltov.jp/report?lang=en).

To report a vulnerability in this service, use [private vulnerability reporting](https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new).

### Contents

| Path | Description |
| --- | --- |
| `src/` | Worker source code (MCP, OAuth, web catalog, scheduled jobs) |
| `migrations/` | D1 schema migrations |
| `scripts/` | Admin commands |
| `test/` | Tests |
| `.github/` | CI, CodeQL, deploy workflows, Dependabot, funding, and the security policy |
| `wrangler.jsonc` | Cloudflare Workers configuration |
| `docs/` | Design documents, glossary, and decision records (in Japanese) |
| `LICENSE` | MIT License |

For local development, see [docs/operations/local-development.md](docs/operations/local-development.md) (in Japanese).

## 日本語

配信プラグイン倉庫くんは、OBS Studio 向けのサードパーティ製プラグインを検索・登録できる、独立したオープンなレジストリです。MCP を主な操作手段とし、Claude Code や Codex などの AI エージェントからプラグインを探したり、GitHub リポジトリを登録したりできます。閲覧専用の Web カタログを https://soko-kun.allegromoltov.jp で提供しています。

本プロジェクトは OBS Project および OBS Forums と無関係の非公式サービスです。

### 背景

OBS Studio のプラグインは GitHub のリポジトリやフォーラムの投稿に散らばっています。そのため、利用者と AI エージェントには、プラグインを見つけることも、ダウンロードするファイルが作者の公開したものであると確かめることも難しい状況です。配信プラグイン倉庫くんは、作者が GitHub から登録したプラグインを掲載し、作者が GitHub Releases で公開したファイルへ案内します。各ファイルは、既知のマルウェアのデータベースである MalwareBazaar と照合します。照合で該当が無くても、安全は保証されません。

### 使い方

MCP クライアントを `https://soko-kun.allegromoltov.jp/mcp` に接続します。

```sh
# Claude Code
claude mcp add --transport http plugin-soko-kun https://soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add plugin-soko-kun --url https://soko-kun.allegromoltov.jp/mcp
```

検索と詳細の取得は、サインインなしで使えます。自分が管理するリポジトリを登録するときは、先に GitHub でサインインします。Claude Code では `/mcp` を、Codex では `codex mcp login plugin-soko-kun` を実行します。そのうえで「この GitHub リポジトリの OBS プラグインを登録して」のように話しかけます。

掲載の条件、セキュリティの方針、問題の通報の方法は Web サイトに記載しています。[配信プラグイン倉庫くんとは？](https://soko-kun.allegromoltov.jp/about)、[掲載ポリシー](https://soko-kun.allegromoltov.jp/policy)、[プラグインを登録する](https://soko-kun.allegromoltov.jp/submit)、[セキュリティと免責](https://soko-kun.allegromoltov.jp/security)、[通報](https://soko-kun.allegromoltov.jp/report) を参照してください。

本サービスの脆弱性は、[Private vulnerability reporting](https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new) で報告してください。

### 内容物

| パス | 内容 |
| --- | --- |
| `src/` | Worker のソースコード (MCP、OAuth、Web カタログ、定期処理) |
| `migrations/` | D1 のスキーマのマイグレーション |
| `scripts/` | 管理コマンド |
| `test/` | テスト |
| `.github/` | CI、CodeQL、配備のワークフロー、Dependabot、寄付の設定、セキュリティの方針 |
| `wrangler.jsonc` | Cloudflare Workers の設定 |
| `docs/` | 設計文書、用語集、決定事項の記録 |
| `LICENSE` | MIT License |

ローカルでの開発の手順は [docs/operations/local-development.md](docs/operations/local-development.md) にあります。

## 更新履歴

- 0.1.0 (2026-11-09): https://soko-kun.allegromoltov.jp で公開しました。MCP での検索・詳細の取得・登録、閲覧専用の Web カタログ (7 言語)、MalwareBazaar との照合、ロゴと説明の画像、ダウンロード数を提供します。
- 0.0.0 (2026-11-09): リポジトリを作成しました。
