# ADR 0012: VirusTotal を照会先から外す

- 状態: 採用 (2026-11-09)
- 置き換える判断: [ADR 0006](0006-virustotal-not-found-undecided.md)、[ADR 0009](0009-virustotal-detection-threshold.md)

## 背景

本サービスは、配布物の `digest` を VirusTotal の Public API と MalwareBazaar へ照会していました。2026-11-09 に実際の API キーで照会したところ、依頼者の 3 つのプラグインの配布物 8 件は、VirusTotal ではすべて `not_found` でした。VirusTotal のハッシュ照会は解析済みのファイルにだけ結果を返すため、新しいリリースの配布物は、誰かがアップロードするまで結果が得られません。

ADR 0006 の扱いでは、VirusTotal の `not_found` の配布物を持つリリースは掲載されません。また、VirusTotal の Public API は商用の製品やサービスでの利用を禁じており、非営利の OSS レジストリへの適用は問い合わせ中でした。

## 決定

VirusTotal の API を使わず、配布物の照会先を MalwareBazaar だけにします。VirusTotal へのリンクも置きません。MalwareBazaar の `not_found` は、ADR 0005 のとおり確定として扱います。詳細ページには、配布物の SHA-256 と、検査で何も検出されなくても安全とは限らない旨を、これまでどおり表示します。依頼者が 2026-11-09 に決定しました。

## 検討した選択肢

| 選択肢 | 判断 |
| --- | --- |
| VirusTotal の `not_found` は掲載を保留し、作者にアップロードを案内する | 採用しませんでした。作者がアップロードしない限り掲載されません。利用条件の不安も残ります |
| VirusTotal を補助に回し、検出があれば停止し、`not_found` では掲載を止めない | 採用しませんでした。新しいファイルはほぼ `not_found` のため効果が小さく、利用条件の不安が残ります |
| VirusTotal の API をやめ、詳細ページに VirusTotal のページへのリンクを置く | 採用しませんでした。新しいファイルはリンク先でも未登録と表示されることが多く、効果が小さいためです |
| VirusTotal の API もリンクもやめる | 採用しました。掲載が止まらず、利用条件の問題もなくなります |

## 影響

自動の照合は、MalwareBazaar が収録している既知のマルウェアの検体だけになります。未知のマルウェアは検出できません。利用者には、検出なしは安全の保証ではない旨を表示し続けます。検査結果の値のうち、VirusTotal だけが返していた `clean` と `suspicious` は記録しなくなり、管理コマンド `approve-suspicious` も廃止します。既存の VirusTotal の検査結果は、マイグレーション `0005` で削除します。
