-- カテゴリの utility を廃止し、その他 (other) へまとめる。
UPDATE plugins SET category = 'other' WHERE category = 'utility';

-- プラグインの概要の機械翻訳。概要が変わると source_hash が一致しなくなり、翻訳し直す。
CREATE TABLE plugin_translations (
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  translated_at TEXT NOT NULL,
  PRIMARY KEY (plugin_id, lang)
);
