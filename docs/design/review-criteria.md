# 審査の基準

新しい版を掲載する前に確かめる項目の一覧です。本文書が審査の基準の正本です。MCP で作者に返す固定の文言 (英語) は `src/review/criteria.ts` に項目の ID ごとに持ち、本文書の ID と判定の方法が一致することをテストで確かめます。作者への返し方は [作者へのレビューの返し方](author-feedback.md) に、この基準を採った判断は [ADR 0013](../decisions/0013-release-provenance-and-review.md) に、判定の方法を項目ごとに分けた判断は [ADR 0016](../decisions/0016-review-by-rules-and-facts.md) に記載します。

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
| 審査の基準 | ルールまたは LLM | 重大な指摘は管理者の確認待ちにする。それ以外は作者に直すことを勧める |
| 推奨 | ルールまたは LLM | 掲載に影響しない。参考として作者に返す |

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

## 判定の方法

審査の基準と推奨の項目は、判定に要るものに応じて、ルール・LLM・判定しない、のいずれかで判定します。ファイルを見れば機械的に決まる項目はルールで判定し、同じリポジトリには同じ結果を返します。文章の意図を読む必要がある項目だけを LLM が判定します。入力に無い知識が要る項目は、材料を確実に得られるまで判定しません。

入力は、新しい版のタグの時点のファイルの一覧と、一覧から選んで取得したファイルです。取得するのは、`.github/workflows/` のワークフロー (6 件まで)・README・`CMakeLists.txt`・パスに compiler を含む `cmake/` 配下のファイル (2 件まで)・`vcpkg.json`・`CONTRIBUTING.md`・`.github/PULL_REQUEST_TEMPLATE.md`・`.github/ISSUE_TEMPLATE/` のテンプレート (`config.yml` を除いて 2 件まで) です。一覧に無いファイルは取得しません。ソースのコードと配布物の中身は読みません。ファイルの一覧が大きすぎて切り詰められたときは、ファイルの有無とワークフローで決める判定を判定不能にします。

LLM には、README・ワークフロー・Issue のテンプレート・乗っ取りの兆候の判定に使った差分と、本サービスが計算した次の事実を渡します。LLM が自分で探す手間と、足りない情報を思い込みで埋める余地を減らすためです。LLM に道具を渡して自分で調べさせることはしません。呼び出しが増えて無料枠と外部呼び出しの上限に当たり、リポジトリの内容から道具を呼ばせる攻撃の入り口も増えるためです。

* ファイルの一覧が完全かどうか、Issue のテンプレートの名前、`.github/scripts/` 配下のスクリプトの名前
* README の見出しと行番号、README に現れる URL のホストと行番号、API や送信に触れる行の番号
* 新しい版のソースのコードから検出した通信の API の使用 (ファイル・行・API の名前・行の文字列)。検出は GitHub Actions で行い、ソースは実行しない。確認のモードと、検出の結果が届かないまま期限を過ぎた版では、検出していないことを伝える
* ルールで判定した項目の結果

LLM には、各項目の観点がリポジトリに当てはまれば満たす、当てはまらなければ満たさない、ファイルから決められなければ判定不能と答えさせます。指摘の根拠は、LLM に渡したファイルと差分に現れるファイルだけを残します。根拠の残らない指摘は重大にしません。同じ項目をルールと LLM の両方が判定したときは、ルールの結果を使います。

## 審査の基準

| ID | 内容 | 判定 | 判定の観点 | 重大とする場合 | 出典 |
| --- | --- | --- | --- | --- | --- |
| `ci-source-build` | リリースの配布物を、CI でソースからビルドしている | 判定しない | 掲載の条件の `attestation` で、配布物がこのリポジトリのワークフローでビルドされたことを確かめるため、レビューでは判定しない | なし | スライド 16〜17 枚目 |
| `ci-scenario-tests` | テストが、実際の使い方のシナリオを試している | LLM | CI のテストが、ビルドの確認にとどまらず、OBS Studio にプラグインを読み込ませて機能を確かめている。`.github/scripts/` のスクリプトの名前を事実として渡す | なし | obs-backgroundremoval Issue 971 |
| `no-security-bypass` | 利用者にセキュリティの機能を切らせない | LLM | README や導入の手順に、SmartScreen・Defender・Gatekeeper・Smart App Control を無効にさせる手順が無い | 手順がある | obs-backgroundremoval Issue 832、obs-spout2-plugin Issue 105 |
| `dependency-pinning` | 依存をパッケージマネージャーで、版を固定して入れている | ルール | ファイルの一覧に拡張子が `.dll`・`.lib`・`.so`・`.dylib`・`.a`・`.exe` のファイルが無い。読んだ CMake のファイルで、`FetchContent_Declare` の `GIT_TAG` が 40 桁のコミットか `URL_HASH` があり、`file(DOWNLOAD` に `EXPECTED_HASH` がある。`vcpkg.json` があれば `builtin-baseline` か `vcpkg-configuration.json` がある | なし | スライド 17 枚目、obs-backgroundremoval Issue 644 |
| `ci-hardening` | CI を最小の権限で守っている | ルール | 読んだ各ワークフローに `permissions` があり `write-all` が無い。ローカルと `docker://` を除くアクションの参照が 40 桁のコミット。`actions/checkout` の数だけ `persist-credentials: false` がある。`.github/dependabot.yml` がある | なし | obs-backgroundremoval PR 805、スライド 19 枚目 |
| `third-party-provenance` | 第三者のモデルやバイナリの出所とライセンスを示している | 判定しない | 配布物の中身を読まないため、同梱するものが分からない | なし | obs-backgroundremoval PR 974、Issue 983 |
| `license-compatibility` | プラグインと依存のライセンスが両立する | 判定しない | 依存のライセンスの一覧を入力に持たないため | なし | obs-backgroundremoval Issue 644 |
| `user-data-handling` | 映像・音声・設定・鍵を、利用者に知らせずに外部へ送らない | LLM | 通信の API の検出の結果、README、ワークフローから送る機能があると分かる場合に、README に送り先と内容が書かれている。検出していない版で送る機能の有無が分からなければ判定不能とする | 通信の API が見つかり、README が外部のホストにも送信にも一切触れていない | スライド 15 枚目、obs-backgroundremoval FAQ |
| `build-hardening` | 防御のためのビルドの設定がある | ルール | 読んだ CMake のファイルに、Sanitizer の指定 (`-fsanitize`) とスタック保護の指定 (`-fstack-protector` か `/GS`) の両方がある。MSVC は `/GS` を既定で有効にするが、設定の明示を求める | なし | live-backgroundremoval-lite の CMakeLists.txt |

