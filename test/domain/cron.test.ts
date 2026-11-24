// 定期処理の危険側の境界: 停止の解除、検査結果の流用、障害時のデータ破壊、無料プランの上限超過。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import {
  FINAL_RESERVE,
  MALWAREBAZAAR_PER_RUN,
  recordListings,
  runCron,
  SYNC_COST,
  SYNC_OUTAGE_FAILURES,
} from '../../src/domain/cron';
import { RELEASE_CHECK_COST, runReleaseChecks } from '../../src/domain/release-checks';
import { MAX_SCAN_ATTEMPTS } from '../../src/domain/status';
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

// 検査の対象にならない (リリースの無い) プラグインを足す。last_synced_at は同期の順番を決める。
async function insertBarePlugin(index: number, lastSyncedAt: string): Promise<void> {
  const stamp = '2000-01-01T00:00:00Z';
  await env.DB.prepare(
    `INSERT OR IGNORE INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
     VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
  )
    .bind(`allegromoltov/q${index}`, 920000 + index, OWNER, `q${index}`, stamp, stamp, lastSyncedAt)
    .run();
}

// GitHub 全体の障害。同期が続けて失敗して止まるよう、検査の対象にならないプラグインを足して SYNC_OUTAGE_FAILURES 件以上にする。
async function githubOutage() {
  for (let i = 1; i < SYNC_OUTAGE_FAILURES; i += 1) await insertBarePlugin(i, '2000-01-01T00:00:00Z');
  return http.get('https://api.github.com/repositories/:id', () => new HttpResponse(null, { status: 503 }));
}

const bareRepo = (index: number) =>
  http.get(`https://api.github.com/repositories/${920000 + index}`, () =>
    HttpResponse.json({
      id: 920000 + index,
      name: `q${index}`,
      owner: { login: OWNER },
      private: false,
      archived: false,
      license: { spdx_id: 'MIT' },
    }),
  );
const bareLatest = (index: number) =>
  http.get(
    `https://api.github.com/repos/${OWNER}/q${index}/releases/latest`,
    () => new HttpResponse(null, { status: 304 }),
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
    // 新しい版の検査は同期より先に走る (sd0)。消えたリポジトリでも検査の呼び出しが先に起きる。
    network.use(repoById(404), ...scannerHandlers({ mb: 0 }), ...releaseCheckHandlers());
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(1);
  });

  it('GitHub の障害では、同期の時刻のほかに既存の情報を変えない', async () => {
    await registerFixture();
    const select = `SELECT * FROM plugins WHERE id = (SELECT plugin_id FROM releases LIMIT 1)`;
    const { last_synced_at: _before, ...before } = (await env.DB.prepare(select).first()) ?? {};
    network.use(await githubOutage(), ...scannerHandlers({ mb: 0 }), ...releaseCheckHandlers());
    const report = await runCron(env);
    expect(report).toMatchObject({ stoppedBy: 'github_unavailable', synced: 0, failed: SYNC_OUTAGE_FAILURES });
    const { last_synced_at: after, ...rest } = (await env.DB.prepare(select).first()) ?? {};
    expect(rest).toEqual(before);
    expect(after).not.toBe('2000-01-01T00:00:00Z');
    expect(report.downloadsRecorded).toBe(0);
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
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/commits/refs/tags/v1.2.0`, () =>
        HttpResponse.json({ sha: 'abc' }),
      ),
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

// 予算の算式: 照会の上限・検査の間の取り分け (同期 1 件と起動 1 件)・検査 1 件の上限が、1 回の起動の予算に収まること。
// 1 件の処理の外部呼び出しの件数を上げたときに、検査が始まらない不具合 (2026-11-15、sd0) が戻らないよう固定する。
describe('定期処理の予算の算式', () => {
  it('照会の上限と検査の間の取り分けを引いても、新しい版の検査 1 件の外部呼び出しが残る', () => {
    expect(MALWAREBAZAAR_PER_RUN + FINAL_RESERVE + SYNC_COST + RELEASE_CHECK_COST).toBeLessThanOrEqual(
      new Budget().maxSubrequests,
    );
  });
});

// 定期処理の生存: 予算を超えないことだけでなく、新しい版の検査と同期が止まらずに進むこと (課題 sd0)。
describe('runCron の新しい版の検査と同期の優先', () => {
  const checkState = () =>
    env.DB.prepare('SELECT config_state, diff_state, review_state, review_attempts FROM release_checks').first<{
      config_state: string;
      diff_state: string;
      review_state: string;
      review_attempts: number;
    }>();

  // 登録済みのプラグイン 1 件 (検査を待つ版がある) と、同期を待つほかのプラグイン 20 件。
  async function seedPlugins(): Promise<void> {
    await registerFixture();
    const stamp = '2000-01-01T00:00:00Z';
    for (let i = 0; i < 20; i += 1) {
      await env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
      )
        .bind(`allegromoltov/p${i}`, 920000 + i, OWNER, `p${i}`, stamp, stamp, stamp)
        .run();
    }
  }

  const syncHandlers = () => [
    ...imageHandlers(),
    ...downloadHandlers(),
    ...scannerHandlers({ mb: 0 }),
    http.get('https://api.github.com/repositories/:id', ({ params }) => {
      const id = Number(params.id);
      return HttpResponse.json({
        id,
        name: id === REPO_ID ? REPO : `p${id - 920000}`,
        owner: { login: OWNER },
        private: false,
        archived: false,
        license: { spdx_id: id === REPO_ID ? 'GPL-2.0' : 'MIT' },
      });
    }),
    http.get(
      'https://api.github.com/repos/:owner/:repo/releases/latest',
      () => new HttpResponse(null, { status: 304 }),
    ),
  ];

  // 2026-11-15 の本番: 同期 11 件で外部呼び出しを 23 件使い、新しい版の検査が始まらなかった。
  it('同期を待つプラグインが多くても、1 回の起動で新しい版の検査が D1 の状態を進める', async () => {
    await seedPlugins();
    network.use(...syncHandlers(), ...releaseCheckHandlers());
    const report = await runCron(env);
    const state = await checkState();
    expect(state?.config_state).not.toBe('pending');
    expect(state?.diff_state).not.toBe('pending');
    expect(report.subrequests).toBeLessThanOrEqual(45);
    expect(report.d1Queries).toBeLessThanOrEqual(45);
  });

  // 名前を変えたリポジトリなどで検査の呼び出しがリダイレクトで膨らんでも、同期が名前を直せるよう後段を走らせる。
  it('検査の途中で予算を使い切りそうになっても、検査だけを打ち切り、同じ起動で同期を進める', async () => {
    await seedPlugins();
    const base = 'https://api.github.com/repos/:owner/:repo';
    // すべての取得を 2 回リダイレクトさせ、1 回の取得で外部呼び出しを 3 件使わせる。
    const redirected =
      (serve: () => Response): Parameters<typeof http.get>[1] =>
      ({ request }) => {
        const url = new URL(request.url);
        const hop = Number(url.searchParams.get('hop') ?? '0');
        if (hop < 2) {
          url.searchParams.set('hop', String(hop + 1));
          return new HttpResponse(null, { status: 302, headers: { Location: url.toString() } });
        }
        return serve();
      };
    const paths = [
      ...Array.from({ length: 6 }, (_, i) => `.github/workflows/w${i}.yaml`),
      'README.md',
      'CMakeLists.txt',
      'cmake/windows/compilerconfig.cmake',
      'cmake/macos/compilerconfig.cmake',
      'vcpkg.json',
      'CONTRIBUTING.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/ISSUE_TEMPLATE/bug.yml',
      '.github/ISSUE_TEMPLATE/feature.yml',
    ];
    network.use(
      ...syncHandlers(),
      http.get(
        `${base}/git/trees/:ref`,
        redirected(() => HttpResponse.json({ tree: paths.map((path) => ({ path, type: 'blob' })), truncated: false })),
      ),
      http.get(
        `${base}/contents/*`,
        redirected(() => new HttpResponse(null, { status: 404 })),
      ),
      http.get(
        `${base}/compare/:range`,
        redirected(() => HttpResponse.json({ status: 'behind', commits: [], files: [] })),
      ),
      http.get(
        `${base}/rulesets`,
        redirected(() => HttpResponse.json([])),
      ),
      http.get(
        `${base}/license`,
        redirected(() => HttpResponse.json({ license: { spdx_id: 'GPL-2.0' } })),
      ),
    );
    const report = await runCron(env);
    expect(report.releaseChecksSkipped).toBe('budget');
    expect(report.synced).toBeGreaterThanOrEqual(1);
    expect(report.stoppedBy).toBeUndefined();
    expect(report.subrequests).toBeLessThanOrEqual(45);
  });

  // そのリポジトリだけの恒常的な失敗で、同じ版が検査の先頭を占め続けないようにする。
  it('検査で GitHub が 500 を返し続けると試行を数えて上限で止まり、その間も同期を進める', async () => {
    await seedPlugins();
    const fail = () => new HttpResponse(null, { status: 500 });
    const base = 'https://api.github.com/repos/:owner/:repo';
    // 同期の画像の取得 (.soko-kun の一覧) は失敗させず、検査が読む宣言ファイルとライセンスと差分とファイルの一覧だけを失敗させる。
    const failing = [
      http.get(`${base}/contents/.soko-kun/config.json`, fail),
      http.get(`${base}/license`, fail),
      http.get(`${base}/compare/:range`, fail),
      http.get(`${base}/git/trees/:ref`, fail),
      http.get(`${base}/rulesets`, fail),
    ];
    network.use(...syncHandlers(), ...failing);
    const first = await runCron(env);
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    network.resetHandlers();
    network.use(...syncHandlers(), ...failing);
    const second = await runCron(env);
    expect((await checkState())?.review_attempts).toBe(2);
    expect(first.synced).toBeGreaterThanOrEqual(1);
    expect(second.synced).toBeGreaterThanOrEqual(1);
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

  // そのリポジトリだけが 5xx や形の合わない応答を返し続けても、ほかのプラグインを巻き込まない (ADR 0019 の原則 2)。
  it.each([
    ['503', () => new HttpResponse(null, { status: 503 })],
    ['422', () => new HttpResponse(null, { status: 422 })],
    ['通信の失敗', () => HttpResponse.error()],
    ['JSON でない 200 の応答', () => new HttpResponse('<html>maintenance</html>', { status: 200 })],
  ])(
    '先頭のプラグインで %s が続いても、時刻を進めてほかのプラグインを同期し、定期処理を最後まで進める',
    async (_name, failure) => {
      for (const i of [1, 2, 3]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
      network.use(
        ...imageHandlers(),
        ...downloadHandlers(),
        http.get('https://api.github.com/repositories/920001', failure),
        bareRepo(2),
        bareRepo(3),
        bareLatest(2),
        bareLatest(3),
        ...releaseCheckHandlers(),
      );
      const report = await runCron(env);
      expect(report).toMatchObject({ synced: 2, failed: 1 });
      expect(report.stoppedBy).toBeUndefined();
      expect(report.adminNotify).toBeDefined();
      const head = await env.DB.prepare("SELECT last_synced_at FROM plugins WHERE id = 'allegromoltov/q1'").first<{
        last_synced_at: string;
      }>();
      // 時刻を進めるため、次の起動では失敗したプラグインが先頭で止め続けない。
      expect(head?.last_synced_at).not.toBe('2000-01-01T00:00:00Z');
    },
  );

  it('成功を挟まずに続けて失敗したら、GitHub 全体の障害として同期を止める', async () => {
    for (const i of [1, 2, 3, 4]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    const calls: string[] = [];
    network.use(
      http.get('https://api.github.com/repositories/:id', ({ params }) => {
        calls.push(String(params.id));
        return new HttpResponse(null, { status: 503 });
      }),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ stoppedBy: 'github_unavailable', synced: 0, failed: SYNC_OUTAGE_FAILURES });
    expect(calls).toHaveLength(SYNC_OUTAGE_FAILURES);
  });

  it('成功か、GitHub の障害の証拠にならない失敗を挟めば、同期を止めない', async () => {
    for (const i of [1, 2, 3, 4, 5, 6]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    const unavailable = () => new HttpResponse(null, { status: 503 });
    network.use(
      http.get('https://api.github.com/repositories/920001', unavailable),
      bareRepo(2),
      bareLatest(2),
      http.get('https://api.github.com/repositories/920003', unavailable),
      http.get('https://api.github.com/repositories/920004', () => new HttpResponse(null, { status: 403 })),
      http.get('https://api.github.com/repositories/920005', unavailable),
      bareRepo(6),
      bareLatest(6),
      ...downloadHandlers(),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ synced: 2, failed: 4 });
    expect(report.stoppedBy).toBeUndefined();
  });

  it('ダウンロード数の記録で先頭の 3 件が失敗し続けても、ほかのプラグインを記録する', async () => {
    await registerFixture();
    const fixture = await env.DB.prepare('SELECT id FROM plugins').first<{ id: string }>();
    // 記録の済んだ日が古いものより、記録の無いものが先に選ばれる。失敗するプラグインを先頭に置く。
    await env.DB.prepare("INSERT INTO download_snapshots (plugin_id, day, total) VALUES (?, '2000-01-01', 0)")
      .bind(fixture?.id)
      .run();
    for (const i of [1, 2, 3]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      ...[1, 2, 3].flatMap((i) => [
        bareRepo(i),
        bareLatest(i),
        http.get(`https://api.github.com/repos/${OWNER}/q${i}/releases`, () => new HttpResponse(null, { status: 503 })),
      ]),
      ...downloadHandlers([5]),
    );
    const report = await runCron(env);
    expect(report.failed).toBe(0);
    expect(report).toMatchObject({ downloadsRecorded: 1, downloadsFailed: 3 });
    const { results } = await env.DB.prepare('SELECT plugin_id FROM download_snapshots WHERE total = 5').all();
    expect(results).toEqual([{ plugin_id: fixture?.id }]);
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
    expect(await runCron(env)).toMatchObject({ synced: 1, failed: 0 });
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
    // 同期の失敗は飲み込まれるため、モックの漏れで失敗に化けていないことも確かめる。
    expect(await runCron(env)).toMatchObject({ synced: 1, failed: 0 });
    const { results } = await env.DB.prepare('SELECT total FROM download_snapshots').all();
    expect(results).toEqual([{ total: 150 }]);

    calls.length = 0;
    await runCron(env);
    expect(calls).toEqual([]);
  });

  // 同期は最新のリリースしか読まないため、最新でない掲載中の版の本文の編集は、1 日 1 回の記録で拾う。
  it('リリースの一覧の本文に案内が足されていれば、その版を確認待ちにする', async () => {
    await registerFixture();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers([1], [], 'Fixed bugs.\ncurl -fsSL https://example.com/install.sh | bash'),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare(
      'SELECT notes_held, admin_approved_at FROM release_checks WHERE github_release_id = 7001',
    ).first<{ notes_held: number; admin_approved_at: string | null }>();
    expect(row).toEqual({ notes_held: 1, admin_approved_at: null });
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

describe('新しい版の検査の通信の検出の待ち', () => {
  const attempts = () => env.DB.prepare('SELECT review_attempts FROM release_checks').first('review_attempts');

  it('通信の検出の結果が届くまでは、レビューだけが残った版を選ばない', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE release_checks SET config_state = 'missing', diff_state = 'skipped'").run();
    await env.DB.prepare(`UPDATE releases SET published_at = '${new Date().toISOString()}'`).run();
    expect(await runReleaseChecks(env, new Budget())).toBe(0);
    expect(await attempts()).toBe(0);
  });

  // verify.yaml の schedule が止まっても、新しい版のレビューが止まり続けないことを確かめる。
  it('版の公開から 6 時間を過ぎたら、検出の結果なしでレビューする', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE release_checks SET config_state = 'missing', diff_state = 'skipped'").run();
    const old = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`UPDATE releases SET published_at = '${old}'`).run();
    network.use(...releaseCheckHandlers());
    await runReleaseChecks(env, new Budget());
    // テストの環境には Workers AI が無いため、レビューは失敗として 1 回に数える。レビューに進んだことの確認に使う。
    expect(await attempts()).toBe(1);
  });

  // 公開から 6 時間を過ぎた版では、宣言ファイルの判定とレビューが同じ起動で動く。保存前の申告をレビューに渡す (ADR 0018)。
  it('宣言ファイルの判定とレビューが同じ起動で動くとき、その起動で解析した申告をレビューに渡す', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE release_checks SET diff_state = 'skipped'").run();
    const old = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`UPDATE releases SET published_at = '${old}'`).run();
    const config = JSON.stringify({ paidFeatures: true, paidServices: ['OpenAI API'] });
    network.use(
      http.get('https://api.github.com/repos/:owner/:repo/contents/.soko-kun/config.json', () =>
        HttpResponse.text(config),
      ),
      ...releaseCheckHandlers(),
    );
    const prompts: string[] = [];
    const withAi = {
      ...env,
      AI: {
        run: async (_model: string, input: unknown) => {
          prompts.push(JSON.stringify(input));
          throw new Error('AiError: 3046: Request timeout');
        },
      },
    } as unknown as typeof env;
    await runReleaseChecks(withAi, new Budget());
    expect(prompts.join('\n')).toContain('paidFeatures=true');
  });
});

describe('新しい版の検査のタグのコミットの位置', () => {
  const check = () =>
    env.DB.prepare('SELECT diff_state, diff_hits FROM release_checks').first<{
      diff_state: string;
      diff_hits: string | null;
    }>();
  const compare = (respond: () => Response, urls: string[]) =>
    http.get('https://api.github.com/repos/:owner/:repo/compare/:range', ({ request }) => {
      urls.push(request.url);
      return respond();
    });

  async function runFirstVersionCheck(handler: ReturnType<typeof http.get>): Promise<void> {
    await registerFixture();
    await env.DB.prepare("UPDATE release_checks SET config_state = 'missing'").run();
    await env.DB.prepare(`UPDATE releases SET published_at = '${new Date().toISOString()}'`).run();
    network.use(handler, ...releaseCheckHandlers());
    await runReleaseChecks(env, new Budget());
  }

  // 書き込みの権限で既定のブランチ以外のコミットに付けたタグは、掲載中の版が無くても管理者の確認に回す。
  it('タグのコミットが既定のブランチに無ければ、掲載中の版が無くても held にし、タグの名前ではなくコミットで比べる', async () => {
    const urls: string[] = [];
    await runFirstVersionCheck(compare(() => HttpResponse.json({ status: 'ahead', commits: [], files: [] }), urls));
    const row = await check();
    expect(row?.diff_state).toBe('held');
    expect(JSON.parse(row?.diff_hits ?? '[]')).toEqual([{ rule: 'tag-not-on-default-branch' }]);
    const sha = await env.DB.prepare('SELECT commit_sha FROM releases').first<string>('commit_sha');
    expect(urls).toEqual([expect.stringContaining(`/compare/HEAD...${sha}`)]);
  });

  it('比較の応答が上限を超えたら、既定のブランチに無いものとして held にする', async () => {
    const large = JSON.stringify({ status: 'behind', files: [{ patch: 'x'.repeat(70 * 1024) }] });
    await runFirstVersionCheck(
      compare(() => new HttpResponse(large, { headers: { 'Content-Type': 'application/json' } }), []),
    );
    expect((await check())?.diff_state).toBe('held');
  });

  // タグと同じ名前のブランチで検査の対象を変えられないよう、差分・宣言ファイル・レビューのファイルはタグの名前ではなく記録済みのコミットで読む。
  it('掲載中の版があれば、差分と宣言ファイルとレビューのファイルを、タグの名前ではなくコミットで読む', async () => {
    await registerFixture();
    await markListable(env.DB);
    const baseSha = await env.DB.prepare('SELECT commit_sha FROM releases').first<string>('commit_sha');
    const headSha = 'b'.repeat(40);
    const old = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url)
         SELECT 7002, plugin_id, 'v1.2.0', 'v1.2.0', ?, ?, 'https://github.com/x/y/releases/tag/v1.2.0' FROM releases`,
      ).bind(headSha, old),
      env.DB.prepare('INSERT INTO release_checks (github_release_id, immutable) VALUES (7002, 1)'),
    ]);
    const urls: string[] = [];
    const base = 'https://api.github.com/repos/:owner/:repo';
    const recorded = (path: string, respond: () => Response) =>
      http.get(`${base}${path}`, ({ request }) => {
        urls.push(request.url);
        return respond();
      });
    const missing = () => new HttpResponse(null, { status: 404 });
    network.use(
      recorded('/compare/:range', () => HttpResponse.json({ status: 'behind', commits: [], files: [] })),
      recorded('/contents/.soko-kun/config.json', missing),
      recorded('/git/trees/:ref', () => HttpResponse.json({ tree: [], truncated: false })),
      recorded('/readme', missing),
      ...releaseCheckHandlers(),
    );
    await runReleaseChecks(env, new Budget());
    const paths = urls.map((url) => decodeURIComponent(new URL(url).pathname + new URL(url).search));
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`/compare/${baseSha}...${headSha}`),
        expect.stringContaining(`/compare/HEAD...${headSha}`),
        expect.stringContaining(`/contents/.soko-kun/config.json?ref=${headSha}`),
        expect.stringContaining(`/git/trees/${headSha}`),
        expect.stringContaining(`/readme?ref=${headSha}`),
      ]),
    );
    expect(paths.filter((path) => path.includes('v1.1.0') || path.includes('v1.2.0'))).toEqual([]);
  });

  it('タグのコミットが既定のブランチにあれば、掲載中の版が無い版は skipped にする', async () => {
    await runFirstVersionCheck(compare(() => HttpResponse.json({ status: 'behind', commits: [], files: [] }), []));
    expect(await check()).toEqual({ diff_state: 'skipped', diff_hits: '[]' });
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
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
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
    await env.DB.prepare("UPDATE release_checks SET network_state = 'done'").run();
    network.use(await githubOutage(), ...scannerHandlers({ mb: 0 }), ...releaseCheckHandlers());
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('skipped_no_pending');
  });

  it('証明の検証が済んでも、通信の検出を待つ版があれば起動する', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE attestation_checks SET result = 'passed'").run();
    network.use(
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      http.post(DISPATCH_URL, () => HttpResponse.json({ workflow_run_id: 1 })),
    );
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('dispatched');
  });

  it('トークンが拒否されても定期処理は最後まで進み、失敗を返す', async () => {
    await registerFixture();
    network.use(
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      http.post(DISPATCH_URL, () => new HttpResponse(null, { status: 401 })),
    );
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('failed_401');
  });
});

// MalwareBazaar の照会の試行の数え方と、照会の例外の閉じ込め (ADR 0019 の原則 2)。
describe('runCron の MalwareBazaar の照会の試行', () => {
  const ZIP = `sha256:${'d1'.repeat(32)}`;
  const OTHER = `sha256:${'e2'.repeat(32)}`;
  const DAY_MS = 86_400_000;

  // 窓口の配布物 (ZIP) を掲載中にし、もう 1 つの配布物 (OTHER) は直前に照会を終えた未登録として、照会の対象から外す。
  async function setupListed(): Promise<void> {
    await registerFixture();
    const asset = await env.DB.prepare(
      'SELECT a.release_id, r.tag FROM assets a JOIN releases r ON r.github_release_id = a.release_id WHERE a.digest = ?',
    )
      .bind(ZIP)
      .first<{ release_id: number; tag: string }>();
    if (!asset) throw new Error('fixture asset is missing');
    await env.DB.prepare(
      "INSERT INTO listing_periods (plugin_id, github_release_id, digest, tag, asset_name, started_at) SELECT id, ?, ?, ?, 'x.zip', ? FROM plugins",
    )
      .bind(asset.release_id, ZIP, asset.tag, new Date().toISOString())
      .run();
    await env.DB.prepare("UPDATE scans SET result = 'not_found', attempts = 0, scanned_at = ? WHERE digest = ?")
      .bind(new Date().toISOString(), OTHER)
      .run();
  }

  const setScan = (digest: string, result: string, attempts: number, scannedAt: string | null) =>
    env.DB.prepare(
      "UPDATE scans SET result = ?, attempts = ?, scanned_at = ? WHERE digest = ? AND scanner = 'malwarebazaar'",
    )
      .bind(result, attempts, scannedAt, digest)
      .run();
  const scanOf = (digest: string) =>
    env.DB.prepare("SELECT result, detail, attempts FROM scans WHERE digest = ? AND scanner = 'malwarebazaar'")
      .bind(digest)
      .first<{ result: string; detail: string | null; attempts: number }>();
  const weekAgo = () => new Date(Date.now() - 8 * DAY_MS).toISOString();

  // 照会した hash を記録し、hash ごとに決めた応答を返す。
  function mbHandler(queried: string[], respond: (hash: string) => Response) {
    return http.post('https://mb-api.abuse.ch/api/v1/', async ({ request }) => {
      const hash = new URLSearchParams(await request.text()).get('hash') ?? '';
      queried.push(hash);
      return respond(hash);
    });
  }
  const answer = (status: string) => () => HttpResponse.json({ query_status: status });
  const run = async (handler: ReturnType<typeof http.post>, budget?: Budget) => {
    network.resetHandlers();
    network.use(await githubOutage(), handler, ...releaseCheckHandlers());
    return runCron(env, budget);
  };

  it('掲載中の配布物の照会し直しが未登録なら、attempts を 0 に戻す', async () => {
    await setupListed();
    // 照会のたびに 1 ずつ増やしていた旧い数え方の値。
    await setScan(ZIP, 'not_found', 7, weekAgo());
    const queried: string[] = [];
    await run(mbHandler(queried, answer('hash_not_found')));
    expect(queried).toEqual(['d1'.repeat(32)]);
    expect(await scanOf(ZIP)).toMatchObject({ result: 'not_found', attempts: 0 });
  });

  it('照会し直しが error になったら 1 から数え、次の起動で照会する', async () => {
    await setupListed();
    await setScan(ZIP, 'not_found', 2, weekAgo());
    await run(mbHandler([], answer('unknown_auth_key')));
    expect(await scanOf(ZIP)).toMatchObject({ result: 'error', attempts: 1 });
    const queried: string[] = [];
    await run(mbHandler(queried, answer('hash_not_found')));
    expect(queried).toEqual(['d1'.repeat(32)]);
    expect(await scanOf(ZIP)).toMatchObject({ result: 'not_found', attempts: 0 });
  });

  it('error が続けば 1 ずつ増え、上限に達したら照会の対象に選ばない', async () => {
    await setupListed();
    await setScan(ZIP, 'error', MAX_SCAN_ATTEMPTS - 1, weekAgo());
    const first: string[] = [];
    await run(mbHandler(first, answer('unknown_auth_key')));
    expect(first).toEqual(['d1'.repeat(32)]);
    expect(await scanOf(ZIP)).toMatchObject({ result: 'error', attempts: MAX_SCAN_ATTEMPTS });
    const second: string[] = [];
    await run(mbHandler(second, answer('hash_not_found')));
    expect(second).toEqual([]);
  });

  it.each([
    ['fetch の例外', () => HttpResponse.error()],
    ['JSON でない 200 の応答', () => new HttpResponse('<html>maintenance</html>', { status: 200 })],
    [
      '別のホストへのリダイレクト',
      () => new HttpResponse(null, { status: 302, headers: { Location: 'https://example.com/' } }),
    ],
  ])(
    '照会が %s になっても、その配布物を error として数え、ほかの配布物の照会と後段を続ける',
    async (_name, failure) => {
      await registerFixture();
      await setScan(ZIP, 'pending', 0, null);
      await setScan(OTHER, 'pending', 0, null);
      const queried: string[] = [];
      const report = await run(
        mbHandler(queried, (hash) =>
          hash === 'd1'.repeat(32) ? failure() : HttpResponse.json({ query_status: 'hash_not_found' }),
        ),
      );
      expect(queried).toHaveLength(2);
      const failed = await scanOf(ZIP);
      expect(failed).toMatchObject({ result: 'error', attempts: 1 });
      expect(failed?.detail?.length).toBeLessThanOrEqual(200);
      expect(await scanOf(OTHER)).toMatchObject({ result: 'not_found', attempts: 0 });
      // 後段の新しい版の検査と同期が走っている (同期は GitHub の障害で止まる)。
      expect(report.releasesChecked).toBeDefined();
      expect(report.stoppedBy).toBe('github_unavailable');
    },
  );

  it('429 は試行に数えずに止め、照会の途中の予算の超過は後段の打ち切りとして記録する', async () => {
    await registerFixture();
    await setScan(ZIP, 'pending', 0, null);
    await run(mbHandler([], () => new HttpResponse(null, { status: 429 })));
    expect(await scanOf(ZIP)).toMatchObject({ result: 'pending', attempts: 0 });
    // 同じホストへのリダイレクトを続け、照会の途中で予算を使い切る。
    const loop = () =>
      new HttpResponse(null, { status: 302, headers: { Location: 'https://mb-api.abuse.ch/api/v1/' } });
    const report = await run(mbHandler([], loop), new Budget(FINAL_RESERVE + 2, 45));
    expect(report.stoppedBy).toBe('budget_subrequest');
    expect(await scanOf(ZIP)).toMatchObject({ result: 'pending', attempts: 0 });
  });
});
