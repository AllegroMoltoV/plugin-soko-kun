// 管理者による掲載停止と再開。管理画面は作らず、wrangler d1 execute で D1 を直接更新する。
// 使い方:
//   npm run admin -- suspend <owner/repo> "<理由>" [--remote]
//   npm run admin -- resume <owner/repo> [--remote]
//   npm run admin -- show <owner/repo> [--remote]
// --remote を付けないときはローカルの D1 を更新する。
import { spawnSync } from 'node:child_process';

const ID = /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/;
const REASON = /^[^\u0000-\u001f]{1,200}$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [command, rawId, reason] = args.filter((a) => a !== '--remote');
if (!command || !rawId) fail('usage: admin <suspend|resume|show> <owner/repo> [reason] [--remote]');

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
} else if (command === 'show') {
  sql = `SELECT id, admin_suspended, suspended_reason, removed, last_synced_at FROM plugins WHERE id = ${quote(id)};`;
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