## 推奨

| ID | 内容 | 判定 | 出典 |
| --- | --- | --- | --- |
| `windows-code-signing` | Windows の DLL に Authenticode の署名を付ける。署名の無い DLL は Smart App Control で読み込みを止められることがある | ルール (将来) | obs-backgroundremoval Issue 965 |
| `macos-code-signing` | macOS の配布物に Developer ID の署名と公証を付ける | ルール (将来) | obs-backgroundremoval Issue 971 |
| `user-verification-guide` | 利用者に、ダウンロードしたファイルを検証する手順を示す。README に `gh attestation verify`・SHA-256・checksum・`Get-FileHash`・ハッシュのいずれかがあれば満たす | ルール | live-backgroundremoval-lite の開発者ノート |
| `install-location` | Windows では `C:\ProgramData\obs-studio\plugins` に置かせる。README にこのパスがあれば満たす | ルール | obs-backgroundremoval Issue 832 |
| `hermetic-build` | ビルドのランナーの版を固定する。読んだワークフローに `-latest` のランナーが無ければ満たす。PATH の絞り込みは判定しない | ルール | obs-backgroundremoval PR 846 |
| `contribution-compliance` | コントリビューターに、ライセンスの同意・DCO・署名付きコミットを求める。`CONTRIBUTING.md` か PR のテンプレートに DCO・Signed-off-by・sign-off のいずれかがあれば満たす | ルール | live-backgroundremoval-lite の CONTRIBUTING.md |
| `reuse-compliance` | REUSE に準拠する | ルール (将来) | live-backgroundremoval-lite の CONTRIBUTING.md |
| `license-notices` | 同梱する依存とモデルのライセンスを列挙する | 判定しない | live-backgroundremoval-lite の README |
| `plugin-name` | プラグインの名前とリポジトリ名に OBS を含めない | ルール (将来) | obs-backgroundremoval Issue 644、OBS Forums の Forum Resource and IP Policy |
| `manifest-consistency` | `buildspec.json` と `data/manifest.json` の名前・版・ID・URL をそろえる | ルール (将来) | live-backgroundremoval-lite の指示 |
| `crash-report-privacy` | クラッシュレポートの公開前に、個人情報が含まれないことを確かめさせる。Issue のテンプレートが無ければルールで満たさないとし、あれば LLM が中身を読む | LLM | obs-backgroundremoval の Issue テンプレート |
| `resource-raii` | OBS の C API の資源を RAII で解放する | 判定しない | スライド 4 枚目と 10 枚目 |
| `diagnostic-logging` | 失敗の原因を特定できるログを出す | 判定しない | スライド 11 枚目 |
| `cpu-compatibility` | AVX2 などの命令を無条件に必須にしない。読んだ CMake のファイルに `/arch:AVX2`・`/arch:AVX512`・`-mavx2`・`-mavx512`・`-march=native` が無ければ満たす | ルール | Qiita の記事「たった３ヶ月で OBS のプラグインを開発し 1.5 万ダウンロードを達成できました！」 |
| `dll-footprint` | 同梱する DLL を減らし、競合を避ける | 判定しない | live-backgroundremoval-lite の開発者ノート |
| `security-policy` | SECURITY.md で報告の窓口と、対応する版を示す | ルール (将来) | live-backgroundremoval-lite の SECURITY.md |

「ルール (将来)」の項目は、配布物の中身やリポジトリの設定を読む仕組みが要るため、初めは判定せず、作者にも返しません。「判定しない」の項目は、ソースのコード・配布物の中身・依存のライセンスの一覧のように、今の入力に無い材料が要るため判定せず、作者にも返しません。材料を確実に得られるようになったら判定に戻します。

## 採らない項目

| 内容 | 理由 |
| --- | --- |
| 生成 AI の生の出力を投稿しない、生成物を製品に入れない、LLM をコードの生成に使わない、エージェントの行動を AGENTS.md で定める | 本サービスは、AI の利用の有無を掲載に影響させない |
| ポータブル版の OBS への導入を支援しないと明記する | 宇田川さんのプロジェクトの設計方針で、ほかのプラグインに求める根拠が無い |
| GPU を占有しない | 同上。判定には実行時の測定も要る |
| 更新の告知にファイルの URL を書かない、リリースの実行に手動の承認を挟む、main で署名付きコミットを必須にする、Issue で LLM の未検証の修正案を出さない、リリース前に全プラットフォームで検証する | リポジトリのファイルやリリースからは判定できない |
