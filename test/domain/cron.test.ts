// 定期処理の危険側の境界: 停止の解除、検査結果の流用、障害時のデータ破壊、無料プランの上限超過。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { recordListings, runCron } from '../../src/domain/cron';
import { runReleaseChecks } from '../../src/domain/release-checks';
import { submitPlugin } from '../../src/domain/submit';
import { markListable } from '../fixtures/checks';
import {
  downloadHandlers,
  githubHandlers,
  imageHandlers,
  OWNER,
  REPO,
  REPO_ID,
  releaseCheckHandlers,
  USER_TOKEN,
} from '../fixtures/github';
import { png, svg } from '../fixtures/images';
import { network } from '../setup';

const submitter = { githubUserId: 4242, githubToken: USER_TOKEN };

async function registerFixture(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(env, submitter, `https://github.com/${OWNER}/${REPO}`);
  if (!result.ok) throw new Error(`fixture registration failed: ${result.code}`);
  network.resetHandlers();
  // 同期の対象にするため、最後の同期時刻を過去にずらす。
  await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
}

const repoById = (status = 200, extra: Record<string, unknown> = {}) =>
  http.get(`https://api.github.com/repositories/${REPO_ID}`, () =>
    status === 200
      ? HttpResponse.json({
          id: REPO_ID,
          name: REPO,
          owner: { login: OWNER },
          private: false,
          archived: false,
          license: { spdx_id: 'GPL-2.0' },
          ...extra,
        })
      : new HttpResponse(null, { status }),
  );

const scannerHandlers = (counter: { mb: number }) => [
  http.post('https://mb-api.abuse.ch/api/v1/', () => {
    counter.mb += 1;
    return HttpResponse.json({ query_status: 'hash_not_found' });
  }),
];

