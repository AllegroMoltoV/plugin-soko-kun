import { raw } from 'hono/html';
import type { Child, FC } from 'hono/jsx';
import { CATEGORIES, type Category } from '../domain/metadata';
import { type Dict, LANG_NAMES, LANGS, type Lang } from './i18n';
import { LOGO_VERSION } from './logo';
import { STYLE_VERSION } from './style';

// public/og.png の SHA-256 の先頭 8 桁。URL のクエリに付け、画像が変わったときに閲覧者のキャッシュを使わせない。
const OG_VERSION = '067219cc';

export interface PageMeta {
  lang: Lang;
  t: Dict;
  title: string;
  description: string;
  // 言語の切替えに使う、lang を除いたパスとクエリ。
  path: string;
  // canonical と hreflang に使う、lang を除き category と page だけを残したパスとクエリ。
  canonicalPath: string;
  // 検索語や OS の絞り込みのように、検索エンジンに載せないページ。
  noindex?: boolean;
  // og:image。指定が無ければ共通画像を使う。
  ogImage?: { url: string; card: 'summary' | 'summary_large_image' };
  // 構造化データ。toJsonLd で文字列にしたもの。トップの WebSite と、詳細ページの SoftwareApplication に使う。
  jsonLd?: string;
  origin: string;
  currentCategory?: Category;
  keyword?: string;
}

// 姉妹サービスの音のプラグイン倉庫くん。言語の選び方 (?lang と同じ 7 言語) が同じため、表示中の言語を引き継ぐ。
const SISTER_ORIGIN = 'https://audio-soko-kun.allegromoltov.jp';

export function withLang(path: string, lang: Lang): string {
  const url = new URL(path, 'http://x');
  url.searchParams.set('lang', lang);
  return `${url.pathname}${url.search}`;
}

// 検索のボタンと「Google の AI で検索」のボタンは、同じ見た目で横に並べる。幅の広い表示では入力欄の横に、
// 幅の狭い表示では入力欄の次の行に置く (CSS の .search-buttons)。図は HTML に直接書いた SVG で描き、CSP の img-src に依存しない。
export const SearchButtons: FC<{ t: Dict }> = ({ t }) => (
  <span class="search-buttons">
    <SearchButton label={t.searchButton} />
    <AiSearchButton t={t} />
  </span>
);

export const SearchButton: FC<{ label: string }> = ({ label }) => (
  <button type="submit" class="icon-button">
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
    <span>{label}</span>
  </button>
);

// 検索欄の文を、利用者自身の AI (Google の AI モード) に渡すボタン (5ig)。倉庫くんは検索をせず、
// POST /ai-search が質問の文を組み立てて別のタブで転送する。Enter キーの暗黙の送信はツリー順で最初の送信ボタンを使うため、
// 検索のボタンより後ろに置き、Enter キーでは今までどおり部分一致の検索をする。
// 図は 4 方向に光る星。Google のロゴは使わず、配色の規則に合わせて文字と同じ色で描く。
export const AiSearchButton: FC<{ t: Dict }> = ({ t }) => (
  <button
    type="submit"
    class="icon-button ai-search"
    formaction="/ai-search"
    formmethod="post"
    formtarget="_blank"
    title={t.aiSearchHint}
  >
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 0C8.6 4.6 11.4 7.4 16 8C11.4 8.6 8.6 11.4 8 16C7.4 11.4 4.6 8.6 0 8C4.6 7.4 7.4 4.6 8 0Z"
        fill="currentColor"
      />
    </svg>
    <span>{t.aiSearchButton}</span>
  </button>
);

// POST /ai-search の応答。表示のためのページではなく、Google の AI モードへ移るための応答。
// 303 で転送するとフォームの送信の続きとして CSP の form-action の対象になり、form-action 'self' で止まる。
// meta refresh とリンクによる移動はフォームの送信ではないため、CSP を変えずに移れる。
export const AiSearchRedirect: FC<{ t: Dict; lang: Lang; target: string }> = ({ t, lang, target }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang={lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <meta http-equiv="refresh" content={`0;url=${target}`} />
        <title>{t.aiSearchOpen}</title>
        <link rel="stylesheet" href={`/style.css?v=${STYLE_VERSION}`} />
      </head>
      <body>
        <main class="ai-redirect">
          <p>{t.aiSearchRedirect}</p>
          <p>
            <a href={target} rel="noreferrer">
              {t.aiSearchOpen}
            </a>
          </p>
        </main>
      </body>
    </html>
  </>
);

const SITE_NAME = '配信プラグイン倉庫くん';
const SITE_NAME_EN = 'Plugin Soko-kun';

// 英語で検索した利用者に英語のサイト名を見せる。漢字を読める言語では日本語の名前を先に出す。
const siteNameFor = (lang: Lang) =>
  lang === 'en' || lang === 'pt-BR' || lang === 'es-419' ? SITE_NAME_EN : `${SITE_NAME} (${SITE_NAME_EN})`;

// Google の hreflang は ISO 639-1 と ISO 3166-1 だけを扱うため、es-419 は es で示す。
const hreflangOf = (lang: Lang) => (lang === 'es-419' ? 'es' : lang);

const OG_LOCALE: Record<Lang, string> = {
  ja: 'ja_JP',
  en: 'en_US',
  'zh-Hans': 'zh_CN',
  'zh-Hant': 'zh_TW',
  ko: 'ko_KR',
  'pt-BR': 'pt_BR',
  'es-419': 'es_LA',
};

// < は script の外へ出ないよう置き換える。
export const toJsonLd = (data: Record<string, unknown>) => JSON.stringify(data).replaceAll('<', '\\u003c');

// 検索結果のサイト名は 1 サイトに 1 つだけなので、全言語で同じ内容にする。
export const websiteJsonLd = (origin: string) =>
  toJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: `${origin}/`,
  });

