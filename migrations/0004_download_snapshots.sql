-- GitHub でのダウンロード数の日ごとの記録。週間の数は、最新の記録と 7 日以上前の記録の差で求める。
CREATE TABLE download_snapshots (
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  total INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, day)
);