describe('runCron', () => {
  it('管理者が停止したプラグインは、同期と検査の後も停止のまま', async () => {
    await registerFixture();
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT admin_suspended FROM plugins').first<{ admin_suspended: number }>();
    expect(row?.admin_suspended).toBe(1);
  });

  it('GitHub でリポジトリが消えたら掲載終了にする', async () => {
    await registerFixture();
    network.use(repoById(404), ...scannerHandlers({ mb: 0 }));
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(1);
  });

  it('GitHub の障害では既存の情報を変えない', async () => {
    await registerFixture();
    const before = await env.DB.prepare('SELECT * FROM plugins').first();
    network.use(repoById(503), ...scannerHandlers({ mb: 0 }));
    const report = await runCron(env);
    expect(report.stoppedBy).toBe('github_unavailable');
    expect(await env.DB.prepare('SELECT * FROM plugins').first()).toEqual(before);
  });

  it('新しく現れた配布物は、同じ digest の過去の結果があっても照会し直す', async () => {
    await registerFixture();
    await env.DB.prepare(
      "UPDATE scans SET result = 'not_found', attempts = 1, scanned_at = '2026-11-01T00:00:00Z'",
    ).run();
    // 同じ内容のファイルを別のアセット ID で上げ直した新しいリリース
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      repoById(),
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, () =>
        HttpResponse.json({
          id: 7002,
          tag_name: 'v1.2.0',
          name: 'v1.2.0',
          draft: false,
          prerelease: false,
          published_at: '2026-11-08T00:00:00Z',
          html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/v1.2.0`,
          assets: [
            {
              id: 8101,
              name: 'x-windows-x64.zip',
              size: 1,
              digest: `sha256:${'d1'.repeat(32)}`,
              browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/v1.2.0/x.zip`,
            },
          ],
        }),
      ),
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/commits/v1.2.0`, () => HttpResponse.json({ sha: 'abc' })),
      ...releaseCheckHandlers(),
    );
    await runCron(env, undefined);
    const scan = await env.DB.prepare(`SELECT result FROM scans WHERE digest = ? AND scanner = 'malwarebazaar'`)
      .bind(`sha256:${'d1'.repeat(32)}`)
      .first<{ result: string }>();
    expect(scan?.result).toBe('pending');
  });

  it('多数のプラグインがあっても 1 回の外部呼び出しと D1 クエリが予算に収まる', async () => {
    await registerFixture();
    const stamp = '2000-01-01T00:00:00Z';
    for (let i = 0; i < 30; i += 1) {
      await env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
      )
        .bind(`allegromoltov/p${i}`, 910000 + i, OWNER, `p${i}`, stamp, stamp, stamp)
        .run();
      for (const scanner of ['malwarebazaar']) {
        await env.DB.prepare("INSERT INTO scans (digest, scanner, result) VALUES (?, ?, 'pending')")
          .bind(`sha256:${i.toString(16).padStart(64, '0')}`, scanner)
          .run();
      }
    }
    const counter = { mb: 0 };
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers(counter),
      http.get('https://api.github.com/repositories/:id', ({ params }) =>
        HttpResponse.json({
          id: Number(params.id),
          name: 'p',
          owner: { login: OWNER },
          private: false,
          archived: false,
          license: { spdx_id: 'MIT' },
        }),
      ),
      http.get(
        'https://api.github.com/repos/:owner/:repo/releases/latest',
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report.subrequests).toBeLessThanOrEqual(45);
    expect(report.d1Queries).toBeLessThanOrEqual(45);
    expect(counter.mb).toBeLessThanOrEqual(10);
  });
});

describe('runCron の同期の失敗', () => {
  it('1 件のプラグインで 403 が続いても、ほかのプラグインの同期を止めない', async () => {
    const stamp = '2000-01-01T00:00:00Z';
    for (const [i, id] of [
      [1, 920001],
      [2, 920002],
    ] as const) {
      await env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
      )
        .bind(`allegromoltov/q${i}`, id, OWNER, `q${i}`, stamp, stamp, `2000-01-0${i}T00:00:00Z`)
        .run();
    }
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      http.get('https://api.github.com/repositories/920001', () => new HttpResponse(null, { status: 403 })),
      http.get('https://api.github.com/repositories/920002', () =>
        HttpResponse.json({
          id: 920002,
          name: 'q2',
          owner: { login: OWNER },
          private: false,
          archived: false,
          license: { spdx_id: 'MIT' },
        }),
      ),
      http.get(
        `https://api.github.com/repos/${OWNER}/q2/releases/latest`,
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ synced: 1, failed: 1 });
  });

  it('掲載終了のリポジトリが公開に戻れば、掲載終了を解く', async () => {
    await registerFixture();
    await env.DB.prepare('UPDATE plugins SET removed = 1').run();
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      repoById(),
      http.get(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(0);
  });
});

describe('runCron の画像の取得', () => {
  it('条件に合う画像だけを保存し、タグが変わらなければ取得し直さない', async () => {
    await registerFixture();
    const calls: string[] = [];
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers({ 'logo.png': png(64, 64), 'image.png': svg }, calls),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const { results } = await env.DB.prepare('SELECT kind, content_type, width FROM plugin_images').all();
    expect(results).toEqual([{ kind: 'logo', content_type: 'image/png', width: 64 }]);

    calls.length = 0;
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    await runCron(env);
    expect(calls).toEqual([]);
  });
});

describe('runCron のビルドに使った OBS の版', () => {
  it('buildspec.json の版を保存し、形の合わない値は保存しない', async () => {
    await registerFixture();
    const calls: string[] = [];
    const buildspec = (version: string) =>
      http.get('https://api.github.com/repos/:owner/:repo/contents/buildspec.json', () => {
        calls.push('buildspec');
        return HttpResponse.text(JSON.stringify({ dependencies: { 'obs-studio': { version } } }));
      });
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      buildspec('31.1.1'),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    expect(await env.DB.prepare('SELECT obs_build_version FROM releases').first('obs_build_version')).toBe('31.1.1');

    // 同じリリースでは取得し直さない。新しい版の検査も buildspec.json を読むため、この確認では検査を済ませておく。
    await env.DB.prepare('UPDATE release_checks SET legacy = 1').run();
    calls.length = 0;
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    await runCron(env);
    expect(calls).toEqual([]);

    // 形の合わない値は、画面に出さないよう空文字列で記録する。
    await env.DB.prepare('UPDATE releases SET obs_build_version = NULL').run();
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    network.use(buildspec('<script>'));
    await runCron(env);
    expect(await env.DB.prepare('SELECT obs_build_version FROM releases').first('obs_build_version')).toBe('');
  });
});

