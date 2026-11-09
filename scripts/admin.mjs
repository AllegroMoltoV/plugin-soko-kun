// 管理者による掲載停止と再開。管理画面は作らず、wrangler d1 execute で D1 を直接更新する。
// 使い方:
//   npm run admin -- suspend <owner/repo> "<理由>" [--remote]
//   npm run admin -- resume <owner/repo> [--remote]
//   npm run admin -- show <owner/repo> [--remote]
//   npm run admin -- approve-suspicious <owner/repo> [--remote]
//   npm run admin -- set-category <owner/repo> <category> [--remote]
//   npm run admin -- hide-images <owner/repo> [--remote]
//   npm run admin -- show-images <owner/repo> [--remote]
// --remote を付けないときはローカルの D1 を更新する。
import { spawnSync } from 'node:child_process';

const ID = /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/;
const REASON = /^[^\p{Cc}]{1,200}$/u;
const CATEGORIES = ['audio-filter', 'video-filter', 'source', 'transition', 'dock-ui', 'output', 'other'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [command, rawId, reason] = args.filter((a) => a !== '--remote');
if (!command || !rawId)
  fail(
    'usage: admin <suspend|resume|show|approve-suspicious|set-category|hide-images|show-images> <owner/repo> [reason|category] [--remote]',
  );

const id = rawId.toLowerCase();
if (!ID.test(id)) fail(`invalid plugin id: ${rawId}`);
// id と理由は検証済みの値だけを SQL に入れ、単引用符は二重にして文字列から抜け出せないようにする。
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const now = new Date().toISOString();

let sql;
if (command === 'suspend') {
  if (!reason || !REASON.test(reason)) fail('a reason (1-200 characters, no control characters) is required');
  sql = `UPDATE plugins SET admin_suspended = 1, suspended_reason = ${quote(reason)}, updated_at = ${quote(now)} WHERE id = ${quote(id)}; SELECT id, admin_suspended, suspended_reason FROM plugins WHERE id = ${quote(id)};`;
} else if (command === 'resume') {
  // 再開は管理者の停止を解くだけで、掲載の可否は検査結果から改めて算出される。
  sql = `UPDATE plugins SET admin_suspended = 0, suspended_reason = NULL, updated_at = ${quote(now)} WHERE id = ${quote(id)}; SELECT id, admin_suspended FROM plugins WHERE id = ${quote(id)};`;
} else if (command === 'approve-suspicious') {
  // VirusTotal で少数のエンジンだけが検出した配布物を、管理者が確認したうえで問題なしとする。
  const digests = `SELECT a.digest FROM assets a JOIN releases r ON r.github_release_id = a.release_id WHERE r.plugin_id = ${quote(id)}`;
  sql = `UPDATE scans SET result = 'clean', detail = 'reviewed by admin ' || ${quote(now)} || ': ' || ifnull(detail, '') WHERE result = 'suspicious' AND digest IN (${digests}); SELECT digest, scanner, result, detail FROM scans WHERE digest IN (${digests});`;
} else if (command === 'set-category') {
  // 自動の推定が誤っていたカテゴリを、管理者が直す。
  if (!CATEGORIES.includes(reason)) fail(`category must be one of: ${CATEGORIES.join(', ')}`);
  sql = `UPDATE plugins SET category = ${quote(reason)}, updated_at = ${quote(now)} WHERE id = ${quote(id)}; SELECT id, category FROM plugins WHERE id = ${quote(id)};`;
} else if (command === 'hide-images' || command === 'show-images') {
  // 不適切な画像の通報を受けたとき、掲載を続けたまま画像だけを止める。
  const hidden = command === 'hide-images' ? 1 : 0;
  sql = `UPDATE plugins SET images_hidden = ${hidden}, updated_at = ${quote(now)} WHERE id = ${quote(id)}; SELECT id, images_hidden FROM plugins WHERE id = ${quote(id)};`;
} else if (command === 'show') {
  sql = `SELECT id, admin_suspended, suspended_reason, removed, images_hidden, last_synced_at FROM plugins WHERE id = ${quote(id)};`;
} else {
  fail(`unknown command: ${command}`);
}

// シェルを介さずに wrangler を起動する。SQL の引用符がシェルに解釈されないようにするため。
const wrangler = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url);
const result = spawnSync(
  process.execPath,
  [
    wrangler.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    'd1',
    'execute',
    'DB',
    remote ? '--remote' : '--local',
    '--command',
    sql,
    ...(remote ? ['--env', 'production'] : []),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
