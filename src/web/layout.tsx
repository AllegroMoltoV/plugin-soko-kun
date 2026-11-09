import type { Child, FC } from 'hono/jsx';
import { CATEGORIES, type Category } from '../domain/metadata';
import { type Dict, LANG_NAMES, LANGS, type Lang } from './i18n';
import { STYLE_VERSION } from './style';

export interface PageMeta {
  lang: Lang;
  t: Dict;
  title: string;
  description: string;
  // 言語の切替えと hreflang に使う、lang を除いたパスとクエリ。
  path: string;
  origin: string;
  currentCategory?: Category;
  keyword?: string;
}

export function withLang(path: string, lang: Lang): string {
  const url = new URL(path, 'http://x');
  url.searchParams.set('lang', lang);
  return `${url.pathname}${url.search}`;
}

// 検索ボタンは虫眼鏡の図だけを見せ、読み上げ用に文字を残す。画像ファイルを使わず、CSP の img-src に依存しない。
export const SearchButton: FC<{ label: string }> = ({ label }) => (
  <button type="submit" class="icon-button" title={label}>
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
    <span class="visually-hidden">{label}</span>
  </button>
);

const SITE_NAME = '配信プラグイン倉庫くん';
const SITE_NAME_EN = 'Plugin Soko-kun';

export const Layout: FC<{ meta: PageMeta; side: Child; children?: Child }> = ({ meta, side, children }) => {
  const { lang, t } = meta;
  return (
    <html lang={lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${meta.title} - ${SITE_NAME} (${SITE_NAME_EN})`}</title>
        <meta name="description" content={meta.description} />
        <link rel="stylesheet" href={`/style.css?v=${STYLE_VERSION}`} />
        {LANGS.map((l) => (
          <link rel="alternate" hreflang={l} href={`${meta.origin}${withLang(meta.path, l)}`} />
        ))}
        <link rel="alternate" hreflang="x-default" href={`${meta.origin}${withLang(meta.path, 'en')}`} />
      </head>
      <body>
        <a class="skip" href="#main">
          Skip to content
        </a>
        <header class="site">
          <div class="wrap">
            <a class="brand" href={withLang('/', lang)}>
              <b translate="no">{SITE_NAME}</b>
              <small>
                <span translate="no">{SITE_NAME_EN}</span> - {t.tagline}
              </small>
            </a>
            <search>
              <form method="get" action="/">
                <input type="hidden" name="lang" value={lang} />
                <input
                  type="search"
                  name="q"
                  value={meta.keyword ?? ''}
                  placeholder={t.searchPlaceholder}
                  aria-label={t.searchPlaceholder}
                  maxlength={100}
                />
                <SearchButton label={t.searchButton} />
              </form>
            </search>
            <details class="lang">
              <summary aria-label={t.languageLabel}>{LANG_NAMES[lang]}</summary>
              <ul>
                {LANGS.map((l) => (
                  <li>
                    <a
                      href={withLang(meta.path, l)}
                      hreflang={l}
                      lang={l}
                      aria-current={l === lang ? 'true' : undefined}
                    >
                      {LANG_NAMES[l]}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </header>
        <nav class="cats" aria-label={t.categoryLabel}>
          <ul>
            {CATEGORIES.filter((c) => c !== 'other').map((c) => (
              <li>
                <a
                  href={withLang(`/?category=${c}`, lang)}
                  aria-current={meta.currentCategory === c ? 'page' : undefined}
                >
                  {t.categories[c]}
                </a>
              </li>
            ))}
            <li>
              <a href={withLang('/', lang)}>{t.categoryAll}</a>
            </li>
          </ul>
        </nav>
        <div class="notice" role="note">
          <p class="wrap">
            <span class="long">{t.notice}</span>
            <span class="short">
              {t.noticeShort} <a href={withLang('/about', lang)}>{t.nav.about}</a>
            </span>
          </p>
        </div>
        <div class="wrap layout">
          <main id="main">{children}</main>
          <aside class="side">{side}</aside>
        </div>
        <footer class="site">
          <div class="wrap">
            <ul>
              <li>
                <a href={withLang('/about', lang)}>{t.nav.about}</a>
              </li>
              <li>
                <a href={withLang('/security', lang)}>{t.nav.security}</a>
              </li>
              <li>
                <a href={withLang('/report', lang)}>{t.nav.report}</a>
              </li>
              <li>
                <a href={withLang('/privacy', lang)}>{t.nav.privacy}</a>
              </li>
              <li>
                <a href="https://github.com/AllegroMoltoV/plugin-soko-kun">{t.nav.source}</a>
              </li>
            </ul>
            <p>{t.notice}</p>
          </div>
        </footer>
      </body>
    </html>
  );
};
