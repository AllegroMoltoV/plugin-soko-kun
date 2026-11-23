# 掲載停止と再開

管理者がプラグインの掲載を止める手順と、止めた掲載を再開する手順です。管理画面はありません。管理用スクリプト `scripts/admin.mjs` が `wrangler d1 execute` で D1 を直接更新します。

停止すると、プラグインは Web の一覧と `search_plugins` から外れます。詳細ページと `get_plugin` は、状態と理由だけを示し、ダウンロードの案内を出しません。

## 前提

- `npm ci` で依存を導入済みであること。
- 本番の D1 を操作する場合は、`wrangler` が Cloudflare のアカウントへ認証済みであること。
- 本番の D1 を操作する場合は、`wrangler.jsonc` に `production` 環境が設定されていること。`--remote` は `--env production` を付けて `wrangler` を呼び出します。

## コマンド

| 操作 | コマンド |
| --- | --- |
| 停止 | `npm run admin -- suspend <owner/repo> "<理由>"` |
| 再開 | `npm run admin -- resume <owner/repo>` |
| 状態の確認 | `npm run admin -- show <owner/repo>` |
| 画像の非表示 | `npm run admin -- hide-images <owner/repo>` |
| 画像の再表示 | `npm run admin -- show-images <owner/repo>` |
| カテゴリの変更 | `npm run admin -- set-category <owner/repo> <category>` |
| 確認待ちの版の一覧 | `npm run admin -- pending` |
| 確認待ちの版の承認 | `npm run admin -- approve-release <owner/repo> <tag>` |
| README の照合による確認待ちの解除 | `npm run admin -- approve-readme <owner/repo>` |
| 版の停止 | `npm run admin -- suspend-release <owner/repo> <tag> "<告知の文>"` |
| 試行を使い切った証明の検証のやり直し | `npm run admin -- retry-attestations <owner/repo> <tag> [--include-failed]` |
| 試行を使い切った MalwareBazaar の照会のやり直し | `npm run admin -- retry-scans <owner/repo> <tag>` |
| すべての版の、試行を使い切った MalwareBazaar の照会のやり直し | `npm run admin -- retry-all-scans` |

いずれのコマンドも、`--remote` を付けると本番の D1 を更新します。付けない場合はローカルの D1 を更新します。`<owner/repo>` はプラグイン ID で、大文字と小文字を区別しません。

停止の理由は 1〜200 文字で、制御文字を含められません。理由は、停止中の詳細ページに公開されます。通報者の名前や非公開の調査内容を理由に書かないでください。

`show` は、`admin_suspended`・`suspended_reason`・`removed`・`images_hidden`・`last_synced_at` と、`listing_periods` の掲載の期間、`release_suspensions` の止めた版を表示します。

版やプラグインが管理者の確認待ちになると、定期処理が 15 分ほどで管理者だけが見られる Discord のチャンネルへ通知します。通知は確認待ちの理由ごとに 1 回で、プラグインの ID・タグ・理由の code・GitHub のリリースの URL だけを載せます。通知を受けたら `pending --remote` で詳細を確かめます。通知の成否は、定期処理のログの `adminNotify` に出ます (`sent`・`skipped_none`・`skipped_no_url`・`skipped_budget`・`failed_<状態>`)。`failed_` が続くときは、webhook の URL が無効になっていないかを Discord で確かめ、`DISCORD_WEBHOOK_URL` を設定し直します。

`pending` は、掲載の条件を満たしていない新しい版を、理由とともに表示します。掲載中の版より前に公開された版は表示しません。承認しても掲載されないためです。管理者の確認を待つ理由は、乗っ取りの兆候に当たったファイル、開発の実践のレビューの重大な指摘とその該当の箇所、レビューの失敗です。重大な指摘には、ルールで判定した `no-security-bypass` と `no-terminal-paste` の指摘と、LLM が判定した `user-data-handling` の指摘があり、表示では区別しません。ルールの指摘の説明は `Checked by rules` で始まります。証明の検証を待っている版も、検証のワークフローが止まっていないことを確かめられるよう、待っている時間とともに表示します。`pending` の `waiting_minutes` は、版の公開からの経過時間 (分) です。新しい版の検査は通常 30 分ほどで進むため、大きく延びているときは定期処理のログ (`releasesChecked`、`releaseChecksSkipped`、`stoppedBy`) を確かめます。`attestations_exhausted` は、証明の検証が `error` のまま試行を 5 回使い切った配布物の数です。これらは検証待ちから外れ、作者には管理者の確認待ち (`attestation_retries_exhausted`) と返ります。原因 (配布物の取得の失敗、GitHub や Sigstore の障害など) を確かめてから `retry-attestations` で検証待ちに戻すと、次の `verify.yaml` の起動で検証し直します。`attestations_failed` は、証明の検証が `failed` になった配布物の数です。作者には `attestation_failed` と返ります。障害の時期と重なるなど、一時的な障害を本物の失敗と取り違えた疑いがあれば、`--include-failed` を付けて実行します。理由が `no_attestation` と `verification_failed` の配布物も検証待ちに戻します。正しい証明の無い配布物は、検証し直しても同じ結果になります。ハッシュとリポジトリ ID の不一致は戻しません。`scans_exhausted` は、MalwareBazaar の照会が `error` のまま 5 回続いた配布物の数です。作者には `scan_retries_exhausted` と返ります。この列が 1 以上の版は、旧い版 (legacy) と掲載の期間を持つ版と管理者が承認した版も表示します。掲載中だった版が照会し直しで止まった場合も含むためです。戻す手順は後述の「試行を使い切った MalwareBazaar の照会のやり直し」に記載しています。`approve-release` は、乗っ取りの兆候とレビューの指摘による確認待ちを解きます。所有者の変更による確認待ちも解きます ([ADR 0015](../decisions/0015-repository-rename-and-transfer.md))。証明・不変・配布の形の条件と、MalwareBazaar の照会の試行切れは解けません。

