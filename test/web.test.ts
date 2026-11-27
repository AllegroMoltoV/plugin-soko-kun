// Web の危険側の境界: 外部メタデータによる XSS、検査前のプラグインの公開、スクリプトの許可。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { SUBMIT_ERROR_CODES, submitPlugin } from '../src/domain/submit';
import { PAGES } from '../src/web/content';
import { DICTS, LANGS } from '../src/web/i18n';
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

  // 外部の有料 API を使うだけのプラグインに、作者に払う追加機能があるように見えるタグを付けない (2026-11-19 ai-assistant-for-obs)。
  it('有料のサービスだけを申告したプラグインには、有料の機能のタグを付けない', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare('UPDATE release_checks SET declarations = ?')
      .bind(
        JSON.stringify({
          paidFeatures: false,
          paidServices: ['OpenAI API'],
          restrictedAssets: false,
          supportUrl: null,
          notices: [],
        }),
      )
      .run();
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(html).toContain('外部の有料サービスが必要');
    expect(html).not.toContain('有料の機能あり');
    expect(html).toContain('入手は無料');
  });

  // 無料のものに「入手は無料」と書くと留保に見える (依頼者 2026-11-19)。有料の申告が無ければ「無料」にする。
  it('有料の申告の無いプラグインには「入手は無料」ではなく「無料」を付ける', async () => {
    await register();
    await markListable(env.DB);
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(html).toContain('class="pill">無料<');
    expect(html).not.toContain('入手は無料');
  });

  // OBS のプラグインを作る相談を受けた AI エージェントが、作り方と掲載の条件を一度で読めるようにする (h9p.26)。
  it('/llms.txt に、スキルの導入のコマンドと MCP の接続先を出す', async () => {
    const response = await SELF.fetch(`${ORIGIN}/llms.txt`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('claude plugin install soko-kun-plugin-dev@plugin-soko-kun');
    expect(text).toContain(`${ORIGIN}/mcp`);
  });

  it('トップページの横の欄から /llms.txt へリンクする', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(html).toContain('href="/llms.txt"');
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
    // 利用者がダウンロードボタンを押す前に読めるよう、警告はボタンより上に出す。
    expect(detail.indexOf('Suspended versions')).toBeLessThan(detail.indexOf('class="download"'));
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

  // 拒否された作者が /submit で理由と直し方を確かめられるよう、submit_plugin の理由のコードを 7 言語の一覧にすべて載せる。
  it('作者向けの案内の 7 言語に、submit_plugin のすべての理由のコードがある', () => {
    for (const lang of LANGS) {
      const text = JSON.stringify(PAGES[lang].submit);
      const missing = SUBMIT_ERROR_CODES.filter((code) => !text.includes(code));
      expect(missing, lang).toEqual([]);
    }
  });

  // 作者が登録するかを決める前提の文 (ADR 0018)。作者が意図しない商用利用に後から気づくことを防ぐため、最初の節より前に出す。
  it('登録と掲載方針のページの 7 言語で、作者向けの最重要の文を最初の節より前に出す', async () => {
    for (const lang of LANGS) {
      for (const path of ['/submit', '/policy']) {
        const html = await (await SELF.fetch(`${ORIGIN}${path}?lang=${lang}`)).text();
        const box = html.indexOf('class="author-important"');
        expect(box, `${path} ${lang}`).toBeGreaterThan(-1);
        expect(box, `${path} ${lang}`).toBeLessThan(html.indexOf('<section'));
      }
    }
  });

  // 連絡先を表示したページで言語を切り替えると、言語の一覧のリンクは GET の /contact を指す。
  it('GET の /contact は 404 にせず、アドレスを含まない連絡先のページを返す', async () => {
    const response = await SELF.fetch(`${ORIGIN}/contact?lang=ja`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain('[at]');
    expect(html).toContain('method="post" action="/contact?lang=ja"');
  });
});

// 検索欄の文を利用者自身の AI (Google の AI モード) に渡すボタン (5ig)。倉庫くんは検索をせず、質問の文を組み立てて移るだけ。
describe('Google の AI で探す', () => {
  async function postAiSearch(fields: Record<string, string>, init: RequestInit = {}): Promise<Response> {
    return SELF.fetch(`${ORIGIN}/ai-search`, { method: 'POST', body: new URLSearchParams(fields), ...init });
  }

  // 応答の meta refresh とリンクから、移り先の URL を取り出す。属性の & は &amp; で出る。
  function targetsOf(html: string): { refresh: URL; link: URL } {
    const refresh = html.match(/<meta http-equiv="refresh" content="0;url=([^"]+)"/)?.[1];
    const link = html.match(/<a href="(https:\/\/www\.google\.com\/[^"]+)"/)?.[1];
    if (!refresh || !link) throw new Error('the redirect targets are missing');
    const decode = (value: string) => new URL(value.replaceAll('&amp;', '&'));
    return { refresh: decode(refresh), link: decode(link) };
  }

  it('2 つの検索フォームの両方に、虫眼鏡のボタンより後ろにボタンを置く', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    const forms = html.split('<form').slice(1);
    const searchForms = forms.filter((form) => form.includes('name="q"'));
    expect(searchForms).toHaveLength(2);
    for (const form of searchForms) {
      const button = form.indexOf('formaction="/ai-search"');
      expect(button).toBeGreaterThan(form.indexOf('class="icon-button"'));
      const tag = form.slice(form.lastIndexOf('<button', button), form.indexOf('>', button));
      expect(tag).toContain('formmethod="post"');
      expect(tag).toContain('formtarget="_blank"');
    }
    // 上部の帯だけを持つ固定ページにも、上部の帯のボタンがある
    const about = await (await SELF.fetch(`${ORIGIN}/about?lang=ja`)).text();
    expect(about.split('formaction="/ai-search"')).toHaveLength(2);
  });

  it('7 言語のそれぞれで、ボタンの文言と、その言語の質問の文とカタログの URL で移る', async () => {
    for (const lang of LANGS) {
      const t = DICTS[lang];
      const page = await (await SELF.fetch(`${ORIGIN}/?lang=${lang}`)).text();
      expect(page).toContain(escapeHtml(t.aiSearchButton));
      expect(page).toContain(escapeHtml(t.aiSearchHint));
      const response = await postAiSearch({ lang, q: '  音量 balance  ' });
      expect(response.status).toBe(200);
      const html = await response.text();
      const { refresh, link } = targetsOf(html);
      expect(refresh.href).toBe(link.href);
      expect(refresh.origin + refresh.pathname).toBe('https://www.google.com/search');
      expect(refresh.searchParams.get('udm')).toBe('50');
      expect(refresh.searchParams.get('q')).toBe(t.aiSearchPrompt(`${ORIGIN}/?lang=${lang}`, '音量 balance'));
      expect(html).toContain(escapeHtml(t.aiSearchRedirect));
    }
  });

  // 言語を決めるミドルウェアは本文を読まない。Cookie の無い初回の利用者でも、画面の言語の質問の文にする。
  it('Cookie が無いときも、フォームの lang の言語で質問の文を組み立てる', async () => {
    const response = await postAiSearch({ lang: 'ko', q: 'mosaic' }, { headers: { 'Accept-Language': 'en' } });
    const { refresh } = targetsOf(await response.text());
    expect(refresh.searchParams.get('q')).toBe(DICTS.ko.aiSearchPrompt(`${ORIGIN}/?lang=ko`, 'mosaic'));
  });

  it('入力は 100 文字で切り、空のときは探したいものを尋ねるよう伝える', async () => {
    const long = await postAiSearch({ lang: 'ja', q: 'あ'.repeat(150) });
    expect(targetsOf(await long.text()).refresh.searchParams.get('q')).toBe(
      DICTS.ja.aiSearchPrompt(`${ORIGIN}/?lang=ja`, 'あ'.repeat(100)),
    );
    const empty = await postAiSearch({ lang: 'ja', q: '   ' });
    expect(targetsOf(await empty.text()).refresh.searchParams.get('q')).toBe(
      DICTS.ja.aiSearchPrompt(`${ORIGIN}/?lang=ja`, DICTS.ja.aiSearchEmpty),
    );
  });

  // Google の確認画面が出た質問の URL は 1,911 文字だった。原因は未特定のため、最大の入力での長さを見張る。
  it('最大の長さの入力でも、移り先の URL は 7 言語とも 2,048 文字に収まる', async () => {
    for (const lang of LANGS) {
      const response = await postAiSearch({ lang, q: '漢'.repeat(100) });
      const { refresh } = targetsOf(await response.text());
      expect(refresh.href.length).toBeLessThanOrEqual(2048);
    }
  });

  it('移るための応答は検索エンジンに載せず、キャッシュさせず、CSP を変えない', async () => {
    const response = await postAiSearch({ lang: 'en', q: 'noise' });
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toContain('<meta name="robots" content="noindex"/>');
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain('google');
    expect(csp).not.toContain('script-src');
  });

  it('プライバシーポリシーに、送った文を保存せず Google の AI モードへ渡すことを書く', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/privacy?lang=ja`)).text();
    expect(html).toContain('「Google の AI で探す」のボタンで送った文は、このプラットフォームに保存せず');
  });
});

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
