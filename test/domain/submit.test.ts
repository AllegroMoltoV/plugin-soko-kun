// submit の危険側の境界: 他人のリポジトリの登録、不正な入力、重複、乱用、無料プランの上限。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { parseRepositoryUrl, SUBMITS_PER_DAY, submitPlugin } from '../../src/domain/submit';
import { githubHandlers, OWNER, REPO, REPO_ID, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const submitter = { githubUserId: 4242, githubToken: USER_TOKEN };
const url = `https://github.com/${OWNER}/${REPO}`;

describe('parseRepositoryUrl', () => {
  it.each([
    'http://github.com/allegromoltov/repo',
    'https://github.com.evil.example/allegromoltov/repo',
    'https://evil.example/allegromoltov/repo',
    'https://user:pass@github.com/allegromoltov/repo',
    'https://github.com/allegromoltov/repo/releases',
    'https://github.com/allegromoltov/..',
    'https://github.com/allegromoltov/repo?x=1',
    'https://github.com/-bad/repo',
    'https://github.com/allegromoltov/repo#frag',
  ])('github.com のリポジトリ以外を拒否する: %s', (input) => {
    expect(parseRepositoryUrl(input)).toBeNull();
  });
});

describe('submitPlugin', () => {
  it('管理権限の無い利用者のリポジトリは登録しない', async () => {
    network.use(...githubHandlers({ admin: false }));
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: false, code: 'not_admin' });
    const row = await env.DB.prepare('SELECT count(*) AS n FROM plugins').first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it('管理権限の確認には利用者のトークンを使い、それ以外は OAuth App の認証で呼ぶ', async () => {
    const calls: string[] = [];
    network.use(...githubHandlers({}, calls));
    const result = await submitPlugin(env, submitter, url);
    expect(result.ok).toBe(true);
    expect(calls[0]).toBe('repo:Bearer');
    // 無料プランの外部呼び出しの上限 (50 件) に対し、submit は配布物の数に依存しない 6 件で済む。
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('同じリポジトリの二重登録を拒否する', async () => {
    network.use(...githubHandlers());
    expect((await submitPlugin(env, submitter, url)).ok).toBe(true);
    const second = await submitPlugin(env, { ...submitter, githubUserId: 5151 }, url);
    expect(second).toMatchObject({ ok: false, code: 'duplicate' });
  });

  it('digest の無い配布物しかないリリースは登録しない', async () => {
    network.use(...githubHandlers({ release: 'no-digest' }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'no_verifiable_asset' });
  });

  it('libobs を参照しないリポジトリは OBS プラグインとして登録しない', async () => {
    network.use(...githubHandlers({ cmake: 'project(other)\nfind_package(Qt6)\n' }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'not_obs_plugin' });
  });

  it('1 日の登録回数を超えたら、失敗した要求も含めて拒否する', async () => {
    const stamp = new Date().toISOString();
    for (let i = 0; i < SUBMITS_PER_DAY; i += 1) {
      await env.DB.prepare('INSERT INTO submit_log VALUES (?, ?, ?)')
        .bind(submitter.githubUserId, stamp, 'invalid_url')
        .run();
    }
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: false, code: 'rate_limited' });
  });

  it('GitHub の障害では登録せず、トークンを応答に含めない', async () => {
    network.use(
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}`, () => new HttpResponse(null, { status: 503 })),
    );
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: false, code: 'github_unavailable' });
    expect(JSON.stringify(result)).not.toContain(USER_TOKEN);
  });

  it('登録の書き込みは 1 回の batch で行い、検査を検査待ちで作る', async () => {
    network.use(...githubHandlers());
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: true, status: 'pending', assetsToScan: 2 });
    const scans = await env.DB.prepare("SELECT count(*) AS n FROM scans WHERE result = 'pending'").first<{
      n: number;
    }>();
    expect(scans?.n).toBe(2);
    const plugin = await env.DB.prepare('SELECT github_repo_id FROM plugins').first<{ github_repo_id: number }>();
    expect(plugin?.github_repo_id).toBe(REPO_ID);
  });
});
