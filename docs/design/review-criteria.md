# 審査の基準

新しい版を掲載する前に確かめる項目の一覧です。本文書が審査の基準の正本です。MCP で作者に返す固定の文言 (英語) は `src/review/criteria.ts` に項目の ID ごとに持ち、本文書の ID と一致することをテストで確かめます。作者への返し方は [作者へのレビューの返し方](author-feedback.md) に、この基準を採った判断は [ADR 0013](../decisions/0013-release-provenance-and-review.md) に記載します。

## 基準の出典

基準は、OBS のプラグインの開発者である宇田川海斗さん (umireon) が公開物で述べている懸念と推奨を出発点にしています。宇田川さんは、OBS のプラグインが公開前の映像と音声に触れるため、供給網の攻撃の標的になると指摘しています。出典は項目ごとに示します。

主な出典は次のとおりです。

- スライド「モダン OBS プラグイン開発」: https://speakerdeck.com/umireon/modanobspuraguinkai-fa
- Qiita の記事へのコメント: https://qiita.com/AllegroMoltoV/items/bdb672f2b8d33acdd20e
- live-backgroundremoval-lite のリポジトリ: https://github.com/kaito-tokyo/live-backgroundremoval-lite
- obs-backgroundremoval の Issue と PR: https://github.com/royshil/obs-backgroundremoval

宇田川さんのプロジェクトの方針のうち、生成 AI の出力を製品に入れないことなどは採りません。本サービスは、AI の利用の有無を掲載に影響させないためです。

## 区分

項目は次の 4 つの区分に分けます。

| 区分 | 判定 | 掲載への影響 |
| --- | --- | --- |
| 掲載の条件 | ルール | 満たさない版は掲載しない。作者に理由と直し方を返す |
| 乗っ取りの兆候 | ルール | 当たった版は管理者の確認待ちにする |
| 審査の基準 | LLM | 重大な指摘は管理者の確認待ちにする。それ以外は作者に直すことを勧める |
| 推奨 | LLM またはルール | 掲載に影響しない。参考として作者に返す |

## 掲載の条件

| ID | 内容 | 判定の観点 | 出典 |
| --- | --- | --- | --- |
| `attestation` | リリースのすべての配布物に、build provenance の証明がある | 証明の署名を検証し、ソースのリポジトリがこのリポジトリ、ソースの参照が `refs/tags/<タグ>`、ソースのコミットがタグのコミット、署名したワークフローが記録したリリースのワークフローに一致する | スライド 16 枚目、Qiita のコメント、obs-backgroundremoval Issue 775 |
| `immutable-release` | リリースが不変 (immutable) である | GitHub のリリースの API の `immutable` が true | obs-backgroundremoval Issue 775 |
| `distribution-format` | 配布物に exe や msi のインストーラーが無い。Windows 向けは zip で配る | 配布物のファイル名の拡張子 | Qiita のコメント、obs-backgroundremoval Issue 832 |

署名したワークフローは、初めて証明を検証できた版のものを記録します。以後の版で違うワークフローが署名していれば、証明の検証を失敗とします。

## 乗っ取りの兆候

掲載中の版のタグから新しい版のタグまでの差分で判定します。差分は先頭の 24,000 文字までを読みます。

| ID | 内容 |
| --- | --- |
| `diff-workflow-changed` | `.github/workflows/`・`.github/actions/`・`.github/scripts/` 配下のファイルが変わった。ワークフローと、ワークフローが呼ぶ処理の置き場所 |
| `diff-binary-added` | バイナリのファイルが追加または変更された |
| `diff-external-link` | このリポジトリ・`obsproject.com`・倉庫くん以外のホストへのリンクやダウンロードが追加された |
| `diff-too-large` | 差分が 24,000 文字を超えた |
| `owner-changed` | リポジトリの所有者が、登録したときから別のアカウントか組織に変わった。差分ではなく同期で判定し、管理者が版を承認するまで、変更のあとの新しい版に当てる ([ADR 0015](../decisions/0015-repository-rename-and-transfer.md)) |

初めて登録する版と、この基準を入れた時点で掲載中の版には、差分の判定を当てません。

## 審査の基準

LLM は、新しい版のタグの時点の `.github/workflows/`、`CMakeLists.txt`、`buildspec.json`、`vcpkg.json`、README と、乗っ取りの兆候の判定に使った差分を読んで判定します。あわせて、GitHub が検出したリポジトリのライセンスを渡します。文書のファイルの SPDX の見出しを、プラグインのライセンスと取り違えないようにするためです。