// 収集を防ぐため、アドレスは HTML に書かない。フォームの送信を受けたときだけサーバーが返す。
export const ContactButton: FC<{ t: Dict; lang: Lang }> = ({ t, lang }) => (
  <form class="contact" method="post" action={withLang('/contact', lang)}>
    <button type="submit">{t.showContact}</button>
  </form>
);

export const Layout: FC<{ meta: PageMeta; side: Child; sideNarrow: Child; children?: Child }> = ({
  meta,
  side,
  sideNarrow,
  children,
}) => {
  const { lang, t } = meta;
  // doctype が無いと互換モードで描画され、フォームの余白などが標準と変わる。
  return (
    <>
      {raw('<!DOCTYPE html>')}
      <html lang={lang}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`${meta.title} - ${siteNameFor(lang)}`}</title>
          <meta name="description" content={meta.description} />
          {meta.noindex ? <meta name="robots" content="noindex" /> : null}
          <link rel="canonical" href={`${meta.origin}${withLang(meta.canonicalPath, lang)}`} />
          <meta property="og:title" content={meta.title} />
          <meta property="og:description" content={meta.description} />
          <meta property="og:url" content={`${meta.origin}${withLang(meta.canonicalPath, lang)}`} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={siteNameFor(lang)} />
          <meta property="og:locale" content={OG_LOCALE[lang]} />
          <meta property="og:image" content={meta.ogImage?.url ?? `${meta.origin}/og.png?v=${OG_VERSION}`} />
          <meta name="twitter:card" content={meta.ogImage?.card ?? 'summary_large_image'} />
          {meta.jsonLd ? <script type="application/ld+json">{raw(meta.jsonLd)}</script> : null}
          <link rel="stylesheet" href={`/style.css?v=${STYLE_VERSION}`} />
          <link rel="icon" type="image/svg+xml" href={`/logo.svg?v=${LOGO_VERSION}`} />
          {LANGS.map((l) => (
            <link rel="alternate" hreflang={hreflangOf(l)} href={`${meta.origin}${withLang(meta.canonicalPath, l)}`} />
          ))}
          <link rel="alternate" hreflang="x-default" href={`${meta.origin}${withLang(meta.canonicalPath, 'en')}`} />
        </head>
        <body>
          <a class="skip" href="#main">
            Skip to content
          </a>
          <header class="site">
            <div class="wrap">
              <a class="brand" href={withLang('/', lang)}>
                <img src={`/logo.svg?v=${LOGO_VERSION}`} width={40} height={40} alt="" />
                <span class="brand-text">
                  <b translate="no">{SITE_NAME}</b>
                  <small>
                    <span translate="no">{SITE_NAME_EN}</span> - {t.tagline}
                  </small>
                </span>
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
                  <SearchButtons t={t} />
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
              <li>
                <a href={withLang('/', lang)}>{t.categoryAll}</a>
              </li>
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
            </ul>
          </nav>
          <div class="notice" role="note">
            <p class="wrap">
              <span class="label">{t.cautionLabel}</span>
              <span class="long">{t.notice}</span>
              <span class="short">
                {t.noticeShort} <a href={withLang('/about', lang)}>{t.nav.about}</a>
              </span>
            </p>
          </div>
          <div class="wrap layout">
            <main id="main">{children}</main>
            <aside class="side side-wide">{side}</aside>
            <aside class="side side-narrow">{sideNarrow}</aside>
          </div>
          <footer class="site">
            <div class="wrap">
              <ul>
                <li>
                  <a href={withLang('/about', lang)}>{t.nav.about}</a>
                </li>
                <li>
                  <a href={withLang('/policy', lang)}>{t.nav.policy}</a>
                </li>
                <li>
                  <a href={withLang('/submit', lang)}>{t.nav.submit}</a>
                </li>
                <li>
                  <a href={withLang('/security', lang)}>{t.nav.security}</a>
                </li>
                <li>
                  <a href={withLang('/report', lang)}>{t.nav.report}</a>
                </li>
                <li>
                  <a href={withLang('/terms', lang)}>{t.nav.terms}</a>
                </li>
                <li>
                  <a href={withLang('/privacy', lang)}>{t.nav.privacy}</a>
                </li>
                <li>
                  <a href={withLang('/notices', lang)}>{t.nav.notices}</a>
                </li>
                <li>
                  <a href="https://github.com/AllegroMoltoV/plugin-soko-kun">{t.nav.source}</a>
                </li>
              </ul>
              <p>{t.notice}</p>
              <div class="contact-line">
                {t.contactLabel}: <ContactButton t={t} lang={lang} />
                <a class="sponsor" href="https://github.com/sponsors/AllegroMoltoV">
                  <span class="heart" aria-hidden="true">
                    ♥
                  </span>
                  {t.nav.sponsor}
                </a>
              </div>
              <p>
                {t.sister.before}
                <a href={`${SISTER_ORIGIN}${withLang('/', lang)}`}>{t.sister.name}</a>
                {t.sister.after}
              </p>
              <p class="copyright">© 2026 AllegroMoltoV</p>
            </div>
          </footer>
        </body>
      </html>
    </>
  );
};
