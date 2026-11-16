// README 以外の文書の照合で、照合するファイルの選び方と、照合の本体。
// GitHub Actions の本審査 (.github/scripts/scan-docs.mjs) と、Worker の確認のモード (src/review/check-docs.ts) の両方が読む。
// 選び方を 2 か所に書くと、確認のモードと本審査で照合の範囲がずれるため、1 か所に置く。型は doc-scan.d.mts に置く。
import { guidanceHits } from './guidance-patterns.mjs';

export const MAX_DOC_HITS = 50;
export const MAX_DOC_FILE_BYTES = 1024 * 1024;
// 文書の拡張子。ワークフロー・スクリプト・ロケールは外れる (スクリプトの xattr などを誤って拾わないため)。
const DOC_EXTENSION = /\.(md|markdown|mdx|txt|rst|adoc|asciidoc|org)$/i;
// 拡張子の無い文書は、直下と docs/ の、名前が大文字で始まるものだけ (INSTALL・USAGE など)。
const BARE_DOC = /^[A-Z][A-Za-z0-9_-]*$/;

// リポジトリの直下からの '/' 区切りのパスが、照合する文書に当たる。
export function isDoc(path) {
  const name = path.split('/').at(-1) ?? '';
  if (DOC_EXTENSION.test(name)) return true;
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return !name.includes('.') && BARE_DOC.test(name) && (parent === '' || parent.toLowerCase() === 'docs');
}

// 文書のファイルの列を照合する。files は isDoc に当たるファイルの {path, bytes}。上限を超えるファイルと、
// NUL を含むファイル (バイナリとみなす) は読まない。並び順をそろえ、当たりの上限で切り捨てる当たりを両方で同じにする。
export function scanDocFiles(files) {
  const hits = [];
  let truncated = false;
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  // BOM を残す。Node の Buffer の toString と同じ文字列にするため。
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  outer: for (const file of sorted) {
    if (file.bytes.length > MAX_DOC_FILE_BYTES) continue;
    if (file.bytes.includes(0)) continue;
    const text = decoder.decode(file.bytes);
    const lines = text.split('\n');
    for (const hit of guidanceHits(text)) {
      if (hits.length >= MAX_DOC_HITS) {
        truncated = true;
        break outer;
      }
      hits.push({
        file: file.path,
        line: hit.line,
        rule: hit.rule,
        text: (lines[hit.line - 1] ?? '').replace(/[\r\t]/g, ' ').slice(0, 160),
      });
    }
  }
  return { hits, truncated };
}
