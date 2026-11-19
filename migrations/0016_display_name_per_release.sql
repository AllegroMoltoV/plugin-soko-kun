-- 表示名と対応 OS を版ごとに保存する (8fh)。表の定義と意味は docs/design/data-model.md に記載している。
-- 掲載中の版の行の値を表示し、確認待ちや条件を満たさない新しい版の値が、掲載中の版の表示に出ないようにする。
ALTER TABLE release_checks ADD COLUMN display_name TEXT;
ALTER TABLE release_checks ADD COLUMN declared_os TEXT;

-- 既存の行には plugins の今の値を写し、今の表示を変えない。plugins の display_name と declared_os は、以後は書かない。
UPDATE release_checks SET
  display_name = (SELECT p.display_name FROM plugins p JOIN releases r ON r.plugin_id = p.id WHERE r.github_release_id = release_checks.github_release_id),
  declared_os = (SELECT p.declared_os FROM plugins p JOIN releases r ON r.plugin_id = p.id WHERE r.github_release_id = release_checks.github_release_id);
