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

いずれのコマンドも、`--remote` を付けると本番の D1 を更新します。付けない場合はローカルの D1 を更新します。`<owner/repo>` はプラグイン ID で、大文字と小文字を区別しません。

停止の理由は 1〜200 文字で、制御文字を含められません。理由は、停止中の詳細ページに公開されます。通報者の名前や非公開の調査内容を理由に書かないでください。

`show` は、`admin_suspended`・`suspended_reason`・`removed`・`last_synced_at` を表示します。

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

## 通報を受けたとき

通報は、公開してよい内容を GitHub Issues で、マルウェアの疑いのような非公開の内容を GitHub の Private vulnerability reporting で受け付けます。通報を受けたら、次の順で対応します。

1. 通報の対象のプラグイン ID を特定し、`show` で現在の値を確認します。
2. 詳細ページで、掲載対象バージョン・配布物の SHA-256・検査結果を確認します。
3. 利用者への被害のおそれがある場合は、調査の前に停止します。理由には、公開してよい範囲の内容を書きます。
4. GitHub のリポジトリとリリース、VirusTotal の解析結果を確認し、通報の内容を調べます。
5. 通報が誤りと判断した場合は、再開します。
6. 調べた結果と対応を通報者へ返答します。Private vulnerability reporting で受けた通報には、同じ非公開の場で返答します。

## 要確認の結果を受けたとき

VirusTotal の検査結果が `suspicious` の配布物を持つリリースは、掲載を保留します。管理者は、`suspicious` の配布物を定期的に確認します。次のコマンドで、本番の D1 から一覧を取得できます。

```sh
npx wrangler d1 execute DB --remote --env production --command "SELECT r.plugin_id, r.tag, a.name, s.digest, s.detail, s.scanned_at FROM scans s JOIN assets a ON a.digest = s.digest JOIN releases r ON r.github_release_id = a.release_id WHERE s.scanner = 'virustotal' AND s.result = 'suspicious'"
```

`detail` は、`malicious` のエンジン数・全エンジン数・`suspicious` のエンジン数を示します。VirusTotal で同じ SHA-256 の解析結果を確認し、マルウェアと判断した場合は停止します。

問題がないと判断した場合は、次のコマンドで、そのプラグインの `suspicious` の結果を `clean` に変えます。`detail` には、管理者が確認した日時を残します。

```bash
npm run admin -- approve-suspicious <owner/repo> --remote
```

判断の背景は [ADR 0009](../decisions/0009-virustotal-detection-threshold.md) に記載しています。
