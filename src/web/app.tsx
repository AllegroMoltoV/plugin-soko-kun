import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie } from 'hono/cookie';
import {
  catalogStats,
  getPluginImage,
  getPluginPreview,
  getPluginView,
  listNotices,
  type PluginView,
  searchPlugins,
} from '../domain/catalog';
import { CATEGORIES, type Category, OS_VALUES, type Os } from '../domain/metadata';
import type { Env } from '../env';
import { AUTHORITATIVE, PAGE_KEYS, PAGES } from './content';
import { DICTS, LANGS, type Lang, negotiate } from './i18n';
import { AiSearchRedirect, ContactButton, Layout, type PageMeta, toJsonLd, websiteJsonLd, withLang } from './layout';
import { LOGO_SVG } from './logo';
import {
  NoticesPage,
  PluginCards,
  PluginDetail,
  SearchForm,
  SideCommon,
  SideRelated,
  StaticPage,
  summaryFor,
} from './pages';
import { STYLE_CSS } from './style';

type AppEnv = { Bindings: Env; Variables: { lang: Lang } };

const app = new Hono<AppEnv>();

// JavaScript を使わない画面のため、スクリプトを一切許可しない。外部メタデータ経由の XSS を二重に防ぐ。
const CSP = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

app.use('*', async (c, next) => {
  const query = c.req.query('lang');
  const fromQuery = LANGS.find((l) => l === query);
  const fromCookie = LANGS.find((l) => l === getCookie(c, 'lang'));
  const lang = fromQuery ?? fromCookie ?? negotiate(c.req.header('Accept-Language') ?? null);
  if (fromQuery && fromQuery !== fromCookie) {
    setCookie(c, 'lang', fromQuery, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
      secure: c.env.ORIGIN.startsWith('https:'),
    });
  }
  c.set('lang', lang);
  await next();
  c.header('Content-Security-Policy', CSP);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Vary', 'Accept-Language, Cookie');
});

function pathWithoutLang(url: string): string {
  const u = new URL(url);
  u.searchParams.delete('lang');
  return `${u.pathname}${u.search}`;
}

// canonical と hreflang には、ページの内容を決めるクエリだけを残す。追跡用などの任意のクエリと ?orig=1 は外す。
const CANONICAL_QUERY = ['category', 'page'];
function canonicalPathOf(url: string): string {
  const u = new URL(url);
  const kept = new URLSearchParams();
  for (const key of CANONICAL_QUERY) {
    const value = u.searchParams.get(key);
    if (value && !(key === 'page' && value === '1')) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${u.pathname}?${query}` : u.pathname;
}

// 検索結果の説明文に使う。改行と連続する空白を 1 つにまとめ、長い概要は切り詰める。
const META_DESCRIPTION_MAX = 160;
function metaDescription(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > META_DESCRIPTION_MAX ? `${flat.slice(0, META_DESCRIPTION_MAX - 1)}…` : flat;
}

// 掲載中のプラグインの詳細ページに出す SoftwareApplication の構造化データ。値の無い項目は出さない。
function softwareJsonLd(origin: string, lang: Lang, view: PluginView, description: string): string {
  const en = DICTS.en;
  const release = view.listedRelease;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: view.name,
    description,
    applicationCategory: 'MultimediaApplication',
    applicationSubCategory: en.categories[view.category],
    softwareRequirements: release?.obsBuildVersion ? `OBS Studio ${release.obsBuildVersion}` : 'OBS Studio',
    license: `https://spdx.org/licenses/${view.license}`,
    url: `${origin}${withLang(`/plugins/${view.id}`, lang)}`,
    author: { '@type': 'Person', name: view.owner, url: `https://github.com/${view.owner}` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  if (view.os.length > 0) data.operatingSystem = view.os.map((os) => en.os[os]).join(', ');
  if (release) {
    data.softwareVersion = release.tag;
    data.downloadUrl = release.htmlUrl;
  }
  if (view.images.logo) data.image = `${origin}/plugins/${view.id}/logo?v=${view.images.logo.sha}`;
  return toJsonLd(data);
}

function meta(
  c: { env: Env; req: { url: string } },
  lang: Lang,
  title: string,
  description: string,
  extra: Partial<PageMeta> = {},
): PageMeta {
  const u = new URL(c.req.url);
  return {
    lang,
    t: DICTS[lang],
    title,
    description,
    path: pathWithoutLang(c.req.url),
    canonicalPath: canonicalPathOf(c.req.url),
    noindex: u.searchParams.has('q') || u.searchParams.has('os'),
    origin: c.env.ORIGIN,
    ...extra,
  };
}

const PAGE_SIZE = 20;

app.get('/style.css', (c) =>
  c.body(STYLE_CSS, 200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }),
);

app.get('/logo.svg', (c) =>
  c.body(LOGO_SVG, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }),
);

