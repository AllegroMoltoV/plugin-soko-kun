-- 新しい版の掲載の条件 (ADR 0013) と、侵害のときに版と期間を示す記録。
-- 表の定義と意味は docs/design/data-model.md に記載している。

-- .soko-kun/config.json の宣言と、初めて証明を検証できた版の署名したワークフロー。
ALTER TABLE plugins ADD COLUMN display_name TEXT;
ALTER TABLE plugins ADD COLUMN declared_os TEXT;
ALTER TABLE plugins ADD COLUMN release_workflow TEXT;

CREATE TABLE release_checks (
  github_release_id INTEGER PRIMARY KEY REFERENCES releases (github_release_id) ON DELETE CASCADE,
  legacy INTEGER NOT NULL DEFAULT 0,
  immutable INTEGER NOT NULL DEFAULT 0,
  base_release_id INTEGER,
  diff_state TEXT NOT NULL DEFAULT 'pending' CHECK (diff_state IN ('pending', 'passed', 'held', 'skipped', 'error')),
  diff_hits TEXT,
  config_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (config_state IN ('pending', 'ok', 'missing', 'invalid', 'no_declared_assets')),
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'done', 'failed')),
  review_attempts INTEGER NOT NULL DEFAULT 0,
  -- Workers AI の無料枠を使い切ったとき、次に LLM のレビューを試す時刻 (1 時間後)。それまでレビューを待たせる。
  review_wait_until TEXT,
  review_json TEXT,
  review_serious INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT,
  admin_approved_at TEXT
);

CREATE TABLE attestation_checks (
  github_asset_id INTEGER PRIMARY KEY REFERENCES assets (github_asset_id) ON DELETE CASCADE,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'passed', 'failed', 'error')),
  reason TEXT,
  signer_workflow TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT
);
CREATE INDEX attestation_checks_pending ON attestation_checks (result, checked_at);

-- 掲載した配布物と期間。プラグインやリリースの削除と連鎖させず、行を削除しない。
CREATE TABLE listing_periods (
  plugin_id TEXT NOT NULL,
  github_release_id INTEGER NOT NULL,
  digest TEXT NOT NULL,
  tag TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  PRIMARY KEY (github_release_id, digest)
);
CREATE INDEX listing_periods_plugin ON listing_periods (plugin_id, started_at);

-- 止めた版。告知ページと警告に使う。プラグインやリリースの削除と連鎖させず、行を削除しない。
CREATE TABLE release_suspensions (
  id INTEGER PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  github_release_id INTEGER NOT NULL UNIQUE,
  tag TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('admin', 'malicious')),
  note TEXT,
  suspended_at TEXT NOT NULL
);
CREATE INDEX release_suspensions_plugin ON release_suspensions (plugin_id);

CREATE TABLE plugin_aliases (
  alias TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE check_log (
  github_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX check_log_user ON check_log (github_user_id, created_at);

-- この時点で保存済みのリリースには、新しい条件を当てない (ADR 0013)。
INSERT INTO release_checks (github_release_id, legacy, diff_state, config_state, review_state)
SELECT github_release_id, 1, 'skipped', 'missing', 'done' FROM releases;
