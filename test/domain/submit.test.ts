// submit の危険側の境界: 他人のリポジトリの登録、不正な入力、重複、乱用、無料プランの上限。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { checkPlugin, parseRepositoryUrl, SUBMITS_PER_DAY, submitPlugin } from '../../src/domain/submit';
import { githubHandlers, OWNER, REPO, REPO_ID, releaseCheckHandlers, USER_TOKEN } from '../fixtures/github';
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
    // 無料プランの外部呼び出しの上限 (50 件) に対し、submit は 6 件に配布物ごとの証明の確認を足した件数で済む。
    expect(calls.length).toBeLessThanOrEqual(6 + 2);
  });

  it('不変でないリリース、exe の配布物、証明の無い配布物は登録しない', async () => {
    network.use(...githubHandlers({ immutable: false }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'not_immutable' });
    network.resetHandlers();
    network.use(...githubHandlers({ installer: true }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'installer_not_allowed' });
    network.resetHandlers();
    network.use(...githubHandlers({ attestation: false }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'no_attestation' });
  });

  it('同じリポジトリの二重登録を拒否する', async () => {
    network.use(...githubHandlers());
    expect((await submitPlugin(env, submitter, url)).ok).toBe(true);
    const second = await submitPlugin(env, { ...submitter, githubUserId: 5151 }, url);
    expect(second).toMatchObject({ ok: false, code: 'duplicate' });
  });

  // 名前を変えたプラグインの旧い名前を、別のリポジトリに使わせない (ADR 0015)。
  it('名前を変えたほかのプラグインの旧い名前と同じ名前のリポジトリは登録しない', async () => {
    await env.DB.prepare(
      `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
       VALUES ('someone/renamed', 999, 'someone', 'renamed', 'MIT', 1, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`,
    ).run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at, name) VALUES (?, 'someone/renamed', '2026-11-02T00:00:00Z', ?)",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase(), `${OWNER}/${REPO}`)
      .run();
    network.use(...githubHandlers());
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'name_reserved' });
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM plugins').first<{ n: number }>();
    expect(count?.n).toBe(1);
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

describe('checkPlugin (確認のモード)', () => {
  it('登録せずに条件ごとの結果を返し、1 人 24 時間 5 回を超えたら断る', async () => {
    network.use(...githubHandlers({ immutable: false }), ...releaseCheckHandlers());
    const first = await checkPlugin(env, submitter, url);
    expect(first).toMatchObject({ mode: 'check', ok: false });
    expect((first as { conditions: Array<{ code: string; result: string }> }).conditions).toContainEqual(
      expect.objectContaining({ code: 'not_immutable', result: 'failed' }),
    );
    expect(await env.DB.prepare('SELECT count(*) AS n FROM plugins').first('n')).toBe(0);
    for (let i = 0; i < 4; i += 1) await checkPlugin(env, submitter, url);
    const limited = (await checkPlugin(env, submitter, url)) as { ok: boolean; code: string; resumesAt?: string };
    expect(limited).toMatchObject({ ok: false, code: 'rate_limited' });
    // 作者の AI が次に使える時刻を読めるよう、枠の中で新しい順に 5 番目の利用の 24 時間後を返す。
    const fifth = await env.DB.prepare(
      'SELECT created_at FROM check_log WHERE github_user_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET 4',
    )
      .bind(submitter.githubUserId)
      .first<string>('created_at');
    expect(limited.resumesAt).toBe(new Date(Date.parse(fifth as string) + 24 * 60 * 60 * 1000).toISOString());
  });

  // 不変のリリースは公開の後に直せないため、リリースの前の確認で、残りの条件と直し方が分からないと作者が困る。
  it('リリースの前は、リリースを要る条件を未判定として直し方とともに返す', async () => {
    network.use(...githubHandlers({ release: 'none' }), ...releaseCheckHandlers());
    const result = (await checkPlugin(env, submitter, url)) as {
      conditions: Array<{ code: string; result: string; fix?: string }>;
      config: { result: string };
    };
    expect(result.conditions.find((item) => item.code === 'no_release')?.result).toBe('failed');
    const unchecked = result.conditions.filter((item) => item.result === 'unchecked');
    expect(unchecked.map((item) => item.code)).toEqual([
      'not_immutable',
      'no_verifiable_asset',
      'unsupported_tag',
      'installer_not_allowed',
      'no_attestation',
    ]);
    expect(unchecked.every((item) => (item.fix ?? '').length > 0)).toBe(true);
    expect(unchecked[0]?.fix).toContain('immutable-releases');
    expect(result.config.result).toBe('missing');
  });

  it('既定のブランチの宣言ファイルの形の誤りを、リリースの前に返す', async () => {
    network.use(...githubHandlers({ release: 'none' }), ...releaseCheckHandlers());
    network.use(
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/.soko-kun/config.json`, () =>
        HttpResponse.text('{"os": "windows"}'),
      ),
    );
    const result = (await checkPlugin(env, submitter, url)) as { config: { result: string; fix?: string } };
    expect(result.config).toMatchObject({ result: 'invalid' });
    expect(result.config.fix).toContain('"os"');
  });

  // 既定のブランチの名前は / などを含みうる。名前を API のパスに使うと、確認のモードが結果を返さず内部エラーになる。
  it('既定のブランチの名前に / を含むリポジトリでも、HEAD で読んで結果を返す', async () => {
    const refs: string[] = [];
    network.use(...githubHandlers({ release: 'none', defaultBranch: 'release/1.x' }), ...releaseCheckHandlers());
    network.use(
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/.soko-kun/config.json`, ({ request }) => {
        refs.push(`config:${new URL(request.url).searchParams.get('ref')}`);
        return new HttpResponse(null, { status: 404 });
      }),
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/:ref`, ({ params }) => {
        refs.push(`tree:${params.ref}`);
        return HttpResponse.json({ tree: [], truncated: false });
      }),
    );
    const result = (await checkPlugin(env, submitter, url)) as { mode?: string; config: { result: string } };
    expect(result).toMatchObject({ mode: 'check', config: { result: 'missing' } });
    expect(refs).toEqual(['config:HEAD', 'tree:HEAD']);
  });
});
