// 定期処理の危険側の境界: 停止の解除、検査結果の流用、障害時のデータ破壊、無料プランの上限超過。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { runCron } from '../../src/domain/cron';
import { submitPlugin } from '../../src/domain/submit';
import { githubHandlers, OWNER, REPO, REPO_ID, USER_TOKEN } from '../fixtures/github';
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

const scannerHandlers = (counter: { vt: number; mb: number }) => [
  http.get('https://www.virustotal.com/api/v3/files/:hash', () => {
    counter.vt += 1;
    return HttpResponse.json({
      data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, undetected: 70 } } },
    });
  }),
  http.post('https://mb-api.abuse.ch/api/v1/', () => {
    counter.mb += 1;
    return HttpResponse.json({ query_status: 'hash_not_found' });
  }),
];

describe('runCron', () => {
  it('管理者が停止したプラグインは、同期と検査の後も停止のまま', async () => {
    await registerFixture();
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    network.use(repoById(), ...githubHandlers(), ...scannerHandlers({ vt: 0, mb: 0 }));
    await runCron(env);
    const row = await env.DB.prepare('SELECT admin_suspended FROM plugins').first<{ admin_suspended: number }>();
    expect(row?.admin_suspended).toBe(1);
  });

  it('GitHub でリポジトリが消えたら掲載終了にする', async () => {
    await registerFixture();
    network.use(repoById(404), ...scannerHandlers({ vt: 0, mb: 0 }));
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(1);
  });

  it('GitHub の障害では既存の情報を変えない', async () => {
    await registerFixture();
    const before = await env.DB.prepare('SELECT * FROM plugins').first();
    network.use(repoById(503), ...scannerHandlers({ vt: 0, mb: 0 }));
    const report = await runCron(env);
    expect(report.stoppedBy).toBe('github_unavailable');
    expect(await env.DB.prepare('SELECT * FROM plugins').first()).toEqual(before);
  });

  it('新しく現れた配布物は、同じ digest の過去の結果があっても照会し直す', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE scans SET result = 'clean', attempts = 1, scanned_at = '2026-11-01T00:00:00Z'").run();
    // 同じ内容のファイルを別のアセット ID で上げ直した新しいリリース
    network.use(
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
    );
    await runCron(env, undefined);
    const scan = await env.DB.prepare(`SELECT result FROM scans WHERE digest = ? AND scanner = 'virustotal'`)
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
      for (const scanner of ['virustotal', 'malwarebazaar']) {
        await env.DB.prepare("INSERT INTO scans (digest, scanner, result) VALUES (?, ?, 'pending')")
          .bind(`sha256:${i.toString(16).padStart(64, '0')}`, scanner)
          .run();
      }
    }
    const counter = { vt: 0, mb: 0 };
    network.use(
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
    );
    const report = await runCron(env);
    expect(report.subrequests).toBeLessThanOrEqual(45);
    expect(report.d1Queries).toBeLessThanOrEqual(45);
    expect(counter.vt).toBeLessThanOrEqual(4);
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
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ synced: 1, failed: 1 });
  });

  it('掲載終了のリポジトリが公開に戻れば、掲載終了を解く', async () => {
    await registerFixture();
    await env.DB.prepare('UPDATE plugins SET removed = 1').run();
    network.use(
      repoById(),
      http.get(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...scannerHandlers({ vt: 0, mb: 0 }),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(0);
  });
});
