-- リポジトリの名前の変更と移管の扱い (ADR 0015)。
-- 表の定義と意味は docs/design/data-model.md に記載している。

-- 同期で所有者の変更を検出した日時。値がある間は、まだ掲載していない新しい版を管理者の確認待ちにする。
ALTER TABLE plugins ADD COLUMN owner_changed_at TEXT;

-- 旧い owner/repo を、大文字と小文字を保ったまま記録する。名前を変える前に作られた証明は、この名前でしか検証に通らない。
ALTER TABLE plugin_aliases ADD COLUMN name TEXT;

-- 既存の行は大文字と小文字を記録していないため、現在の所有者名と、旧い ID のリポジトリ名から作る。
UPDATE plugin_aliases
SET name = (SELECT p.owner FROM plugins p WHERE p.id = plugin_aliases.plugin_id) || substr(alias, instr(alias, '/'))
WHERE name IS NULL;
