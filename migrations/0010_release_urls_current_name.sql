-- 名前の変更と移管のあとも旧い名前のまま残っていた、古い版のリリースとダウンロードの URL を、現在の owner/repo に書き換える (ADR 0015)。
-- `https://github.com/<X>/<Y>/<残り>` の <X>/<Y> を置き換える。式は src/domain/release-urls.ts と同じ。

UPDATE releases
SET html_url = 'https://github.com/'
  || (SELECT p.owner || '/' || p.repo FROM plugins p WHERE p.id = releases.plugin_id)
  || substr(substr(substr(html_url, 20), instr(substr(html_url, 20), '/') + 1),
            instr(substr(substr(html_url, 20), instr(substr(html_url, 20), '/') + 1), '/'))
WHERE html_url LIKE 'https://github.com/%/%/%';

UPDATE assets
SET download_url = 'https://github.com/'
  || (SELECT p.owner || '/' || p.repo FROM releases r JOIN plugins p ON p.id = r.plugin_id
      WHERE r.github_release_id = assets.release_id)
  || substr(substr(substr(download_url, 20), instr(substr(download_url, 20), '/') + 1),
            instr(substr(substr(download_url, 20), instr(substr(download_url, 20), '/') + 1), '/'))
WHERE download_url LIKE 'https://github.com/%/%/%';
