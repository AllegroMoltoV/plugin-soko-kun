// 名前の変更と移管のあとに、保存済みの古い版のリリースとダウンロードの URL を、現在の owner/repo に書き換える (ADR 0015)。
// 同期は最新のリリースしか取り直さないため、掲載中の古い版の URL が旧い名前のまま残るのを防ぐ。
// 旧い名前に頼らず、`https://github.com/<X>/<Y>/<残り>` の <X>/<Y> を置き換える。
// 移管の記録 (plugin_aliases.name) が実際の旧い名前と一致しない行でも書き換えられるようにするため。
// 同じ式を migrations/0010_release_urls_current_name.sql でも使う。

// `https://github.com/` の長さは 19 文字。20 文字目からが <X>/<Y>/<残り>。
function tail(column: string): string {
  const afterHost = `substr(${column}, 20)`;
  const afterOwner = `substr(${afterHost}, instr(${afterHost}, '/') + 1)`;
  return `substr(${afterOwner}, instr(${afterOwner}, '/'))`;
}

const GITHUB_URL = "'https://github.com/%/%/%'";

export const REWRITE_RELEASE_URLS = `UPDATE releases SET html_url = 'https://github.com/' || ? || '/' || ? || ${tail('html_url')}
  WHERE plugin_id = ? AND html_url LIKE ${GITHUB_URL}`;

export const REWRITE_ASSET_URLS = `UPDATE assets SET download_url = 'https://github.com/' || ? || '/' || ? || ${tail('download_url')}
  WHERE release_id IN (SELECT github_release_id FROM releases WHERE plugin_id = ?) AND download_url LIKE ${GITHUB_URL}`;