app.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /mcp\nSitemap: ${c.env.ORIGIN}/sitemap.xml\n`),
);

// AI エージェント向けの案内 (llms.txt の慣習)。OBS のプラグインを作る相談を受けたエージェントが、
// 作り方・掲載の条件・MCP の接続先を一度で読めるようにする (h9p.26)。本文は固定で、外部データを含めない。
app.get('/llms.txt', (c) => {
  const origin = c.env.ORIGIN;
  const body = `# Plugin Soko-kun

> An independent, unofficial registry of third-party plugins for OBS Studio, designed for AI coding agents. Authors build plugins with Claude Code, publish them on GitHub Releases, and register them over MCP. Users and agents search the catalog on the web or over MCP. Not affiliated with the OBS Project.

## Build and publish an OBS Studio plugin with AI

- Install the Claude Code skill that guides planning, the official template, CI render tests, releases with build provenance attestations, and listing: \`claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\` then \`claude plugin install soko-kun-plugin-dev@plugin-soko-kun\`
- The OBS Forums resource policy (updated July 29, 2026) does not accept resources written entirely or largely with AI coding tools. This registry lists plugins under the same conditions whether or not AI was used.
- When a plugin is listed, anyone can download its files from GitHub for free, and anyone can use and redistribute its code commercially under the conditions of its license (approved by the OSI or certified as free by the FSF). Paid-only distributions without public source are not listed.
- Video walkthrough: https://youtu.be/fHonQmddp7A
- Article: https://allegromoltov.medium.com/build-publish-obs-plugins-with-ai-plugin-soko-kun-ede9c92b7589

## MCP

- Endpoint: ${origin}/mcp (streamable HTTP). Tools: search_plugins and get_plugin without sign-in; submit_plugin and list_my_plugins with GitHub sign-in.
- Claude Code: \`claude mcp add --transport http plugin-soko-kun ${origin}/mcp\`

## Docs

- [Submit a plugin](${origin}/submit?lang=en): listing conditions, declarations in .soko-kun/config.json, and how refusals are fixed
- [Listing policy](${origin}/policy?lang=en)
- [About](${origin}/about?lang=en)
- [Review criteria](https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md) (Japanese)
- [Source code](https://github.com/AllegroMoltoV/plugin-soko-kun)
`;
  return c.body(body, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});

