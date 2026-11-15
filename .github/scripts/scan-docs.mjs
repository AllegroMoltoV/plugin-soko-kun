// 取得したソースのディレクトリから、文書の中のセキュリティの機能を切らせる案内と、取得した内容をその場で実行させるコマンドを探し、
// {hits, truncated} の JSON を標準出力に書く。型は Worker と共有する src/review/guidance-patterns.mjs を使う。
// ソースは実行もビルドもせず、文字列で照合するだけにする (docs/design/scanning.md の「README 以外の文書の照合」)。
// 使い方: node scan-docs.mjs <ソースのディレクトリ>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { guidanceHits } from '../../src/review/guidance-patterns.mjs';

const MAX_HITS = 50;
const MAX_FILE_BYTES = 1024 * 1024;
// 文書の拡張子。ワークフロー・スクリプト・ロケールは外れる (スクリプトの xattr などを誤って拾わないため)。
const DOC_EXTENSION = /\.(md|markdown|mdx|txt|rst|adoc|asciidoc|org)$/i;
// 拡張子の無い文書は、直下と docs/ の、名前が大文字で始まるものだけ (INSTALL・USAGE など)。
const BARE_DOC = /^[A-Z][A-Za-z0-9_-]*$/;

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scan-docs.mjs <dir>');
  process.exit(2);
}

function isDoc(path) {
  const name = path.split('/').at(-1) ?? '';
  if (DOC_EXTENSION.test(name)) return true;
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return !name.includes('.') && BARE_DOC.test(name) && (parent === '' || parent.toLowerCase() === 'docs');
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

const hits = [];
let truncated = false;
const files = [...walk(dir)].map((full) => ({ full, path: relative(dir, full).split(sep).join('/') })).filter((file) => isDoc(file.path));
files.sort((a, b) => a.path.localeCompare(b.path));
outer: for (const file of files) {
  if (statSync(file.full).size > MAX_FILE_BYTES) continue;
  const bytes = readFileSync(file.full);
  // NUL を含むファイルはバイナリとみなして読まない。
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  const lines = text.split('\n');
  for (const hit of guidanceHits(text)) {
    if (hits.length >= MAX_HITS) {
      truncated = true;
      break outer;
    }
    hits.push({ file: file.path, line: hit.line, rule: hit.rule, text: (lines[hit.line - 1] ?? '').replace(/[\r\t]/g, ' ').slice(0, 160) });
  }
}

process.stdout.write(`${JSON.stringify({ hits, truncated })}\n`);
