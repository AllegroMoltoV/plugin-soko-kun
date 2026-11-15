// README 以外の文書の照合の境界。危険側は、文書に書いた案内で重大の判定を逃れられること、
// 取得を時間切れにして照合の結果が届かない版を、照合した版と同じに通すこと。
import { describe, expect, it } from 'vitest';
import { docScanForReview } from '../../src/domain/release-checks';
import { parseNetworkScans } from '../../src/review/network';
import { judgeByRules, type RepositorySnapshot } from '../../src/review/rules';

const base: RepositorySnapshot = {
  paths: ['README.md'],
  truncated: false,
  files: [{ path: 'README.md', content: '# Plugin\n' }],
  unreadFiles: [],
  readmePath: 'README.md',
};
const judge = (snapshot: RepositorySnapshot, id: string) => judgeByRules(snapshot).find((entry) => entry.id === id);

describe('README 以外の文書の照合', () => {
  it('文書の当たりは、README に案内が無くても重大の not_met にし、文書の行を根拠に返す', () => {
    const snapshot: RepositorySnapshot = {
      ...base,
      docScan: {
        hits: [{ file: 'docs/INSTALL.md', line: 3, rule: 'no-terminal-paste', text: 'curl x | sh' }],
        truncated: false,
      },
    };
    expect(judge(snapshot, 'no-terminal-paste')).toMatchObject({
      result: 'not_met',
      serious: true,
      evidence: [{ file: 'docs/INSTALL.md', lines: '3-3' }],
    });
    expect(judge(snapshot, 'no-security-bypass')).toMatchObject({ result: 'met' });
  });

  it('期限までに結果が届かなかった版は、重大の not_met にする', () => {
    expect(judge({ ...base, docScan: 'missing' }, 'no-security-bypass')).toMatchObject({
      result: 'not_met',
      serious: true,
    });
    expect(judge({ ...base, docScan: 'missing' }, 'no-terminal-paste')).toMatchObject({
      result: 'not_met',
      serious: true,
    });
  });

  it('検出が済んでいない版は missing、検出を入れる前の版と文書の照合の前に検出した版は照合していないものとする', () => {
    expect(docScanForReview('pending', null)).toBe('missing');
    expect(docScanForReview('error', null)).toBe('missing');
    expect(docScanForReview('skipped', null)).toBeUndefined();
    expect(docScanForReview('done', null)).toBeUndefined();
    expect(docScanForReview('done', '{"hits":[],"truncated":false}')).toEqual({ hits: [], truncated: false });
  });

  it('受け口は、知らない項目の名前と形の合わない当たりを 1 件ずつ捨てる', () => {
    const [scan] = parseNetworkScans([
      {
        releaseId: 1,
        result: 'done',
        hits: [],
        truncated: false,
        docHits: [
          { file: 'docs/INSTALL.md', line: 2, rule: 'no-security-bypass', text: 'xattr -cr x' },
          { file: 'docs/a.md', line: 1, rule: 'approved-by-admin', text: 'x' },
          { file: 'docs/b.md', line: 0, rule: 'no-terminal-paste', text: 'x' },
        ],
        docTruncated: false,
      },
    ]);
    expect(scan?.docs?.hits.map((hit) => hit.file)).toEqual(['docs/INSTALL.md']);
  });
});