app.get('/sitemap.xml', async (c) => {
  const { items } = await searchPlugins(c.env, { limit: 5000 });
  const paths = [
    '/',
    ...PAGE_KEYS.map((key) => `/${key}`),
    '/notices',
    ...items.map((view) => `/plugins/${view.id}`),
  ].flatMap((path) => LANGS.map((l) => withLang(path, l)));
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `<url><loc>${esc(c.env.ORIGIN + p)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return c.body(body, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});

app.get('/', async (c) => {
  const lang = c.get('lang');
  const t = DICTS[lang];
  const keyword = (c.req.query('q') ?? '').slice(0, 100).trim();
  const os = OS_VALUES.find((v) => v === c.req.query('os')) as Os | undefined;
  const category = CATEGORIES.find((v) => v === c.req.query('category')) as Category | undefined;
  const page = Math.max(1, Math.min(1000, Number.parseInt(c.req.query('page') ?? '1', 10) || 1));
  const result = await searchPlugins(c.env, {
    keyword,
    os,
    category,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const stats = await catalogStats(c.env);
  const filtered = Boolean(keyword || os || category);
  const heading = keyword ? t.resultsFor(keyword, result.total) : category ? t.categories[category] : t.latest;
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const pageLink = (n: number) => {
    const u = new URL(c.req.url);
    u.searchParams.set('page', String(n));
    u.searchParams.set('lang', lang);
    return `${u.pathname}${u.search}`;
  };
  return c.html(
    <Layout
      meta={meta(c, lang, filtered ? heading : t.searchHeading, t.siteDescription, {
        keyword,
        currentCategory: category,
        jsonLd: !filtered && page === 1 ? websiteJsonLd(c.env.ORIGIN) : undefined,
      })}
      side={
        <SideCommon
          t={t}
          lang={lang}
          listed={stats.listed}
          lastSyncedAt={stats.lastSyncedAt}
          latest={stats.latest}
          weekly={stats.weekly}
          collapsible={false}
        />
      }
      sideNarrow={
        <SideCommon
          t={t}
          lang={lang}
          listed={stats.listed}
          lastSyncedAt={stats.lastSyncedAt}
          latest={stats.latest}
          weekly={stats.weekly}
          collapsible={true}
        />
      }
    >
      <h1>{t.searchHeading}</h1>
      <SearchForm t={t} lang={lang} keyword={keyword} os={os} category={category} categories={CATEGORIES} />
      <h2 class="bar">{filtered && !keyword ? `${heading} - ${t.results(result.total)}` : heading}</h2>
      <PluginCards items={result.items} t={t} lang={lang} />
      {pages > 1 ? (
        <nav class="pager" aria-label="pagination">
          {page > 1 ? <a href={pageLink(page - 1)}>{t.prev}</a> : <span />}
          <span>
            {page} / {pages}
          </span>
          {page < pages ? <a href={pageLink(page + 1)}>{t.next}</a> : <span />}
        </nav>
      ) : null}
    </Layout>,
  );
});

// 画像は掲載中のプラグインのものだけを配信する。形式は保存の前に先頭のバイト列で確かめている。
for (const kind of ['logo', 'image', 'preview'] as const) {
  app.get(`/plugins/:owner/:repo/${kind}`, async (c) => {
    const id = `${c.req.param('owner')}/${c.req.param('repo')}`;
    const image = kind === 'preview' ? await getPluginPreview(c.env, id) : await getPluginImage(c.env, id, kind);
    if (!image) return c.notFound();
    return c.body(image.bytes, 200, {
      'Content-Type': image.contentType,
      'Content-Disposition': 'inline',
      // URL のクエリに blob の SHA を付けるため、画像が変われば別の URL になる。
      'Cache-Control': 'public, max-age=86400',
    });
  });
}

app.get('/plugins/:owner/:repo', async (c) => {
  const lang = c.get('lang');
  const t = DICTS[lang];
  const id = `${c.req.param('owner')}/${c.req.param('repo')}`;
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(id)) return c.notFound();
  const view = await getPluginView(c.env, id);
  // 検査待ちのプラグインは、エンドユーザーに分かりにくい状態を見せないよう、未登録と同じ 404 にする。
  if (!view || view.status === 'pending') return c.notFound();
  // 名前を変える前の URL は、新しい URL へ転送する。
  if (view.id !== id.toLowerCase()) return c.redirect(withLang(`/plugins/${view.id}`, lang), 301);
  const stats = await catalogStats(c.env);
  const related =
    view.status === 'listed' ? (await searchPlugins(c.env, { limit: 200 })).items.filter((v) => v.id !== view.id) : [];
  const sameAuthor = related.filter((v) => v.owner.toLowerCase() === view.owner.toLowerCase()).slice(0, 5);
  const sameCategory = related.filter((v) => v.category === view.category && !sameAuthor.includes(v)).slice(0, 5);
  // 掲載中以外のプラグインでは、外部データの概要を検索エンジン向けの説明にも出さない。
  const description = metaDescription(
    (view.status === 'listed' ? summaryFor(view, lang, false)?.text : null) ?? t.notice,
  );
  const response = c.html(
    <Layout
      meta={meta(c, lang, `${view.name} - ${t.pluginTitleSuffix}`, description, {
        jsonLd: view.status === 'listed' ? softwareJsonLd(c.env.ORIGIN, lang, view, description) : undefined,
        currentCategory: view.category,
        // URL の大文字と小文字の違いで重複しないよう、サイトマップと同じ小文字の ID にそろえる。
        canonicalPath: `/plugins/${view.id}`,
        // ロゴがあるプラグインは、共有のときにプラグインのロゴを出す。
        ogImage:
          view.status === 'listed' && view.images.logo
            ? {
                url: `${c.env.ORIGIN}/plugins/${view.id}/logo?v=${view.images.logo.sha}`,
                card: 'summary',
              }
            : undefined,
      })}
      side={
        <>
          <SideRelated t={t} lang={lang} sameAuthor={sameAuthor} sameCategory={sameCategory} collapsible={false} />
          <SideCommon
            t={t}
            lang={lang}
            listed={stats.listed}
            lastSyncedAt={stats.lastSyncedAt}
            latest={stats.latest}
            weekly={stats.weekly}
            collapsible={false}
          />
        </>
      }
      sideNarrow={
        <>
          <SideRelated t={t} lang={lang} sameAuthor={sameAuthor} sameCategory={sameCategory} collapsible={true} />
          <SideCommon
            t={t}
            lang={lang}
            listed={stats.listed}
            lastSyncedAt={stats.lastSyncedAt}
            latest={stats.latest}
            weekly={stats.weekly}
            collapsible={true}
          />
        </>
      }
    >
      <PluginDetail view={view} t={t} lang={lang} showOriginal={c.req.query('orig') === '1'} />
    </Layout>,
  );
  // 掲載中でないプラグインの詳細は検索エンジンに載せない。
  if (view.status !== 'listed') c.header('X-Robots-Tag', 'noindex');
  return response;
});

app.get('/notices', async (c) => {
  const lang = c.get('lang');
  const t = DICTS[lang];
  const [items, stats] = await Promise.all([listNotices(c.env), catalogStats(c.env)]);
  const side = (collapsible: boolean) => (
    <SideCommon
      t={t}
      lang={lang}
      listed={stats.listed}
      lastSyncedAt={stats.lastSyncedAt}
      latest={stats.latest}
      weekly={stats.weekly}
      collapsible={collapsible}
    />
  );
  return c.html(
    <Layout meta={meta(c, lang, t.noticesTitle, t.noticesIntro)} side={side(false)} sideNarrow={side(true)}>
      <NoticesPage items={items} t={t} lang={lang} />
    </Layout>,
  );
});

for (const key of PAGE_KEYS) {
  app.get(`/${key}`, async (c) => {
    const lang = c.get('lang');
    const t = DICTS[lang];
    const content = PAGES[lang][key];
    const stats = await catalogStats(c.env);
    return c.html(
      <Layout
        meta={meta(
          c,
          lang,
          content.title,
          (content.sections[0]?.paragraphs.find((b): b is string => typeof b === 'string') ?? t.notice).replaceAll(
            '{{ORIGIN}}',
            c.env.ORIGIN,
          ),
        )}
        side={
          <SideCommon
            t={t}
            lang={lang}
            listed={stats.listed}
            lastSyncedAt={stats.lastSyncedAt}
            latest={stats.latest}
            weekly={stats.weekly}
            collapsible={false}
          />
        }
        sideNarrow={
          <SideCommon
            t={t}
            lang={lang}
            listed={stats.listed}
            lastSyncedAt={stats.lastSyncedAt}
            latest={stats.latest}
            weekly={stats.weekly}
            collapsible={true}
          />
        }
      >
        <StaticPage
          content={content}
          t={t}
          lang={lang}
          path={`/${key}`}
          anchorMcp={key === 'about'}
          origin={c.env.ORIGIN}
          authoritative={AUTHORITATIVE[key]}
          authorImportant={key === 'submit' || key === 'policy'}
        />
      </Layout>,
    );
  });
}

// 検索欄の文を、利用者自身の AI (Google の AI モード) に渡す (5ig)。倉庫くんは検索をせず、質問の文を組み立てて移るだけ。
// POST にするのは、Google に送る文を倉庫くんの URL に重ねて残さないため。入力は保存しない。
// 言語を決めるミドルウェアは本文を読まないため、フォームの hidden の lang をここで優先する。
// 入力の上限は検索欄の maxlength と同じ 100 文字 (UTF-16 の単位)。
export const AI_SEARCH_MAX_INPUT = 100;

export function aiSearchUrl(prompt: string): string {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(prompt)}`;
}

// フォームの送信 (application/x-www-form-urlencoded) だけを受け、本文は検索欄の上限に余裕を持たせた 4 KB までにする。
// 大きな本文や multipart をメモリに展開しないため。
const AI_SEARCH_MAX_BODY = 4 * 1024;

app.post(
  '/ai-search',
  bodyLimit({ maxSize: AI_SEARCH_MAX_BODY, onError: (c) => c.text('Payload Too Large', 413) }),
  async (c) => {
    if (!(c.req.header('Content-Type') ?? '').startsWith('application/x-www-form-urlencoded')) {
      return c.text('Unsupported Media Type', 415);
    }
    const body = await c.req.parseBody();
    const fromBody = typeof body.lang === 'string' ? LANGS.find((l) => l === body.lang) : undefined;
    const lang = fromBody ?? c.get('lang');
    const t = DICTS[lang];
    // 100 単位目で切ると絵文字などのサロゲートペアが割れ、encodeURIComponent が例外を投げるため、末尾の片割れを落とす。
    const input =
      typeof body.q === 'string'
        ? body.q
            .trim()
            .slice(0, AI_SEARCH_MAX_INPUT)
            .replace(/[\uD800-\uDBFF]$/, '')
        : '';
    const catalogUrl = `${c.env.ORIGIN}${withLang('/', lang)}`;
    const target = aiSearchUrl(t.aiSearchPrompt(catalogUrl, input || t.aiSearchEmpty));
    c.header('X-Robots-Tag', 'noindex');
    c.header('Cache-Control', 'no-store');
    return c.html(<AiSearchRedirect t={t} lang={lang} target={target} />);
  },
);

// 収集を防ぐため、アドレスはフォームの送信 (POST) を受けたときだけ、@ を [at] に置き換えて返す。
// GET は、アドレスを表示したページで言語を切り替えたときに来る。アドレスは返さず、選んだ言語のボタンを返す。
app.post('/contact', (c) => contactPage(c, true));
app.get('/contact', (c) => contactPage(c, false));

async function contactPage(c: Context<AppEnv>, reveal: boolean) {
  const lang = c.get('lang');
  const t = DICTS[lang];
  const stats = await catalogStats(c.env);
  const address = c.env.CONTACT_EMAIL?.replace('@', ' [at] ');
  c.header('X-Robots-Tag', 'noindex');
  c.header('Cache-Control', 'no-store');
  return c.html(
    <Layout
      meta={meta(c, lang, t.contactLabel, t.contactLabel)}
      side={
        <SideCommon
          t={t}
          lang={lang}
          listed={stats.listed}
          lastSyncedAt={stats.lastSyncedAt}
          latest={stats.latest}
          weekly={stats.weekly}
          collapsible={false}
        />
      }
      sideNarrow={
        <SideCommon
          t={t}
          lang={lang}
          listed={stats.listed}
          lastSyncedAt={stats.lastSyncedAt}
          latest={stats.latest}
          weekly={stats.weekly}
          collapsible={true}
        />
      }
    >
      <h1>{t.contactLabel}</h1>
      {!address ? (
        <p>{t.contactUnavailable}</p>
      ) : reveal ? (
        <>
          <p class="contact-address">{address}</p>
          <p>{t.contactHint}</p>
        </>
      ) : (
        <ContactButton t={t} lang={lang} />
      )}
    </Layout>,
  );
}

app.notFound((c) => {
  const lang = (c.get('lang') as Lang | undefined) ?? 'ja';
  return c.text(DICTS[lang].notFound, 404);
});

export function handleWeb(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
  return app.fetch(request, env, ctx);
}
