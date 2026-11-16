// 取得したソースのディレクトリから、文書の中のセキュリティの機能を切らせる案内と、取得した内容をその場で実行させるコマンドを探し、
// {hits, truncated} の JSON を標準出力に書く。選び方と照合は Worker の確認のモードと共有する src/review/doc-scan.mjs を使う。
// ソースは実行もビルドもせず、文字列で照合するだけにする (docs/design/scanning.md の「README 以外の文書の照合」)。
// 使い方: node scan-docs.mjs <ソースのディレクトリ>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isDoc, MAX_DOC_FILE_BYTES, scanDocFiles } from '../../src/review/doc-scan.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scan-docs.mjs <dir>');
  process.exit(2);
}

function* walk(current) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const files = [];
for (const full of walk(dir)) {
  const path = relative(dir, full).split(sep).join('/');
  if (!isDoc(path)) continue;
  // 上限を超えるファイルは読まない。照合でも読み飛ばす。
  if (statSync(full).size > MAX_DOC_FILE_BYTES) continue;
  files.push({ path, bytes: readFileSync(full) });
}

process.stdout.write(`${JSON.stringify(scanDocFiles(files))}\n`);