describe('runCron のダウンロード数の記録', () => {
  it('下書きを除いたダウンロード数の合計を記録し、同じ日には取得し直さない', async () => {
    await registerFixture();
    const calls: string[] = [];
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers([120, 30], calls),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const { results } = await env.DB.prepare('SELECT total FROM download_snapshots').all();
    expect(results).toEqual([{ total: 150 }]);

    calls.length = 0;
    await runCron(env);
    expect(calls).toEqual([]);
  });
});

// 名前の変更には追従し、所有者の変更は管理者が確かめる (ADR 0015)。
describe('runCron の名前の変更と移管', () => {
  const sync = async (extra: Record<string, unknown>) => {
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    network.use(
      repoById(200, extra),
      // 新しい名前でのリリースの取得。このテストは所有者と名前の記録だけを確かめるため、リリースなしを返す。
      http.get('https://api.github.com/repos/:owner/:repo/releases/latest', ({ params }) =>
        params.owner === OWNER && params.repo === REPO ? undefined : new HttpResponse(null, { status: 404 }),
      ),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    network.resetHandlers();
  };
  const plugin = () =>
    env.DB.prepare('SELECT owner, repo, owner_changed_at FROM plugins').first<{
      owner: string;
      repo: string;
      owner_changed_at: string | null;
    }>();

  it('所有者が変わったら日時を記録し、旧い名前を大文字と小文字を保って残す', async () => {
    await registerFixture();
    await sync({ owner: { login: 'NewOwner' } });
    const row = await plugin();
    expect(row?.owner).toBe('NewOwner');
    expect(row?.owner_changed_at).not.toBeNull();
    const alias = await env.DB.prepare('SELECT alias, name FROM plugin_aliases').first<{
      alias: string;
      name: string;
    }>();
    expect(alias).toEqual({ alias: `${OWNER}/${REPO}`.toLowerCase(), name: `${OWNER}/${REPO}` });
  });

  it('名前を変えたら、保存済みの古い版のリリースとダウンロードの URL を新しい名前にする', async () => {
    await registerFixture();
    await sync({ owner: { login: 'NewOwner' }, name: 'Renamed-Plugin' });
    const urls = await env.DB.prepare(
      'SELECT r.html_url, a.download_url FROM releases r JOIN assets a ON a.release_id = r.github_release_id',
    ).all<{ html_url: string; download_url: string }>();
    expect(urls.results.length).toBeGreaterThan(0);
    for (const row of urls.results) {
      expect(row.html_url).toMatch(/^https:\/\/github\.com\/NewOwner\/Renamed-Plugin\/releases\/tag\/v1\.1\.0$/);
      expect(row.download_url).toMatch(
        /^https:\/\/github\.com\/NewOwner\/Renamed-Plugin\/releases\/download\/v1\.1\.0\//,
      );
    }
  });

  it('同じ所有者のままの名前の変更では、所有者の変更として記録しない', async () => {
    await registerFixture();
    await sync({ name: 'Renamed-Plugin' });
    const row = await plugin();
    expect(row?.repo).toBe('Renamed-Plugin');
    expect(row?.owner_changed_at).toBeNull();
  });
});

describe('runCron の概要の更新', () => {
  it('description が変われば概要を更新し、空なら登録時の概要を残す', async () => {
    await registerFixture();
    // 掲載中のプラグインにする。確認待ちの版がある間は概要を追従させないため。
    await markListable(env.DB);
    await recordListings(env, new Budget());
    const summary = () =>
      env.DB.prepare('SELECT summary FROM plugins')
        .first<{ summary: string }>()
        .then((row) => row?.summary);
    const run = async (description: string) => {
      await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
      network.use(
        repoById(200, { description }),
        ...githubHandlers(),
        ...imageHandlers(),
        ...downloadHandlers(),
        ...scannerHandlers({ mb: 0 }),
        ...releaseCheckHandlers(),
      );
      await runCron(env);
      network.resetHandlers();
    };
    await run('A new pitch shift filter');
    expect(await summary()).toBe('A new pitch shift filter');
    await run('');
    expect(await summary()).toBe('A new pitch shift filter');
  });

  it('確認待ちの版がある間は、description を概要に追従させない', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    network.use(
      repoById(200, { description: 'Download the fixed build from https://example.com' }),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT summary FROM plugins').first<{ summary: string }>();
    expect(row?.summary).not.toContain('example.com');
  });
});

describe('掲載の期間と止めた版の記録', () => {
  it('掲載した配布物の期間を記録し、マルウェアを検出したら版を記録して期間を閉じる。プラグインを消しても記録は残す', async () => {
    await registerFixture();
    await markListable(env.DB);
    await recordListings(env, new Budget());
    const open = await env.DB.prepare('SELECT count(*) AS n FROM listing_periods WHERE ended_at IS NULL').first('n');
    expect(open).toBe(2);

    await env.DB.prepare("UPDATE scans SET result = 'malicious'").run();
    await recordListings(env, new Budget());
    expect(await env.DB.prepare('SELECT reason FROM release_suspensions').first('reason')).toBe('malicious');
    expect(await env.DB.prepare('SELECT count(*) AS n FROM listing_periods WHERE ended_at IS NULL').first('n')).toBe(0);

    await env.DB.prepare('DELETE FROM plugins').run();
    expect(await env.DB.prepare('SELECT count(*) AS n FROM listing_periods').first('n')).toBe(2);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM release_suspensions').first('n')).toBe(1);
  });
});

describe('新しい版の検査の無料枠の待ち', () => {
  it('無料枠が戻る時刻までは、レビューだけが残った版を選ばず、試行の回数も進めない', async () => {
    await registerFixture();
    await env.DB.prepare(
      "UPDATE release_checks SET config_state = 'missing', diff_state = 'skipped', review_wait_until = '2999-01-01T00:00:00Z'",
    ).run();
    expect(await runReleaseChecks(env, new Budget())).toBe(0);
    expect(await env.DB.prepare('SELECT review_attempts FROM release_checks').first('review_attempts')).toBe(0);
  });
});

describe('証明の検証のワークフローの起動', () => {
  const DISPATCH_URL =
    'https://api.github.com/repos/AllegroMoltoV/plugin-soko-kun/actions/workflows/verify.yaml/dispatches';
  const withToken = { ...env, GITHUB_DISPATCH_TOKEN: 'test-dispatch-token' };

  it('検証待ちの配布物があれば、同期が止まっても main を指定して起動する', async () => {
    await registerFixture();
    const bodies: unknown[] = [];
    network.use(
      repoById(503),
      ...scannerHandlers({ mb: 0 }),
      http.post(DISPATCH_URL, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer test-dispatch-token');
        bodies.push(await request.json());
        return HttpResponse.json({ workflow_run_id: 1 });
      }),
    );
    const report = await runCron(withToken);
    expect(report.stoppedBy).toBe('github_unavailable');
    expect(report.verifyDispatch).toBe('dispatched');
    expect(bodies).toEqual([{ ref: 'main' }]);
  });

  it('ほかの処理が外部呼び出しの予算を使い切っても、取り分けた 1 件で起動する', async () => {
    await registerFixture();
    network.use(
      repoById(),
      ...githubHandlers(),
      ...scannerHandlers({ mb: 0 }),
      http.post(DISPATCH_URL, () => HttpResponse.json({ workflow_run_id: 1 })),
    );
    const budget = new Budget();
    for (let i = 0; i < 44; i += 1) budget.takeSubrequest();
    const report = await runCron(withToken, budget);
    expect(report.verifyDispatch).toBe('dispatched');
    expect(report.subrequests).toBe(45);
  });

  it('検証待ちが無ければ起動しない', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE attestation_checks SET result = 'passed'").run();
    network.use(repoById(503), ...scannerHandlers({ mb: 0 }));
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('skipped_no_pending');
  });

  it('トークンが拒否されても定期処理は最後まで進み、失敗を返す', async () => {
    await registerFixture();
    network.use(
      repoById(503),
      ...scannerHandlers({ mb: 0 }),
      http.post(DISPATCH_URL, () => new HttpResponse(null, { status: 401 })),
    );
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('failed_401');
  });
});
