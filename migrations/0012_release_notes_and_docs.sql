-- リリースノートと README 以外の文書の照合 (no-security-bypass と no-terminal-paste、docs/design/scanning.md)。
-- リリースノートの本文は保存せず、照合の結果と本文のハッシュだけを保存する。表の定義と意味は docs/design/data-model.md に記載している。

-- 本文の SHA-256 (16 進)。未照合なら NULL。本文の編集を、ハッシュの変化で知る。
ALTER TABLE release_checks ADD COLUMN notes_hash TEXT;
-- 案内の型に当たった行 ([{line, rule}])。未照合なら NULL。
ALTER TABLE release_checks ADD COLUMN notes_hits TEXT;
-- 照合の後に本文が編集され、新しい本文が型に当たった。1 の間は管理者の確認を待つ。
ALTER TABLE release_checks ADD COLUMN notes_held INTEGER NOT NULL DEFAULT 0 CHECK (notes_held IN (0, 1));

-- README 以外の文書の照合 (verify.yaml の scan-docs.mjs) で当たった箇所 ({hits: [{file, line, rule, text}], truncated})。
-- 通信の検出と同じ結果で届く。network_state が done で NULL なら、この仕組みより前に検出した版で、文書は照合していない。
ALTER TABLE release_checks ADD COLUMN doc_hits TEXT;
