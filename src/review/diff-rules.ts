// 乗っ取りの兆候のルールの検査 (docs/design/review-criteria.md の「乗っ取りの兆候」)。
// 掲載中の版から新しい版までの差分 (unified diff) の先頭だけを読み、当たった項目とファイルを返す。
// tag-not-on-default-branch は差分ではなくタグのコミットの位置で判定し (src/domain/release-checks.ts)、同じ一覧に保存する。
export interface DiffHit {
  rule:
    | 'diff-workflow-changed'
    | 'diff-binary-added'
    | 'diff-external-link'
    | 'diff-too-large'
    | 'tag-not-on-default-branch';
  file?: string;
}

const DIFF_HEADER = 'diff --git ';
const FILE_HEADER = /^diff --git a\/(\S+) b\/(\S+)$/;
const URL_PATTERN = /https?:\/\/[^\s"'<>()`\]]+/gi;
// ワークフローと、ワークフローが呼ぶ composite action とスクリプトの置き場所。見出しの行の a/ か b/ の側に現れれば当たる。
// git はパスに空白を含むと引用符を付けずに、非 ASCII を含むと引用符で囲んで見出しを出すが、この置き場所は ASCII のため
// どの形でもそのまま残る。直前を行頭・空白・引用符に限り、data/.github/workflows/ のような入れ子のパスには当てない。
const WORKFLOW_IN_HEADER = /(?:^diff --git |[\s"])[ab]\/\.github\/(?:workflows|actions|scripts)\//;
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
  // バイナリは追加と変更だけを数え、削除は数えない (審査の基準の「追加または変更」)。削除は deleted file mode の行だけで
  // 判定する。Binary files の行の末尾で判定すると、名前が " and /dev/null" で終わるファイルの追加を削除と取り違えるため。
  let deleted = false;
  // 変更の塊 (@@ の行から次のファイルの見出しまで) の中か。中では + で始まる行をすべて追加の行とする。
  // 本文が ++ で始まる行を足すと差分では +++ になるため、+++ の行を見出しとして読み飛ばすのは塊の外に限る。
  let inHunk = false;
  for (const line of diff.split('\n')) {
    // 見出しは、パスを取り出せない形 (空白や非 ASCII を含むパス) でも必ずファイルの区切りとして扱う。
    // 区切りを読み飛ばすと、前のファイルの状態を持ち越して、ワークフローの変更とバイナリの追加を逃すため。
    if (line.startsWith(DIFF_HEADER)) {
      file = FILE_HEADER.exec(line)?.[2] ?? line.slice(DIFF_HEADER.length);
      deleted = false;
      inHunk = false;
      if (WORKFLOW_IN_HEADER.test(line)) add({ rule: 'diff-workflow-changed', file });
      continue;
    }
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk && line.startsWith('deleted file mode')) {
      deleted = true;
      continue;
    }
    if (!inHunk && (line.startsWith('Binary files ') || line === 'GIT binary patch')) {
      if (!deleted) add({ rule: 'diff-binary-added', file });
      continue;
    }
    if (line.startsWith('+') && (inHunk || !line.startsWith('+++'))) {
      for (const match of line.matchAll(URL_PATTERN)) {
        if (!isAllowed(match[0], owner, repo)) add({ rule: 'diff-external-link', file });
      }
    }
  }
  if (truncated) add({ rule: 'diff-too-large' });
  return hits;
}
