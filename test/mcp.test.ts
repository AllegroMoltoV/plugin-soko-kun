// アクセス権限の境界を、経路・利用者の種別・期待する結果の表で確かめる (software-test スキル)。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { submitPlugin } from '../src/domain/submit';
import { markListable } from './fixtures/checks';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from './fixtures/github';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';

function toolCall(name: string, args: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
}

async function toolResult(response: Response): Promise<{ isError?: boolean; payload: Record<string, unknown> }> {
  const text = await response.text();
  const line = text.split('\n').find((l) => l.startsWith('data:')) ?? text;
  const message = JSON.parse(line.replace(/^data:\s*/, '')) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  return { isError: message.result.isError, payload: JSON.parse(message.result.content[0]?.text ?? '{}') };
}

async function registerPendingFixture(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
}

describe('アクセス権限', () => {
  it.each([
    [
      '未サインインで submit_plugin を呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }),
      401,
    ],
    [
      '偽のトークンで submit_plugin を呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }, { Authorization: 'Bearer x:y:z' }),
      401,
    ],
    [
      'Mcp-Name に search_plugins を付け、本文で submit_plugin を呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }, { 'Mcp-Name': 'search_plugins' }),
      400,
    ],
  ])('%s → %i', async (_label, request, expected) => {
    const response = await SELF.fetch(request);
    expect(response.status).toBe(expected);
    if (expected === 401) {
      expect(response.headers.get('WWW-Authenticate')).toContain(
        `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
      );
    }
  });

  it('検索結果に検査待ちのプラグインを含めない', async () => {
    await registerPendingFixture();
    const { payload } = await toolResult(await SELF.fetch(toolCall('search_plugins', { keyword: 'pitch' })));
    expect(payload.total).toBe(0);
  });

  it('検査待ちのプラグインは未登録と同じ not_found にし、ダウンロード URL も状態も返さない', async () => {
    await registerPendingFixture();
    const response = await SELF.fetch(toolCall('get_plugin', { id: `${OWNER}/${REPO}` }));
    const text = JSON.stringify((await toolResult(response)).payload);
    expect(text).toContain('"error":"not_found"');
    expect(text).not.toContain('releases/download');
    expect(text).not.toContain('pending');
  });

  it('検査を通ったプラグインは検索でき、外部データは untrusted に入る', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    const { payload } = await toolResult(
      await SELF.fetch(toolCall('search_plugins', { keyword: 'pitch shift', os: 'windows' })),
    );
    expect(payload.total).toBe(1);
    const [item] = payload.plugins as Array<{ untrusted: { summary: string } }>;
    expect(item?.untrusted.summary).toContain('pitch shift');
  });

  it('概要の機械翻訳の語でも検索できる', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    await env.DB.prepare(
      "INSERT INTO plugin_translations (plugin_id, lang, source_hash, text, translated_at) SELECT id, 'ja', 'x', '声の高さを変える音声フィルター', '2026-11-10T00:00:00Z' FROM plugins",
    ).run();
    const { payload } = await toolResult(await SELF.fetch(toolCall('search_plugins', { keyword: '声の高さ' })));
    expect(payload.total).toBe(1);
  });

  it('管理者が停止したプラグインは検索結果から消える', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    const { payload } = await toolResult(await SELF.fetch(toolCall('search_plugins', {})));
    expect(payload.total).toBe(0);
  });
});
