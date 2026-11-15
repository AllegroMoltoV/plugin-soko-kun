// list_my_plugins の危険側の境界: 管理者でない人に、確認待ちの版や理由やレビューの指摘を返さない。
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { listMyPlugins, resumeOf, versionState } from '../../src/domain/author';
import { submitPlugin } from '../../src/domain/submit';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const url = `https://github.com/${OWNER}/${REPO}`;

async function register(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(env, { githubUserId: 4242, githubToken: USER_TOKEN }, url);
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
}

describe('listMyPlugins', () => {
  it('登録者でも、いま管理者でなければ返さない', async () => {
    await register();
    network.use(...githubHandlers({ admin: false }));
    const result = await listMyPlugins(
      env,
      { githubUserId: 4242, githubLogin: 'someone-else', githubToken: USER_TOKEN },
      {},
    );
    expect(result).toMatchObject({ plugins: [] });
  });

  it('所有者でも登録者でもない人には、候補にも入れない', async () => {
    await register();
    const calls: string[] = [];
    network.use(...githubHandlers({}, calls));
    const result = await listMyPlugins(
      env,
      { githubUserId: 9999, githubLogin: 'stranger', githubToken: USER_TOKEN },
      { pluginId: `${OWNER}/${REPO}` },
    );
    expect(result).toMatchObject({ plugins: [] });
    expect(calls).toEqual([]);
  });

  it('管理者には、確認待ちの版と理由を返す', async () => {
    await register();
    network.use(...githubHandlers());
    const result = await listMyPlugins(env, { githubUserId: 4242, githubLogin: OWNER, githubToken: USER_TOKEN }, {});
    const plugin = (result as { plugins: Array<{ versions: Array<{ state: string; blockers: unknown[] }> }> })
      .plugins[0];
    expect(plugin?.versions[0]?.state).toBe('checking');
    expect(plugin?.versions[0]?.blockers.length).toBeGreaterThan(0);
  });
});

describe('versionState', () => {
  it('作者が直す理由があれば、管理者の確認待ちより先に rejected にする', () => {
    expect(versionState(false, false, ['diff_held', 'not_immutable'])).toBe('rejected');
    expect(versionState(false, false, ['diff_held', 'scan_pending'])).toBe('held');
    expect(versionState(false, true, [])).toBe('suspended');
  });
});

// 呼ぶたびに時刻が後ろへ動くと、作者のエージェントが「検査が延びた」と誤って説明する。
describe('resumeOf', () => {
  const published = '2026-11-15T00:00:00.000Z';
  const at = (iso: string) => Date.parse(iso);

  it('上限の前は、呼ぶ時刻によらず版の公開から決まる同じ時刻を返す', () => {
    const first = resumeOf('scan_pending', null, published, at('2026-11-15T00:05:00Z'));
    const second = resumeOf('scan_pending', null, published, at('2026-11-15T00:20:00Z'));
    expect(first).toBe('2026-11-15T00:30:00.000Z');
    expect(second).toBe(first);
  });

  it('通信の検出を待つレビューは、公開から 6 時間の待ちを含む上限を返す', () => {
    expect(resumeOf('review_pending', null, published, at('2026-11-15T01:00:00Z'))).toBe('2026-11-15T06:30:00.000Z');
  });

  it('上限を過ぎて終わらないときだけ、次の定期処理の区切りの 15 分後を返し、同じ区切りの間は同じ時刻にする', () => {
    const a = resumeOf('scan_pending', null, published, at('2026-11-15T01:02:00Z'));
    const b = resumeOf('scan_pending', null, published, at('2026-11-15T01:14:00Z'));
    expect(a).toBe('2026-11-15T01:30:00.000Z');
    expect(b).toBe(a);
  });

  it('支出の上限などで待つときは、その時刻を返す', () => {
    expect(resumeOf('review_pending', '2026-11-15T03:00:00.000Z', published, at('2026-11-15T02:00:00Z'))).toBe(
      '2026-11-15T03:00:00.000Z',
    );
  });
});
