-- 管理者の確認待ちの Discord への通知の記録 (src/domain/admin-notify.ts)。表の定義と意味は docs/design/data-model.md に記載している。
-- key は、版の単位の理由なら r:<github_release_id>:<理由>、プラグインの単位の理由なら p:<内部のプラグイン ID>:<理由>。
-- 確認待ちが解けたら行を消し、同じ理由で確認待ちに戻ったときに知らせ直す。
CREATE TABLE admin_notifications (
  key TEXT PRIMARY KEY,
  notified_at TEXT NOT NULL
);