`pending` は、掲載中の版のうち、照合の後にリリースノートへ案内が足された版 (`notes_held` が 1) も、当たった行 (`notes_hits`) とともに表示します。この確認待ちも `approve-release` で解きます。続けて、掲載の後に既定のブランチの README へ案内が足されたプラグイン (`readme_held` が 1) を、当たった行 (`readme_hits`) とともに表示します。`readme_hits` が `{error}` のときは、README の照合に失敗しています。このプラグインはどの版も掲載しません。README を確かめ、問題が無ければ `approve-readme` で解きます。解いた時点の README が次の照合の基準になります。案内が利用者を危険にさらすものなら、解かずに作者へ連絡するか、`suspend` で停止します。照合の仕組みは [スキャンの設計](../design/scanning.md) に記載しています。

`suspend-release` は版を止め、告知の文とともに `release_suspensions` に記録します。同じ版にもう一度実行すると、告知の文を書き換えます。告知の文は公開されます。侵害が疑われるときの手順は [侵害の対応](incident-response.md) に記載します。

`hide-images` は、掲載を続けたままロゴと説明の画像だけを止めます。不適切な画像の通報を受けたときに使います。

## 停止

1. 対象のプラグインの現在の値を確認します。

   ```sh
   npm run admin -- show <owner/repo> --remote
   ```

2. 理由を添えて停止します。

   ```sh
   npm run admin -- suspend <owner/repo> "<理由>" --remote
   ```

3. 出力の `admin_suspended` が 1 であることを確認します。
4. 詳細ページ `<ORIGIN>/plugins/<owner>/<repo>` を開き、掲載停止の表示と理由を確認します。ダウンロードボタンが無いことも確認します。

停止は、Cron の同期では解除されません。同期は `admin_suspended` を変更しないためです。

## 再開

1. 管理停止を解除します。

   ```sh
   npm run admin -- resume <owner/repo> --remote
   ```

2. 出力の `admin_suspended` が 0 であることを確認します。
3. 詳細ページを開き、掲載状態を確認します。

`resume` は、管理者の停止を解いて理由を消すだけです。掲載の可否は、検査結果から改めて算出されます。再開後の状態は次のいずれかになります。

| 条件 | 再開後の状態 |
| --- | --- |
| GitHub でリポジトリが削除または非公開になっている | 掲載終了 |
| いずれかのリリースの配布物の検査結果が `malicious` | 停止 |
| 検査済みのリリースがある | 掲載中 |
| 上のいずれにも当てはまらない | 検査待ち |

算出の規則は [データモデル](../design/data-model.md) に記載しています。

## 試行を使い切った MalwareBazaar の照会のやり直し

MalwareBazaar の照会は、`error` が 5 回続くと自動では照会しません。その版は `scan_retries_exhausted` で掲載を止め、管理者への通知に載ります。鍵の失効や MalwareBazaar の障害のように原因が解消したときに、管理者が照会を照会待ちに戻します。

1. `pending --remote` で、`scans_exhausted` が 1 以上の版を探します。
2. 定期処理のログと MalwareBazaar の状態で、失敗の原因が解消したことを確かめます。
3. 版の照会を照会待ちに戻します。

   ```sh
   npm run admin -- retry-scans <owner/repo> <tag> --remote
   ```

4. 出力で、`error` だった配布物の結果が `pending` に、`attempts` が 0 に戻ったことを確認します。次の定期処理で照会し直します。

MalwareBazaar の障害が続くと、その間に照会した掲載中の版が一斉に上限に達します。版ごとに戻しきれないときは、すべての版の試行切れを戻します。

```sh
npm run admin -- retry-all-scans --remote
```

どちらも、`error` で 5 回に達した照会だけを戻します。ほかのプラグインの同じタグの版は戻しません。

## 通報を受けたとき

通報は、公開してよい内容を GitHub Issues で、マルウェアの疑いのような非公開の内容を GitHub の Private vulnerability reporting で受け付けます。通報を受けたら、次の順で対応します。

1. 通報の対象のプラグイン ID を特定し、`show` で現在の値を確認します。
2. 詳細ページで、掲載対象バージョン・配布物の SHA-256・検査結果を確認します。
3. 利用者への被害のおそれがある場合は、調査の前に停止します。理由には、公開してよい範囲の内容を書きます。
4. GitHub のリポジトリとリリースを確認し、通報の内容を調べます。
5. 通報が誤りと判断した場合は、再開します。
6. 調べた結果と対応を通報者へ返答します。Private vulnerability reporting で受けた通報には、同じ非公開の場で返答します。
