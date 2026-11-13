// 審査の基準の正本 (docs) と、作者に返す固定の文言 (コード) の ID がずれていないことを確かめる。
// ずれると、作者に返す references が正本の見出しを指さなくなり、判定しない項目や説明の無い項目が生まれる。
import { describe, expect, it } from 'vitest';
import doc from '../docs/design/review-criteria.md?raw';
import { CRITERIA } from '../src/review/criteria';

function idsInSection(heading: string): string[] {
  const start = doc.indexOf(`## ${heading}\n`);
  if (start < 0) throw new Error(`section not found: ${heading}`);
  const next = doc.indexOf('\n## ', start + 1);
  const section = doc.slice(start, next < 0 ? undefined : next);
  return [...section.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((match) => match[1] ?? '');
}

describe('審査の基準', () => {
  it('正本の区分ごとの ID と、コードの項目の ID が一致する', () => {
    const sections = {
      condition: '掲載の条件',
      takeover: '乗っ取りの兆候',
      criterion: '審査の基準',
      recommendation: '推奨',
    } as const;
    for (const [kind, heading] of Object.entries(sections)) {
      const inCode = CRITERIA.filter((criterion) => criterion.kind === kind)
        .map((criterion) => criterion.id)
        .sort();
      expect(inCode, heading).toEqual(idsInSection(heading).sort());
    }
  });

  it('重大とする場合を持つのは、正本で重大とする場合を書いた審査の基準だけ', () => {
    const start = doc.indexOf('## 審査の基準\n');
    const section = doc.slice(start, doc.indexOf('\n## ', start + 1));
    const seriousInDoc = [...section.matchAll(/^\| `([a-z0-9-]+)` \|.*\| ([^|]+) \| [^|]+ \|$/gm)]
      .filter((match) => (match[2] ?? '').trim() !== 'なし')
      .map((match) => match[1])
      .sort();
    const seriousInCode = CRITERIA.filter((criterion) => criterion.serious)
      .map((criterion) => criterion.id)
      .sort();
    expect(seriousInCode).toEqual(seriousInDoc);
  });
});
