# 文書索引

公開する文書の索引です。docs/ には、製品の現在の設計と確定した判断を置きます。

| 知りたいこと | 参照先 | 区分 |
| --- | --- | --- |
| プロジェクトの目的と使い方 | `README.md` | |
| 用語の定義 | [用語集](glossary.md) | リファレンス |
| 構成要素と要求の流れ | [アーキテクチャ](design/architecture.md) | 解説 |
| テーブルと掲載状態の算出規則 | [データモデル](design/data-model.md) | リファレンス |
| 認可の流れとスコープ | [認証と認可](design/auth.md) | リファレンス |
| 登録・検査・同期の処理と無料プランの予算 | [検査と同期](design/scanning.md) | リファレンス |
| 新しい版を掲載する前に確かめる項目 | [審査の基準](design/review-criteria.md) | リファレンス |
| 作者の LLM へ検査とレビューの結果を返す MCP のツール | [作者へのレビューの返し方](design/author-feedback.md) | リファレンス |
| 対応言語と言語の判定 | [多言語対応](design/i18n.md) | リファレンス |
| 画面の一覧と各画面の要素 | [画面構成](design/ui.md) | リファレンス |

## 設計判断の記録

確定した設計判断と、未決定の論点を 1 件 1 ファイルで記録します。区分はいずれも解説です。

| 番号 | 判断 | 状態 |
| --- | --- | --- |
| 0001 | [ホスティング基盤](decisions/0001-hosting-cloudflare-workers-free.md) | 採用 |
| 0002 | [認可サーバーと MCP の同居と認証混在](decisions/0002-single-worker-mixed-auth.md) | 採用 |
| 0003 | [配布物の digest の取得方法](decisions/0003-github-digest-without-download.md) | 採用 |
| 0004 | [掲載状態の算出](decisions/0004-computed-listing-status.md) | 採用 |
| 0005 | [MalwareBazaar の未登録の扱い](decisions/0005-malwarebazaar-not-found-as-clean.md) | 採用 |
| 0006 | [VirusTotal の未登録の扱い](decisions/0006-virustotal-not-found-undecided.md) | 置き換え済み (0012) |
| 0007 | [検査と同期の実行方式](decisions/0007-asynchronous-scanning-with-cron.md) | 採用 |
| 0008 | [公開文書と作業記録の分担](decisions/0008-docs-and-work-records.md) | 採用 |
| 0009 | [VirusTotal の検出の閾値](decisions/0009-virustotal-detection-threshold.md) | 置き換え済み (0012) |
| 0010 | [プラグインの説明文の機械翻訳](decisions/0010-machine-translation-of-summaries.md) | 採用 |
| 0011 | [プラグインの画像を Worker から配信する](decisions/0011-plugin-images-hosted-by-worker.md) | 採用 |
| 0012 | [VirusTotal を照会先から外す](decisions/0012-drop-virustotal.md) | 採用 |
| 0013 | [新しい版の掲載の条件と開発の実践のレビュー](decisions/0013-release-provenance-and-review.md) | 採用 |
| 0014 | [証明の署名の検証を GitHub Actions で行う](decisions/0014-attestation-verification-in-actions.md) | 採用 |
| 0015 | [リポジトリの名前の変更と移管を ID で追い、所有者の変更は管理者が確かめる](decisions/0015-repository-rename-and-transfer.md) | 採用 |
| 0016 | [開発の実践のレビューを、項目ごとにルールと LLM に分け、ルールの事実を LLM に渡す](decisions/0016-review-by-rules-and-facts.md) | 採用 |

## 運用手順

開発と運用の作業の手順です。区分はいずれもハウツーです。

| やりたいこと | 参照先 |
| --- | --- |
| 手元で Worker を起動し、テストと MCP の接続を確かめる | [ローカルでの開発](operations/local-development.md) |
| プラグインの掲載を止める、再開する、通報に対応する | [掲載停止と再開](operations/suspend.md) |
| 侵害が疑われる版を止め、影響を受けた版と期間を告知する | [侵害の対応](operations/incident-response.md) |
| D1 のデータを保存する、過去の時点へ戻す | [バックアップと復元](operations/backup.md) |
| ワークフローの権限を知る、本番の設定をそろえて配備する | [CI と配備](operations/ci-cd.md) |
| 公式の MCP Registry に登録する、登録を更新する。Glama の掲載を確かめる | [公式 MCP Registry への登録](operations/mcp-registry.md) |

作業の記録 (調査報告、実行ログ、計画、依頼者との確認事項) は公開せず、git の追跡対象外に置きます。その索引は `.prompts/INDEX.md` にあります。
