// 乗っ取りの兆候のルールの検査 (docs/design/review-criteria.md の「乗っ取りの兆候」)。
// 掲載中の版から新しい版までの差分 (unified diff) の先頭だけを読み、当たった項目とファイルを返す。
export interface DiffHit {
  rule: 'diff-workflow-changed' | 'diff-binary-added' | 'diff-external-link' | 'diff-too-large';
  file?: string;
}

const FILE_HEADER = /^diff --git a\/(\S+) b\/(\S+)$/;
const URL_PATTERN = /https?:\/\/[^\s"'<>()`\]]+/gi;
// ワークフローと、ワークフローが呼ぶ composite action とスクリプトの置き場所。
const WORKFLOW_PATHS = ['.github/workflows/', '.github/actions/', '.github/scripts/'];
const ALLOWED_HOSTS = new Set(['obsproject.com', 'soko-kun.allegromoltov.jp']);

// このリポジトリを指す URL の判定。github.com と raw.githubusercontent.com で、owner と repo が一致するものに限る。
function isSameRepository(url: URL, owner: string, repo: string): boolean {
  const [first, second] = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'raw.githubusercontent.com') return false;
  return (
    first?.toLowerCase() === owner.toLowerCase() && second?.toLowerCase().replace(/\.git$/, '') === repo.toLowerCase()
  );
}

function isAllowed(raw: string, owner: string, repo: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host) || host.endsWith('.obsproject.com')) return true;
  return isSameRepository(url, owner, repo);
}

export function checkDiff(diff: string, truncated: boolean, owner: string, repo: string): DiffHit[] {
  const hits: DiffHit[] = [];
  const seen = new Set<string>();
  const add = (hit: DiffHit) => {
    const key = `${hit.rule}:${hit.file ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };
  let file: string | undefined;
  for (const line of diff.split('\n')) {
    const header = FILE_HEADER.exec(line);
    if (header) {
      const [, before = '', after = ''] = header;
      file = after;
      if (WORKFLOW_PATHS.some((prefix) => after.startsWith(prefix) || before.startsWith(prefix))) {
        add({ rule: 'diff-workflow-changed', file });
      }
      continue;
    }
    if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
      add({ rule: 'diff-binary-added', file });
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      for (const match of line.matchAll(URL_PATTERN)) {
        if (!isAllowed(match[0], owner, repo)) add({ rule: 'diff-external-link', file });
      }
    }
  }
  if (truncated) add({ rule: 'diff-too-large' });
  return hits;
}
