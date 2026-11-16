// 確認のモードの README 以外の文書の照合の境界。危険側は、確認のモードが本審査より狭く照合して「問題なし」を返し、
// 作者が不変のリリースの後でしか重大の指摘に気付けないこと (2026-11-16)。
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { GitHubClient } from '../../src/github';
import { scanDocsForCheck } from '../../src/review/check-docs';
import { judgeByRules, type RepositorySnapshot } from '../../src/review/rules';
import { network } from '../setup';

const OWNER = 'allegromoltov';
const REPO = 'obs-fixture-docs';
const TOP = `${OWNER}-${REPO}-abc1234`;
const encoder = new TextEncoder();

function field(block: Uint8Array, text: string, offset: number, length: number) {
  block.set(encoder.encode(text).subarray(0, length), offset);
}

// ustar のヘッダー 1 つと中身。長いパスは prefix 欄に分ける (git archive と同じ形)。
function entry(path: string, content: string, type = '0'): Uint8Array[] {
  const data = encoder.encode(content);
  const header = new Uint8Array(512);
  const full = `${TOP}/${path}`;
  const cut = full.length > 100 ? full.lastIndexOf('/', full.length - 1) : -1;
  field(header, cut < 0 ? full : full.slice(cut + 1), 0, 100);
  if (cut >= 0) field(header, full.slice(0, cut), 345, 155);
  field(header, `${data.length.toString(8).padStart(11, '0')}\0`, 124, 12);
  field(header, type, 156, 1);
  field(header, 'ustar\0', 257, 6);
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
  padded.set(data);
  return [header, padded];
}

async function tarGz(entries: Uint8Array[][]): Promise<ArrayBuffer> {
  const parts = [...entries.flat(), new Uint8Array(1024)];
  const stream = new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

function serveTarball(body: ArrayBuffer | null) {
  network.use(
    http.get(`https://api.github.com/repos/${OWNER}/${REPO}/tarball/main`, () =>
      HttpResponse.text('', {
        status: 302,
        headers: { Location: `https://codeload.github.com/${OWNER}/${REPO}/legacy.tar.gz/refs/heads/main` },
      }),
    ),
    http.get(`https://codeload.github.com/${OWNER}/${REPO}/legacy.tar.gz/refs/heads/main`, () =>
      body ? new HttpResponse(body) : new HttpResponse(null, { status: 500 }),
    ),
  );
}

const github = () => new GitHubClient(new Budget(), { kind: 'app', clientId: 'id', clientSecret: 'secret' });
const base: RepositorySnapshot = {
  paths: ['README.md'],
  truncated: false,
  files: [{ path: 'README.md', content: '# Plugin\n' }],
  unreadFiles: [],
  readmePath: 'README.md',
};
const judge = (docScan: RepositorySnapshot['docScan'], id: string) =>
  judgeByRules({ ...base, docScan }).find((item) => item.id === id);

describe('scanDocsForCheck', () => {
  it('prefix 欄に分かれた長いパスの文書の案内を、正しいパスで重大にする', async () => {
    const long = `docs/${'a'.repeat(60)}/${'b'.repeat(40)}/survey.md`;
    serveTarball(await tarGz([entry('README.md', '# Plugin\n'), entry(long, 'x\nTurn off SmartScreen first.\n')]));
    const scan = await scanDocsForCheck(github(), OWNER, REPO, 'main', ['README.md', long], false);
    expect(scan).toMatchObject({ hits: [{ file: long, line: 2, rule: 'no-security-bypass' }] });
    expect(judge(scan, 'no-security-bypass')).toMatchObject({
      result: 'not_met',
      serious: true,
      evidence: [{ file: long, lines: '2-2' }],
    });
  });

  it('ファイルの一覧にある文書が tarball に無い (export-ignore) ときは、重大にする', async () => {
    serveTarball(await tarGz([entry('README.md', '# Plugin\n')]));
    const scan = await scanDocsForCheck(github(), OWNER, REPO, 'main', ['README.md', 'docs/hidden.md'], false);
    expect(scan).toHaveProperty('missing');
    expect(judge(scan, 'no-terminal-paste')).toMatchObject({ result: 'not_met', serious: true });
  });

  it('tarball を取得できないときは、met にせず重大にする', async () => {
    serveTarball(null);
    const scan = await scanDocsForCheck(github(), OWNER, REPO, 'main', ['README.md'], false);
    expect(scan).toHaveProperty('missing');
    expect(judge(scan, 'no-security-bypass')).toMatchObject({ result: 'not_met', serious: true });
  });
});
