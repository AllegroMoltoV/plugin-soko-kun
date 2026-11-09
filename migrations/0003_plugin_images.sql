-- プラグインのロゴと説明の画像。作者がリポジトリの .soko-kun/ に置いたファイルを、同期のときに取得して保存する。
ALTER TABLE plugins ADD COLUMN images_tag TEXT;
ALTER TABLE plugins ADD COLUMN images_hidden INTEGER NOT NULL DEFAULT 0;

CREATE TABLE plugin_images (
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'image')),
  blob_sha TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (plugin_id, kind)
);
