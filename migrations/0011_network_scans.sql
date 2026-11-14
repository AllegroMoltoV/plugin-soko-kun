-- 新しい版のソースのコードからの通信の API の検出 (ADR 0016、docs/design/scanning.md の「通信の検出」)。
-- 表の定義と意味は docs/design/data-model.md に記載している。

ALTER TABLE release_checks ADD COLUMN network_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (network_state IN ('pending', 'done', 'error', 'skipped'));
-- 検出で当たった箇所 ([{file, line, api, text}]) と、50 件を超えたかどうか ({hits, truncated})。
ALTER TABLE release_checks ADD COLUMN network_hits TEXT;
ALTER TABLE release_checks ADD COLUMN network_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE release_checks ADD COLUMN network_checked_at TEXT;

-- この仕組みを入れた時点の版には当てない。
UPDATE release_checks SET network_state = 'skipped';
