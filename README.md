# Plugin Soko-kun (配信プラグイン倉庫くん)

[English](#english) | [日本語](#日本語)

## English

Plugin Soko-kun is an independent, open registry of third-party plugins for OBS Studio. It is designed MCP-first, so AI coding agents such as Claude Code and Codex can search for plugins and register GitHub repositories directly. A read-only web catalog is also provided.

This project is an unofficial service that is not affiliated with the OBS Project or OBS Forums.

Status: under development. The MVP is not yet released.

### Contents

| Path | Description |
| --- | --- |
| `src/` | Worker source code (MCP, OAuth, web catalog, scheduled jobs) |
| `migrations/` | D1 schema migrations |
| `scripts/` | Admin commands |
| `test/` | Tests |
| `.github/` | CI, CodeQL, deploy workflows, and Dependabot |
| `wrangler.jsonc` | Cloudflare Workers configuration |
| `docs/` | Design documents, glossary, and decision records (in Japanese) |
| `LICENSE` | MIT License |

Usage, MCP connection steps, the listing policy, and the security policy will be added before the first release.

## 日本語

配信プラグイン倉庫くんは、OBS Studio 向けのサードパーティ製プラグインを検索・登録できる、独立したオープンなレジストリです。MCP を主な操作手段とし、Claude Code や Codex などの AI エージェントからプラグインを探したり、GitHub リポジトリを登録したりできます。閲覧専用の Web カタログもあわせて提供します。

本プロジェクトは OBS Project および OBS Forums と無関係の非公式サービスです。

状態: 開発中です。MVP はまだ公開していません。

### 内容物

| パス | 内容 |
| --- | --- |
| `src/` | Worker のソースコード (MCP、OAuth、Web カタログ、定期処理) |
| `migrations/` | D1 のスキーマのマイグレーション |
| `scripts/` | 管理コマンド |
| `test/` | テスト |
| `.github/` | CI、CodeQL、配備のワークフローと Dependabot |
| `wrangler.jsonc` | Cloudflare Workers の設定 |
| `docs/` | 設計文書、用語集、決定事項の記録 |
| `LICENSE` | MIT License |

使い方、MCP の接続手順、掲載ポリシー、セキュリティポリシーは、最初の公開までに追記します。

## 更新履歴

- 0.0.0 (2026-11-09): リポジトリを作成しました。
