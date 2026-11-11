-- 説明の画像から作った表示用の WebP の画像。詳細ページを軽く表示するため、定期処理が作って保存する。
CREATE TABLE plugin_image_previews (
  plugin_id TEXT PRIMARY KEY REFERENCES plugins (id) ON DELETE CASCADE,
  source_sha TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  made_at TEXT NOT NULL
);