| ID | 内容 | 判定の観点 | 重大とする場合 | 出典 |
| --- | --- | --- | --- | --- |
| `ci-source-build` | リリースの配布物を、CI でソースからビルドしている | リリースの資産を作るジョブがソースからビルドしている。外部で作ったバイナリを添付するだけの手順になっていない | なし | スライド 16〜17 枚目 |
| `ci-scenario-tests` | テストが、実際の使い方のシナリオを試している | CI のテストが、ビルドの確認にとどまらず、OBS Studio にプラグインを読み込ませて機能を確かめている | なし | obs-backgroundremoval Issue 971 |
| `no-security-bypass` | 利用者にセキュリティの機能を切らせない | README や導入の手順に、SmartScreen・Defender・Gatekeeper・Smart App Control を無効にさせる案内が無い | 案内がある | obs-backgroundremoval Issue 832、obs-spout2-plugin Issue 105 |
| `dependency-pinning` | 依存をパッケージマネージャーで、版を固定して入れている | ハッシュの無い URL からのダウンロードや、リポジトリに直接入れたバイナリが無い | なし | スライド 17 枚目、obs-backgroundremoval Issue 644 |
| `ci-hardening` | CI を最小の権限で守っている | ワークフローの `permissions` の最小化、アクションの SHA の固定、`persist-credentials: false`、Dependabot の設定 | なし | obs-backgroundremoval PR 805、スライド 19 枚目 |
| `third-party-provenance` | 第三者のモデルやバイナリの出所とライセンスを示している | リリースの配布物に同梱する第三者のモデルやバイナリについて、上流の URL・版・ハッシュと、著作権・ライセンス・特許・再配布の調査の記載。buildspec.json に書かれた OBS Studio のビルド用の依存のように、同梱しないものは対象外 | なし | obs-backgroundremoval PR 974、Issue 983 |
| `license-compatibility` | プラグインと依存のライセンスが両立する | GitHub が検出したリポジトリのライセンスと依存の一覧から、両立しない組み合わせ (例: GPLv2 と OpenCV) が無い | なし | obs-backgroundremoval Issue 644 |
| `user-data-handling` | 映像・音声・設定・鍵を、利用者に知らせずに外部へ送らない | ネットワークの処理の有無と目的。送る場合は README に送り先と内容が書かれ、コードと食い違っていない | README に書かずに送る | スライド 15 枚目、obs-backgroundremoval FAQ |
| `build-hardening` | 防御のためのビルドの設定がある | Sanitizer のビルドの設定と、スタック保護のフラグ | なし | live-backgroundremoval-lite の CMakeLists.txt |

## 推奨

| ID | 内容 | 判定 | 出典 |
| --- | --- | --- | --- |
| `windows-code-signing` | Windows の DLL に Authenticode の署名を付ける。署名の無い DLL は Smart App Control で読み込みを止められることがある | ルール (将来) | obs-backgroundremoval Issue 965 |
| `macos-code-signing` | macOS の配布物に Developer ID の署名と公証を付ける | ルール (将来) | obs-backgroundremoval Issue 971 |
| `user-verification-guide` | 利用者に、ダウンロードしたファイルを検証する手順を示す | LLM | live-backgroundremoval-lite の開発者ノート |
| `install-location` | Windows では `C:\ProgramData\obs-studio\plugins` に置かせる | LLM | obs-backgroundremoval Issue 832 |
| `hermetic-build` | ビルドの環境を絞り、ツールの版を固定する | LLM | obs-backgroundremoval PR 846 |
| `contribution-compliance` | コントリビューターに、ライセンスの同意・DCO・署名付きコミットを求める | LLM | live-backgroundremoval-lite の CONTRIBUTING.md |
| `reuse-compliance` | REUSE に準拠する | ルール (将来) | live-backgroundremoval-lite の CONTRIBUTING.md |
| `license-notices` | 同梱する依存とモデルのライセンスを列挙する | LLM | live-backgroundremoval-lite の README |
| `plugin-name` | プラグインの名前とリポジトリ名に OBS を含めない | ルール (将来) | obs-backgroundremoval Issue 644、OBS Forums の Forum Resource and IP Policy |
| `manifest-consistency` | `buildspec.json` と `data/manifest.json` の名前・版・ID・URL をそろえる | ルール (将来) | live-backgroundremoval-lite の指示 |
| `crash-report-privacy` | クラッシュレポートの公開前に、個人情報が含まれないことを確かめさせる | LLM | obs-backgroundremoval の Issue テンプレート |
| `resource-raii` | OBS の C API の資源を RAII で解放する | LLM | スライド 4 枚目と 10 枚目 |
| `diagnostic-logging` | 失敗の原因を特定できるログを出す | LLM | スライド 11 枚目 |
| `cpu-compatibility` | AVX2 などの命令を無条件に必須にしない | LLM | Qiita の記事「たった３ヶ月で OBS のプラグインを開発し 1.5 万ダウンロードを達成できました！」 |
| `dll-footprint` | 同梱する DLL を減らし、競合を避ける | LLM | live-backgroundremoval-lite の開発者ノート |
| `security-policy` | SECURITY.md で報告の窓口と、対応する版を示す | ルール (将来) | live-backgroundremoval-lite の SECURITY.md |

「ルール (将来)」の項目は、配布物の中身やリポジトリの設定を読む仕組みが要るため、初めは判定せず、作者にも返しません。

## 採らない項目

| 内容 | 理由 |
| --- | --- |
| 生成 AI の生の出力を投稿しない、生成物を製品に入れない、LLM をコードの生成に使わない、エージェントの行動を AGENTS.md で定める | 本サービスは、AI の利用の有無を掲載に影響させない |
| ポータブル版の OBS への導入を支援しないと明記する | 宇田川さんのプロジェクトの設計方針で、ほかのプラグインに求める根拠が無い |
| GPU を占有しない | 同上。判定には実行時の測定も要る |
| 更新の告知にファイルの URL を書かない、リリースの実行に手動の承認を挟む、main で署名付きコミットを必須にする、Issue で LLM の未検証の修正案を出さない、リリース前に全プラットフォームで検証する | リポジトリのファイルやリリースからは判定できない |
