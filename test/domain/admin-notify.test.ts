// 管理者の確認待ちの通知の境界。危険側は、確認待ちに気づけないこと (送信の失敗や一覧の取れない回で通知が失われる) と、
// タグやリポジトリの名前から @everyone などの通知が飛ぶこと。同じ確認待ちが繰り返し届くと、通知が読まれなくなる。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { notifyAdmin } from '../../src/domain/admin-notify';
import { submitPlugin } from '../../src/domain/submit';
import { markListable } from '../fixtures/checks';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const WEBHOOK = 'https://discord.com/api/webhooks/123/token-for-test';
const withWebhook = { ...env, DISCORD_WEBHOOK_URL: WEBHOOK };

async function registerHeld(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
  await markListable(env.DB);
  await env.DB.prepare("UPDATE release_checks SET diff_state = 'held'").run();
}

function discord(status = 200) {
  const requests: Array<{ url: string; body: { content: string; allowed_mentions: unknown } }> = [];
  network.use(
    http.post('https://discord.com/api/webhooks/123/token-for-test', async ({ request }) => {
      requests.push({ url: request.url, body: (await request.json()) as never });
      return status === 200 ? HttpResponse.json({ id: '1' }) : new HttpResponse(null, { status });
    }),
  );
  return requests;
}

const keys = async () =>
  (await env.DB.prepare('SELECT key FROM admin_notifications ORDER BY key').all<{ key: string }>()).results.map(
    (row) => row.key,
  );

describe('管理者の確認待ちの通知', () => {
  it('確認待ちを 1 回だけ送り、保存を確かめる wait と、メンションを止める指定を付ける', async () => {
    await registerHeld();
    const requests = discord();
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('sent');
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('skipped_none');
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? '').searchParams.get('wait')).toBe('true');
    expect(requests[0]?.body.allowed_mentions).toEqual({ parse: [] });
    expect(requests[0]?.body.content).toContain('diff_held');
  });

  it('送信に失敗したら記録せず、次の起動で送り直す', async () => {
    await registerHeld();
    discord(500);
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('failed_500');
    expect(await keys()).toEqual([]);
    network.resetHandlers();
    const requests = discord();
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('sent');
    expect(requests).toHaveLength(1);
  });

  it('確認待ちが解けたら記録を消し、同じ理由で確認待ちに戻ったら送り直す', async () => {
    await registerHeld();
    const requests = discord();
    await notifyAdmin(withWebhook, new Budget());
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('skipped_none');
    expect(await keys()).toEqual([]);
    await env.DB.prepare('UPDATE release_checks SET admin_approved_at = NULL').run();
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('sent');
    expect(requests).toHaveLength(2);
  });

  it('予算が足りず一覧を求められない回は、記録を消さず送らない', async () => {
    await registerHeld();
    await env.DB.prepare("INSERT INTO admin_notifications VALUES ('r:1:diff_held', '2026-11-15T00:00:00Z')").run();
    const requests = discord();
    expect(await notifyAdmin(withWebhook, new Budget(45, 2))).toBe('skipped_budget');
    expect(await keys()).toEqual(['r:1:diff_held']);
    expect(requests).toHaveLength(0);
  });

  it('README の照合による確認待ちは、版の数に関係なくプラグインの単位で 1 件にする', async () => {
    await registerHeld();
    await env.DB.prepare("UPDATE release_checks SET diff_state = 'passed'").run();
    await env.DB.prepare(
      "INSERT INTO releases (github_release_id, plugin_id, tag, commit_sha, published_at, html_url) SELECT 9901, plugin_id, 'v0.9.0', 'abc', '2026-01-01T00:00:00Z', 'https://example.invalid' FROM releases LIMIT 1",
    ).run();
    await env.DB.prepare('UPDATE plugins SET readme_held = 1').run();
    discord();
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('sent');
    expect(await keys()).toEqual([expect.stringMatching(/^p:.+:readme_held$/)]);
  });

  it('管理者が止めた版と、URL の無い環境では送らない', async () => {
    await registerHeld();
    await env.DB.prepare(
      "INSERT INTO release_suspensions (plugin_id, github_release_id, tag, reason, suspended_at) SELECT plugin_id, github_release_id, tag, 'admin', '2026-11-15T00:00:00Z' FROM releases",
    ).run();
    const requests = discord();
    expect(await notifyAdmin(withWebhook, new Budget())).toBe('skipped_none');
    expect(await notifyAdmin(env, new Budget())).toBe('skipped_no_url');
    expect(requests).toHaveLength(0);
  });
});
