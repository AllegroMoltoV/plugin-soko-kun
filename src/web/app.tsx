import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { catalogStats, getPluginView, searchPlugins } from '../domain/catalog';
import { CATEGORIES, type Category, OS_VALUES, type Os } from '../domain/metadata';
import type { Env } from '../env';
import { PAGES, type PageKey } from './content';
import { DICTS, LANGS, type Lang, negotiate } from './i18n';
import { Layout, type PageMeta } from './layout';
import { PluginCards, PluginDetail, SearchForm, SideCommon, SideRelated, StaticPage } from './pages';
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

function meta(
  c: { env: Env; req: { url: string } },
  lang: Lang,
  title: string,
  description: string,
  extra: Partial<PageMeta> = {},
): PageMeta {
  return { lang, t: DICTS[lang], title, description, path: pathWithoutLang(c.req.url), origin: c.env.ORIGIN, ...extra };
}

const PAGE_SIZE = 20;

app.get('/style.css', (c) =>
  c.body(STYLE_CSS, 200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }),
);

app.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /mcp\nSitemap: ${c.env.ORIGIN}/sitemap.xml\n`),
);

app.get('/sitemap.xml', async (c) => {
  const { items } = await searchPlugins(c.env, { limit: 5000 });
  const paths = [
    '/',
    '/about',
    '/submit',
    '/security',
    '/report',
    '/privacy',
    ...items.map((view) => `/plugins/${view.id}`),
  ];
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
      meta={meta(c, lang, filtered ? heading : t.searchHeading, t.notice, { keyword, currentCategory: category })}
      side={
        <SideCommon t={t} lang={lang} listed={stats.listed} lastSyncedAt={stats.lastSyncedAt} latest={stats.latest} />
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

app.get('/plugins/:owner/:repo', async (c) => {
  const lang = c.get('lang');
  const t = DICTS[lang];
  const id = `${c.req.param('owner')}/${c.req.param('repo')}`;
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(id)) return c.notFound();
  const view = await getPluginView(c.env, id);
  if (!view) return c.notFound();
  const stats = await catalogStats(c.env);
  const related =
    view.status === 'listed' ? (await searchPlugins(c.env, { limit: 200 })).items.filter((v) => v.id !== view.id) : [];
  const sameAuthor = related.filter((v) => v.owner.toLowerCase() === view.owner.toLowerCase()).slice(0, 5);
  const sameCategory = related.filter((v) => v.category === view.category && !sameAuthor.includes(v)).slice(0, 5);
  const response = c.html(
    <Layout
      meta={meta(c, lang, view.repo, view.summary ?? t.notice, { currentCategory: view.category })}
      side={
        <>
          <SideRelated t={t} lang={lang} sameAuthor={sameAuthor} sameCategory={sameCategory} />
          <SideCommon t={t} lang={lang} listed={stats.listed} lastSyncedAt={stats.lastSyncedAt} latest={stats.latest} />
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

for (const key of ['about', 'submit', 'security', 'report', 'privacy'] as const satisfies readonly PageKey[]) {
  app.get(`/${key}`, async (c) => {
    const lang = c.get('lang');
    const t = DICTS[lang];
    const content = PAGES[lang][key];
    const stats = await catalogStats(c.env);
    return c.html(
      <Layout
        meta={meta(c, lang, content.title, content.sections[0]?.paragraphs[0] ?? t.notice)}
        side={
          <SideCommon t={t} lang={lang} listed={stats.listed} lastSyncedAt={stats.lastSyncedAt} latest={stats.latest} />
        }
      >
        <StaticPage
          content={content}
          t={t}
          lang={lang}
          path={`/${key}`}
          anchorMcp={key === 'about'}
          origin={c.env.ORIGIN}
        />
      </Layout>,
    );
  });
}

app.notFound((c) => {
  const lang = (c.get('lang') as Lang | undefined) ?? 'ja';
  return c.text(DICTS[lang].notFound, 404);
});

export function handleWeb(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
  return app.fetch(request, env, ctx);
}
