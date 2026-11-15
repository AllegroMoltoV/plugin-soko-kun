-- 掲載の後の既定のブランチの README の照合 (no-security-bypass と no-terminal-paste、docs/design/scanning.md)。
-- README の本文は保存せず、当たった行の本文のハッシュと、管理者が確かめるための当たった行だけを保存する。表の定義と意味は docs/design/data-model.md に記載している。

-- 照合の基準。当たった行の本文の SHA-256 (16 進) の集合 (JSON の配列) か、README が上限を超えたことを示す 'too_large'。未照合なら NULL。
ALTER TABLE plugins ADD COLUMN readme_state TEXT;
-- 最後の照合で当たった行 ([{line, rule, text}]) か、照合に失敗した理由 ({error})。管理者の確認にだけ使う。
ALTER TABLE plugins ADD COLUMN readme_hits TEXT;
-- 基準に無い当たった行が現れた、README が新たに上限を超えた、または照合に失敗した。1 の間はどの版も掲載しない。
ALTER TABLE plugins ADD COLUMN readme_held INTEGER NOT NULL DEFAULT 0 CHECK (readme_held IN (0, 1));
