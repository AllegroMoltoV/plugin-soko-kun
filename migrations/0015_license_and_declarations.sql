-- 版ごとのライセンスの判定と、宣言ファイルの申告 (ADR 0018)。表の定義と意味は docs/design/data-model.md に記載している。
-- license_state は src/domain/license.ts の判定の結果。declarations は src/domain/declarations.ts の形の JSON で、宣言ファイルが無いか誤りの版は NULL。
ALTER TABLE release_checks ADD COLUMN license_state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE release_checks ADD COLUMN license_spdx TEXT;
ALTER TABLE release_checks ADD COLUMN declarations TEXT;

-- 既存の行は宣言ファイルの段を通らないため、pending のままだと判定されずに掲載を止め続ける。
-- 2026-11-19 に、本番の全行 (41 件、legacy を含む) について gh api repos/<owner>/<repo>/license?ref=<commit_sha> を取得した値を書く。
-- 全件が GPL-2.0 で、OSI の承認を持つ。この時点より後に作られた行は pending のまま、新しい版の検査で判定する。
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 442633350; -- ai-assistant-for-obs v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 442684675; -- ai-assistant-for-obs v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443730369; -- ai-assistant-for-obs v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443747332; -- ai-assistant-for-obs v1.0.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445074874; -- ai-assistant-for-obs v1.0.4
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 440410296; -- comment-skin v0.1.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 440448668; -- comment-skin v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443737955; -- comment-skin v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445046581; -- comment-skin v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 447058460; -- image-degradation v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 439082556; -- loudness-balance-monitor v1.0.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443730372; -- loudness-balance-monitor v1.0.4
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445061925; -- loudness-balance-monitor v1.0.5
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 440529067; -- realtime-translate-summary v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443736701; -- realtime-translate-summary v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443751358; -- realtime-translate-summary v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445067901; -- realtime-translate-summary v1.0.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 441536393; -- shindan-chan v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443732614; -- shindan-chan v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445078772; -- shindan-chan v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 439945561; -- simple-burst-lines v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443732295; -- simple-burst-lines v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445049829; -- simple-burst-lines v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 446442600; -- simple-burst-lines v1.0.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 439089957; -- simple-drop-shadow v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443731897; -- simple-drop-shadow v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445054287; -- simple-drop-shadow v1.0.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 446442738; -- simple-drop-shadow v1.0.4
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 441546473; -- simple-mosaic v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443710370; -- simple-mosaic v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443978129; -- simple-mosaic v1.0.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 446442758; -- simple-mosaic v1.0.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445745624; -- simple-mosaic-transition v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 446443059; -- simple-mosaic-transition v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 439091464; -- simple-pitchshift v1.1.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443734236; -- simple-pitchshift v1.1.2
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445057808; -- simple-pitchshift v1.1.3
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 445965796; -- simple-white-noise v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 441312290; -- speaker-spotlight v1.0.0
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 443732098; -- speaker-spotlight v1.0.1
UPDATE release_checks SET license_state = 'passed', license_spdx = 'GPL-2.0' WHERE github_release_id = 444935755; -- speaker-spotlight v1.0.2
