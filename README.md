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

- 0.2.16 (2026-11-16): Web のカタログのフッターに、姉妹サービスの音のプラグイン倉庫くん (DAW 用のオーディオプラグイン) へのリンクを置きました。表示中の言語を引き継ぎます。
- 0.2.15 (2026-11-16): 検索 (MCP の `search_plugins` と Web のカタログ) で、プラグインの表示名 (`.soko-kun/config.json` の `name`) にも照合します。表示名にだけある語で検索しても見つからない不具合を直しました。
- 0.2.14 (2026-11-15): `submit_plugin` の確認のモードの上限にかかったとき、次に使える時刻 `resumesAt` を返し、上限が GitHub アカウントごとであることを伝えます。作者のスキルの、リリースの zip をポータブル版の OBS で確かめる手順に、配置の置き直しを書きました。公式 MCP Registry への登録の手順書を実態に合わせました。文脈を持たないセッションが公開の資料だけでプラグインを作り掲載した試行で、作者が詰まった箇所を直したものです。
- 0.2.13 (2026-11-15): 版やプラグインが管理者の確認待ちになったとき、管理者だけが見られる Discord のチャンネルへ、確認待ちの理由ごとに 1 回通知します。誤検出のたびに審査の規則を緩めず、管理者が気づいて承認できるようにするためです。乗っ取りの兆候の差分の規則で、細工したパスや行により検知を逃れられた経路を塞ぎました。定期処理のログのダウンロード数を記録した件数を、プラグインの件数で数えるようにしました。
- 0.2.12 (2026-11-15): 掲載の後も、既定のブランチの README を 1 日 1 回、審査の基準 `no-security-bypass` と `no-terminal-paste` で照合します。新しい版のレビューはタグの時点の README を照合するため、掲載の後に足された案内を次の版まで検知できなかったためです。最初の照合は基準の記録だけにし、基準に無い案内が現れたら、管理者が確かめるまでプラグインのどの版も掲載しません。管理コマンドの `pending` に、この確認待ちと、掲載中の版のリリースノートの確認待ちを表示し、`approve-readme` で解けるようにしました。
- 0.2.11 (2026-11-15): `submit_plugin` の確認のモードで、リリースがまだ無いときも、リリースを要る条件を未判定として直し方とともに返し、既定のブランチの `.soko-kun/config.json` の形を確かめます。不変のリリースは公開の後に直せないため、作者が公開の前に問題に気づけるようにしました。`list_my_plugins` の再開の目安の時刻を、版の公開の時刻からの上限にし、呼ぶたびに後ろへ動かないようにしました。1 人で開発する作者向けに、ブランチの ruleset の例外にリポジトリの管理者を「For pull requests only」で足す設定を案内します。作者向けのページに、確認のモードのサインイン、下書きに配布物を添付してから公開する手順、否定の文でも照合に当たることを書きました。姉妹版の音のプラグイン倉庫くんの、作者の目線での試行で見つかった問題を直したものです。
- 0.2.10 (2026-11-15): 審査の基準 `no-security-bypass` と `no-terminal-paste` で、リリースノートと README 以外の文書も照合します。リリースノートは同期とダウンロード数の記録で受け取る本文をその場で照合し、本文は保存しません。承認の後に本文を編集して案内を足した版は、承認を取り消して管理者の確認待ちに戻します。README 以外の文書は、検証のワークフローが通信の検出と同じ取り出しで照合し、照合の型は Worker と共有するファイルに置きました。照合の結果が期限までに届かなかった版は、2 つの項目を重大の指摘にします。
- 0.2.9 (2026-11-15): レビューの README を、GitHub がリポジトリの画面に表示するものを GitHub の README の API で取得し、そのパスで照合します。`README.md` 以外の名前の README で、`no-security-bypass` と `no-terminal-paste` の照合を逃れられた欠陥を直しました。通信の API の検出は、拡張子とディレクトリで絞らず、`.git` を除くすべてのテキストファイルを探します。`#include` で取り込むファイルや `build` 配下に置いた通信の処理を見逃していたためです。検証のワークフローで第三者のソースを取り出すときに、時間とディスクの上限を付けました。AI Gateway のログで姉妹版と消費を区別できるよう、Workers AI の呼び出しにサービス名を付けます。詳細ページで止めた版の警告をダウンロードボタンより上に出し、`/submit` の理由の一覧に `name_reserved` を足し、連絡先のページで言語を切り替えたときの 404 を直しました。`obs -p` と `obs -m` も OBS の起動に数えます。作者向けの案内と設計書の、実装と食い違う記述を直しました。
- 0.2.8 (2026-11-15): 審査の基準 `ci-scenario-tests` で、ワークフローが OBS Studio を起動すれば、テストを実行する行が無くても満たすようにしました。公開のスキルが案内する、公式の OBS を起動して確かめる方式が満たさない判定になっていたためです。そのかわり、OBS の導入や版の表示のように起動ではない行は数えません。ワークフローから呼ぶスクリプトの中の起動は読まないことを、審査の基準とスキルに書きました。ルールの判定不能の説明も `Checked by rules` で始め、LLM の指摘と区別できるようにしました。作者に返す応答の例、用語集、ADR、運用の文書の、実装と食い違う記述を直しました。
- 0.2.7 (2026-11-15): 審査の基準 `no-security-bypass` を、LLM ではなくルールで判定します。README で macOS の隔離属性の除去や Windows Defender の無効化を案内するリリースは、否定の文脈でも重大の指摘として管理者の確認待ちにします。ダウンロードしたスクリプトをシェルに渡して実行させる案内を、新しい基準 `no-terminal-paste` で同じく判定します。どちらも姉妹版の音のプラグイン倉庫くんの実装を写しました。README は最初に 128 KB まで読み、それを超える README と読めなかった README は、この 2 つの基準で重大の指摘にします。`ci-scenario-tests` を LLM からルールの判定に移し、同じ版でも判定が回によって分かれる問題を直しました。CI のワークフローがテストを実行し、テストのソースが libobs を初期化するか、ワークフローが OBS Studio を起動すれば満たします。テストのソースは `#include` をたどって 3 件まで読みます。1 件の検査の外部呼び出しの上限は 26 件になりました。定期処理の予算の算式を単体テストで固定しました。
- 0.2.6 (2026-11-15): 定期処理で、新しい版の検査を同期より先に行います。登録済みのプラグインの同期で外部呼び出しの予算を使い、新しい版の検査が始まらない不具合を直しました。検査の失敗や予算の超過では、同期などの後段を止めません。そのリポジトリだけの GitHub の失敗は試行に数え、2 回で管理者の確認待ちにします。管理コマンド `pending` に版の公開からの経過時間を出します。証明の検証が試行を使い切った版を、作者に対応不要と返し続けず、管理者の確認待ちとして返します。管理者が検証をやり直す管理コマンド `retry-attestations` を足しました。バイナリを削除しただけの差分を乗っ取りの兆候に数えません。証明の検証の結果の受け口で、同じ配布物の結果を 2 つ含む要求を拒否し、検証待ちの条件を 1 か所にまとめました。MCP の案内に審査の基準の URL を加え、運用の文書の欠けを埋めました。差分の検査、受け口、運用の文書の改善の一部は、姉妹版の音のプラグイン倉庫くんの実装にならいました。
- 0.2.5 (2026-11-15): 本番の Workers AI の呼び出し (レビューと翻訳) を AI Gateway に通し、その支出の上限で、姉妹版と合わせた費用を止めます。上限に達したときは、無料枠の不足と同じく、新しい版のレビューを 1 時間ごとにやり直し、確認のモードは件数に数えずに今は使えないと返します。`package-lock.json` の版の食い違いを直しました。
- 0.2.4 (2026-11-15): 新しい版のタグのコミットが既定のブランチの履歴に無ければ、乗っ取りの兆候 (`tag-not-on-default-branch`) として管理者の確認待ちにします。比べるのはタグの名前ではなく、証明と結び付いた版のコミットです。推奨の項目に、既定のブランチとリリースのタグを ruleset で守ること (`repository-protection`) を足し、作者向けの案内と公開のスキルに設定の仕方を書きました。
- 0.2.3 (2026-11-14): 新しい版のソースのコードから通信の API の使用を GitHub Actions で検出し、結果をレビューに事実として渡します。通信の API があるのに README が外部への送信に一切触れていない版は、管理者の確認待ちにします (ADR 0016)。
- 0.2.2 (2026-11-14): 名前を変えたプラグインで、古い版のリリースとダウンロードの URL が旧い名前のまま表示される不具合を直しました。
- 0.2.1 (2026-11-14): 開発の実践のレビューを、機械的に決まる項目はルールで、文章の意図を読む項目だけを LLM で判定する形に改め、LLM にはルールで計算した事実を渡します。入力に無い知識が要る項目は判定しません (ADR 0016)。リポジトリの名前の変更と移管を ID で追い、旧い URL を転送し、所有者が変わった後の新しい版は管理者が確かめます (ADR 0015)。Workers AI の無料枠が足りないときは 1 時間ごとにレビューをやり直し、証明の検証のワークフローを定期処理から起動します。作者向けのスキルを Claude Code のプラグインとして同梱しました。
- 0.2.0 (2026-11-13): 新しい版の掲載の条件に、不変のリリース、証明の検証、exe と msi の禁止を加えました。掲載中の版からの変更の検査と、LLM による開発の実践のレビューを足し、結果と直し方を作者の AI エージェントへ list_my_plugins と確認のモードで返します。検査を通っていない版はエンドユーザーに見せず、止めた版は告知ページで知らせます。作者は .soko-kun/config.json で表示名と載せる OS を指定できます。
- 0.1.2 (2026-11-11): 複数の言語で書かれた概要を 1 つの訳にまとめ、訳を Markdown の記号で飾らないよう、機械翻訳を直しました。詳細ページの説明の画像を軽い WebP で表示し、GIF は押したときだけ再生します。
- 0.1.1 (2026-11-10): 検索の照合の対象に概要の機械翻訳を加えました。詳細ページにビルドに使った OBS の版と構造化データを出します。MCP のツールに説明と注釈を加え、公式の MCP Registry に登録しました。
- 0.1.0 (2026-11-09): https://soko-kun.allegromoltov.jp で公開しました。MCP での検索・詳細の取得・登録、閲覧専用の Web カタログ (7 言語)、MalwareBazaar との照合、ロゴと説明の画像、ダウンロード数を提供します。
- 0.0.0 (2026-11-09): リポジトリを作成しました。
