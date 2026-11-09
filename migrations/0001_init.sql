-- 掲載状態は列に保存せず、scans と admin_suspended と removed から問い合わせのたびに算出する。
-- 同期と管理操作が競合しても、停止したプラグインが再公開されないようにするため。

CREATE TABLE plugins (
  id TEXT PRIMARY KEY,                     -- owner/repo を小文字化した slug
  github_repo_id INTEGER NOT NULL UNIQUE,  -- 重複登録の防止とリネームへの追従に使う
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  summary TEXT,                            -- GitHub 由来の外部データ
  license_spdx TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  admin_suspended INTEGER NOT NULL DEFAULT 0,
  suspended_reason TEXT,
  removed INTEGER NOT NULL DEFAULT 0,      -- GitHub で 404 または非公開になった
  submitter_github_id INTEGER NOT NULL,
  releases_etag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT NOT NULL
);

CREATE TABLE releases (
  github_release_id INTEGER PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  name TEXT,                               -- GitHub 由来の外部データ
  commit_sha TEXT NOT NULL,
  published_at TEXT NOT NULL,
  html_url TEXT NOT NULL
);
CREATE INDEX releases_plugin ON releases (plugin_id, published_at);

CREATE TABLE assets (
  github_asset_id INTEGER PRIMARY KEY,
  release_id INTEGER NOT NULL REFERENCES releases (github_release_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  digest TEXT NOT NULL,                    -- sha256:<hex>。GitHub が付けた値
  download_url TEXT NOT NULL,
  os TEXT                                  -- windows / macos / linux。ソース系は NULL
);
CREATE INDEX assets_release ON assets (release_id);

-- digest ごとに結果を持ち、新しいリリースや digest の変化に過去の結果を流用しない。
CREATE TABLE scans (
  digest TEXT NOT NULL,
  scanner TEXT NOT NULL CHECK (scanner IN ('virustotal', 'malwarebazaar')),
  result TEXT NOT NULL CHECK (result IN ('pending', 'clean', 'suspicious', 'malicious', 'not_found', 'error')),
  detail TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT,
  PRIMARY KEY (digest, scanner)
);
CREATE INDEX scans_pending ON scans (result, scanned_at);

CREATE TABLE submit_log (
  github_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  outcome TEXT NOT NULL
);
CREATE INDEX submit_log_user ON submit_log (github_user_id, created_at);

CREATE TABLE rate_limit (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
