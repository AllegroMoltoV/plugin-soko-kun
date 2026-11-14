// Web の危険側の境界: 外部メタデータによる XSS、検査前のプラグインの公開、スクリプトの許可。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { submitPlugin } from '../src/domain/submit';
import { markListable } from './fixtures/checks';
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
    await markListable(env.DB);
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
    expect(detail.status).toBe(404);
    expect(await detail.text()).not.toContain('releases/download');
  });

  it('名前を変える前の URL は新しい URL へ 301 で転送する', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE plugins SET repo = 'fixture-pitchshift'").run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at) VALUES (?, (SELECT id FROM plugins), '2026-11-13T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`)
      .run();
    const response = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toContain(`/plugins/${OWNER}/fixture-pitchshift`);
  });

  // 旧い名前に別のプラグインができても、旧い URL は元のプラグインに向ける (ADR 0015)。
  it('旧い URL は、同じ名前の別のプラグインより、名前を変えた元のプラグインに向ける', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE plugins SET repo = 'fixture-pitchshift'").run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at) VALUES (?, (SELECT id FROM plugins), '2026-11-13T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase())
      .run();
    // 旧い名前を使う別のプラグイン (この修正の前に登録できた場合を想定)。
    await env.DB.prepare(
      `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
       VALUES ('attacker/x', 777, ?, ?, 'MIT', 2, '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z')`,
    )
      .bind(OWNER, REPO)
      .run();
    const response = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toContain(`/plugins/${OWNER}/fixture-pitchshift`);
  });

  // 画像の表は内部の ID (名前を変える前の owner/repo) で引く。URL の ID で引くと、名前を変えたプラグインの画像が 404 になる。
  it('名前を変えたプラグインの画像を、新しい URL で配信する', async () => {
    await register();
    await markListable(env.DB);
    const internalId = `${OWNER}/${REPO}`.toLowerCase();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'logo', 'x', 'image/png', 64, 64, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(internalId, png(64, 64))
      .run();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'image', 'g1', 'image/gif', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(internalId, new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x80, 0x02, 0x68, 0x01]))
      .run();
    await env.DB.prepare(
      "INSERT INTO plugin_image_previews (plugin_id, source_sha, width, height, bytes, made_at) VALUES (?, 'g1', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(internalId, new Uint8Array([1]))
      .run();
    await env.DB.prepare("UPDATE plugins SET repo = 'fixture-pitchshift'").run();

    for (const kind of ['logo', 'image', 'preview']) {
      const response = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/fixture-pitchshift/${kind}`);
      expect(response.status, kind).toBe(200);
      await response.arrayBuffer();
    }
  });

  it('止めた版は、詳細ページと告知ページに警告として出し、告知の文はエスケープする', async () => {
    await register();
    await markListable(env.DB);
    // 掲載中の版より前の版を止めた状態を作る。
    await env.DB.prepare(
      "INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url) SELECT 1, plugin_id, 'v0.9.0', NULL, 'x', '2026-01-01T00:00:00Z', 'https://example.invalid' FROM releases",
    ).run();
    await env.DB.prepare(
      "INSERT INTO release_suspensions (plugin_id, github_release_id, tag, reason, note, suspended_at) SELECT id, 1, 'v0.9.0', 'admin', 'Delete <b>it</b>', '2026-11-13T00:00:00Z' FROM plugins",
    ).run();
    const notices = await (await SELF.fetch(`${ORIGIN}/notices?lang=en`)).text();
    expect(notices).toContain('v0.9.0');
    expect(notices).toContain('Delete &lt;b&gt;it&lt;/b&gt;');
    const detail = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
    expect(detail).toContain('Suspended versions');
    expect(detail).toContain('releases/download');
  });

  it('機械翻訳した概要に含まれる script もエスケープする', async () => {
    await register();
    await markListable(env.DB);
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

    await markListable(env.DB);
    const listed = await SELF.fetch(url);
    expect(listed.status).toBe(200);
    expect(listed.headers.get('Content-Type')).toBe('image/png');
    expect(listed.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await listed.arrayBuffer();

    await env.DB.prepare('UPDATE plugins SET images_hidden = 1').run();
    expect((await SELF.fetch(url)).status).toBe(404);
  });

  // 閉じた details の中の img は loading="lazy" のときだけ読み込まれない。外れると、開く前に GIF を読み込んで重くなる。
  it('説明の GIF は閉じた details の中に loading="lazy" で置き、表示用の静止画を先に見せる', async () => {
    await register();
    await markListable(env.DB);
    const id = `${OWNER}/${REPO}`.toLowerCase();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'image', 'g1', 'image/gif', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(id, new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x80, 0x02, 0x68, 0x01]))
      .run();
    const page = async () => (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=ja`)).text();

    const before = await page();
    expect(before).toMatch(/<details class="shot anim"><summary><svg class="placeholder"/);
    expect(before).toMatch(/<img src="\/plugins\/[^"]+\/image\?v=g1"[^>]*loading="lazy"/);

    await env.DB.prepare(
      "INSERT INTO plugin_image_previews (plugin_id, source_sha, width, height, bytes, made_at) VALUES (?, 'g1', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(id, new Uint8Array([1]))
      .run();
    const after = await page();
    expect(after).toMatch(/<summary><img src="\/plugins\/[^"]+\/preview\?v=g1"/);
    expect(after).toMatch(/<img src="\/plugins\/[^"]+\/image\?v=g1"[^>]*loading="lazy"/);
  });

  it('週間 DL 数ランキングは 7 日以上前の記録がたまるまで右の列に出さない', async () => {
    await register();
    await markListable(env.DB);
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
