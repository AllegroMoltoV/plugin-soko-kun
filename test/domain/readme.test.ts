// レビューの README の取得の境界。危険側は、README の名前を変えるか大きくすることで、README の照合を逃れられること。
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { collectReviewFiles } from '../../src/domain/release-checks';
import { GitHubClient } from '../../src/github';
import { judgeByRules } from '../../src/review/rules';
import { releaseCheckHandlers } from '../fixtures/github';
import { network } from '../setup';

const github = () => new GitHubClient(new Budget(), { kind: 'user', token: 'token' });
const bypass = (snapshot: Parameters<typeof judgeByRules>[0]) =>
  judgeByRules(snapshot).find((entry) => entry.id === 'no-security-bypass');

describe('collectReviewFiles の README', () => {
  it('GitHub が表示する README を、名前と場所によらず取得して照合する', async () => {
    const text = '# Install\n\nxattr -cr OBS.app\n';
    network.use(
      ...releaseCheckHandlers(),
      http.get('https://api.github.com/repos/:owner/:repo/readme', ({ request }) => {
        expect(new URL(request.url).searchParams.get('ref')).toBe('v1.0.0');
        return HttpResponse.json({
          path: '.GitHub/README.md',
          size: text.length,
          encoding: 'base64',
          content: btoa(text),
        });
      }),
    );
    const collected = await collectReviewFiles(github(), 'owner', 'plugin', 'v1.0.0');
    expect(collected.readmePath).toBe('.GitHub/README.md');
    expect(bypass(collected)).toMatchObject({
      result: 'not_met',
      serious: true,
      evidence: [{ file: '.GitHub/README.md', lines: '3-3' }],
    });
  });

  it('128 KB を超える README は読まずに、重大の not_met にする', async () => {
    network.use(
      ...releaseCheckHandlers(),
      http.get('https://api.github.com/repos/:owner/:repo/readme', () =>
        HttpResponse.json({ path: 'README.md', size: 200 * 1024, encoding: 'base64', content: '' }),
      ),
    );
    const collected = await collectReviewFiles(github(), 'owner', 'plugin', 'v1.0.0');
    expect(collected.readmeUnread).toBe(true);
    expect(bypass(collected)).toMatchObject({ result: 'not_met', serious: true });
  });

  it('README が無ければ、セキュリティの機能の案内は無いものとする', async () => {
    network.use(
      ...releaseCheckHandlers(),
      http.get('https://api.github.com/repos/:owner/:repo/readme', () => new HttpResponse(null, { status: 404 })),
    );
    const collected = await collectReviewFiles(github(), 'owner', 'plugin', 'v1.0.0');
    expect(collected.readmePath).toBeNull();
    expect(bypass(collected)).toMatchObject({ result: 'met' });
  });
});
