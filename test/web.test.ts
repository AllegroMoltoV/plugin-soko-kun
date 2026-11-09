// Web の危険側の境界: 外部メタデータによる XSS、検査前のプラグインの公開、スクリプトの許可。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { submitPlugin } from '../src/domain/submit';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from './fixtures/github';
import { png } from './fixtures/images';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';

async function register(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
}

describe('Web', () => {
  it('GitHub の説明文に含まれる script をエスケープして表示する', async () => {
    await register();
    await env.DB.prepare("UPDATE scans SET result = 'not_found'").run();
    const html = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('スクリプトを許可しない CSP を付ける', async () => {
    const response = await SELF.fetch(`${ORIGIN}/?lang=en`);
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('script-src');
  });

  it('検査待ちのプラグインを一覧に出さず、詳細にもダウンロードの案内を出さない', async () => {
    await register();
    const list = await (await SELF.fetch(`${ORIGIN}/?lang=en`)).text();
    expect(list).not.toContain(`/plugins/${OWNER}/${REPO}`);
    const detail = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`);
    const html = await detail.text();
    expect(html).not.toContain('releases/download');
    expect(detail.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('機械翻訳した概要に含まれる script もエスケープする', async () => {
    await register();
    await env.DB.prepare("UPDATE scans SET result = 'not_found'").run();
    await env.DB.prepare(
      "INSERT INTO plugin_translations (plugin_id, lang, source_hash, text, translated_at) VALUES (?, 'ja', 'x', '訳\u003cscript>alert(2)\u003c/script>', '2026-11-09T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase())
      .run();
    const html = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=ja`)).text();
    expect(html).toContain('訳&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(2)</script>');
    // 詳細ページの構造化データにも概要が入るため、< を置き換えて script の外へ出さない。
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain('訳\\u003cscript>alert(2)\\u003c/script>');
  });

  it('連絡先のアドレスをページに書かず、フォームの送信を受けたときだけ [at] の形で返す', async () => {
    for (const path of ['/', '/report', '/terms', '/privacy', '/contact']) {
      const html = await (await SELF.fetch(`${ORIGIN}${path}?lang=ja`)).text();
      expect(html).not.toContain('soko-kun.example');
    }
    const response = await SELF.fetch(`${ORIGIN}/contact?lang=ja`, { method: 'POST' });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('allegromoltov [at] soko-kun.example');
    expect(html).not.toContain('allegromoltov@soko-kun.example');
  });

  it('画像は掲載中で、非表示にしていないプラグインのものだけを配信する', async () => {
    await register();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'logo', 'x', 'image/png', 64, 64, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase(), png(64, 64))
      .run();
    const url = `${ORIGIN}/plugins/${OWNER}/${REPO}/logo`;
    expect((await SELF.fetch(url)).status).toBe(404);

    await env.DB.prepare("UPDATE scans SET result = 'not_found'").run();
    const listed = await SELF.fetch(url);
    expect(listed.status).toBe(200);
    expect(listed.headers.get('Content-Type')).toBe('image/png');
    expect(listed.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await listed.arrayBuffer();

    await env.DB.prepare('UPDATE plugins SET images_hidden = 1').run();
    expect((await SELF.fetch(url)).status).toBe(404);
  });

  it('週間 DL 数ランキングは 7 日以上前の記録がたまるまで右の列に出さない', async () => {
    await register();
    await env.DB.prepare("UPDATE scans SET result = 'not_found'").run();
    const id = `${OWNER}/${REPO}`.toLowerCase();
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const insert = (offset: number, total: number) =>
      env.DB.prepare('INSERT INTO download_snapshots (plugin_id, day, total) VALUES (?, ?, ?)')
        .bind(id, day(offset), total)
        .run();
    await insert(6, 100);
    await insert(0, 140);
    expect(await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text()).not.toContain('週間 DL 数ランキング 5 件');

    await insert(7, 90);
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(html).toContain('週間 DL 数ランキング 5 件');
    expect(html).toMatch(/<ol class="weekly">.*?50<\/span>/s);
  });

  it('canonical は lang と category と page だけを残し、検索語のページは noindex にする', async () => {
    const top = await (await SELF.fetch(`${ORIGIN}/?lang=en&utm_source=x&category=audio-filter`)).text();
    expect(top).toContain(`<link rel="canonical" href="${ORIGIN}/?category=audio-filter&amp;lang=en"/>`);
    expect(top).not.toContain('<meta name="robots" content="noindex"/>');
    const search = await (await SELF.fetch(`${ORIGIN}/?lang=en&q=pitch`)).text();
    expect(search).toContain('<meta name="robots" content="noindex"/>');
  });
});
