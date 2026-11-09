import type { FC } from 'hono/jsx';
import type { PluginView } from '../domain/catalog';
import type { Category } from '../domain/metadata';
import type { ScanResult } from '../domain/status';
import type { PageContent } from './content';
import type { Dict, Lang } from './i18n';
import { withLang } from './layout';

const formatDate = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso)) : '-';
const formatDateTime = (iso: string | null | undefined, lang: Lang) =>
  iso
    ? `${new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
        new Date(iso),
      )} UTC`
    : '-';
const formatSize = (bytes: number, lang: Lang) =>
  new Intl.NumberFormat(lang, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(bytes / 1_000_000);

export const CategoryTag: FC<{ category: Category; t: Dict; lang: Lang }> = ({ category, t, lang }) => (
  <a class={`tag ${category}`} href={withLang(`/?category=${category}`, lang)}>
    {t.categories[category]}
  </a>
);

export const StatusBadge: FC<{ view: PluginView; t: Dict }> = ({ view, t }) => (
  <span class={`status ${view.status}`}>{t.status[view.status]}</span>
);

export const PluginCards: FC<{ items: PluginView[]; t: Dict; lang: Lang }> = ({ items, t, lang }) =>
  items.length === 0 ? (
    <p>{t.noResults}</p>
  ) : (
    <ol class="cards">
      {items.map((view) => (
        <li>
          <div class="card-head">
            <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
              {view.repo}
            </a>
            <StatusBadge view={view} t={t} />
            <span class="ver">{view.listedRelease?.tag}</span>
          </div>
          <ul class="tags">
            <li>
              <CategoryTag category={view.category} t={t} lang={lang} />
            </li>
            {view.os.map((os) => (
              <li>
                <span class="pill">{t.os[os]}</span>
              </li>
            ))}
          </ul>
          {view.summary ? (
            <p class="summary" lang="und">
              {view.summary}
            </p>
          ) : null}
          <p class="meta">
            <span translate="no">{view.owner}</span> | {t.updated} {formatDate(view.updatedAt, lang)}
          </p>
        </li>
      ))}
    </ol>
  );

export const SearchForm: FC<{
  t: Dict;
  lang: Lang;
  keyword?: string;
  os?: string;
  category?: string;
  categories: readonly Category[];
}> = ({ t, lang, keyword, os, category, categories }) => (
  <search>
    <form class="search" method="get" action="/">
      <input type="hidden" name="lang" value={lang} />
      <div class="row">
        <input
          type="search"
          name="q"
          value={keyword ?? ''}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          maxlength={100}
        />
        <button type="submit">{t.searchButton}</button>
      </div>
      <div class="row">
        <label>
          {t.osLabel}{' '}
          <select name="os">
            <option value="">{t.osAll}</option>
            {(['windows', 'macos', 'linux'] as const).map((value) => (
              <option value={value} selected={os === value}>
                {t.os[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.categoryLabel}{' '}
          <select name="category">
            <option value="">{t.categoryAll}</option>
            {categories.map((value) => (
              <option value={value} selected={category === value}>
                {t.categories[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  </search>
);

export const SideCommon: FC<{ t: Dict; lang: Lang; listed: number; lastSyncedAt: string | null }> = ({
  t,
  lang,
  listed,
  lastSyncedAt,
}) => (
  <>
    <section>
      <h2>{t.sideAgentTitle}</h2>
      <p>{t.sideAgentBody}</p>
      <p class="example">{t.sideAgentExample}</p>
      <p>
        <a href={withLang('/about#mcp', lang)}>{t.sideAgentLink}</a>
      </p>
    </section>
    <section>
      <h2>{t.sideListingTitle}</h2>
      <ul>
        {t.sideListingItems.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
      <p>
        <a href={withLang('/about', lang)}>{t.sidePolicy}</a> | <a href={withLang('/report', lang)}>{t.sideReport}</a>
      </p>
    </section>
    <section>
      <h2>{t.sideStatsTitle}</h2>
      <p>
        {t.sideStatsListed(listed)}
        <br />
        {t.sideStatsSynced} {formatDateTime(lastSyncedAt, lang)}
      </p>
    </section>
  </>
);

export const SideRelated: FC<{ t: Dict; lang: Lang; sameAuthor: PluginView[]; sameCategory: PluginView[] }> = ({
  t,
  lang,
  sameAuthor,
  sameCategory,
}) => (
  <>
    {sameAuthor.length > 0 ? (
      <section>
        <h2>{t.sameAuthor}</h2>
        <ul>
          {sameAuthor.map((view) => (
            <li>
              <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
                {view.repo}
              </a>
            </li>
          ))}
        </ul>
      </section>
    ) : null}
    {sameCategory.length > 0 ? (
      <section>
        <h2>{t.sameCategory}</h2>
        <ul>
          {sameCategory.map((view) => (
            <li>
              <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
                {view.repo}
              </a>
            </li>
          ))}
        </ul>
      </section>
    ) : null}
  </>
);

const checkLabel = (t: Dict, scanner: 'virustotal' | 'malwarebazaar', result: ScanResult | undefined) => {
  if (!result) return t.check.pending;
  if (scanner === 'malwarebazaar' && result === 'not_found') return t.malwarebazaarNotFound;
  return t.check[result];
};

export const PluginDetail: FC<{ view: PluginView; t: Dict; lang: Lang }> = ({ view, t, lang }) => {
  const head = (
    <>
      <p class="breadcrumb">
        <a href={withLang('/', lang)}>{t.library}</a> &gt;{' '}
        <a href={withLang(`/?category=${view.category}`, lang)}>{t.categories[view.category]}</a>
      </p>
      <h1 translate="no">{view.repo}</h1>
      <ul class="tags">
        <li>
          <CategoryTag category={view.category} t={t} lang={lang} />
        </li>
        <li>
          <StatusBadge view={view} t={t} />
        </li>
      </ul>
    </>
  );

  if (view.status !== 'listed' || !view.listedRelease) {
    const message =
      view.status === 'pending' ? t.pendingDetail : view.status === 'removed' ? t.removedDetail : t.suspendedDetail;
    return (
      <>
        {head}
        <p class="callout">{message}</p>
        {view.status === 'suspended' && view.suspendedReason ? (
          <p>
            {t.reasonLabel}: <span lang="und">{view.suspendedReason}</span>
          </p>
        ) : null}
        <p>
          <a href={withLang('/report', lang)}>{t.reportPlugin}</a>
        </p>
      </>
    );
  }

  const release = view.listedRelease;
  const primary = release.assets.find((asset) => asset.os !== null) ?? release.assets[0];
  return (
    <>
      {head}
      {view.summary ? (
        <>
          <p class="summary" lang="und">
            {view.summary}
          </p>
          <p class="untrusted-note">{t.summaryOriginal}</p>
        </>
      ) : null}
      {primary ? (
        <div class="download">
          <a class="button" href={primary.downloadUrl} rel="noopener noreferrer">
            {t.download}
          </a>
          <p>
            {release.tag} / <span translate="no">{primary.name}</span> / {formatSize(primary.size, lang)}
          </p>
        </div>
      ) : null}

      <h2 class="bar">{t.version}</h2>
      <table class="info">
        <tbody>
          <tr>
            <th scope="row">{t.author}</th>
            <td translate="no">{view.owner}</td>
          </tr>
          <tr>
            <th scope="row">{t.supportedOs}</th>
            <td>{view.os.length > 0 ? view.os.map((os) => t.os[os]).join(', ') : t.unknown}</td>
          </tr>
          <tr>
            <th scope="row">{t.supportedObs}</th>
            <td>{t.unknown}</td>
          </tr>
          <tr>
            <th scope="row">{t.license}</th>
            <td translate="no">{view.license}</td>
          </tr>
          <tr>
            <th scope="row">{t.version}</th>
            <td>
              {release.tag} ({formatDate(release.publishedAt, lang)})
            </td>
          </tr>
          <tr>
            <th scope="row">{t.commit}</th>
            <td class="hash">{release.commitSha.slice(0, 12)}</td>
          </tr>
          <tr>
            <th scope="row">{t.source}</th>
            <td>
              <a href={view.githubUrl} rel="noopener noreferrer">
                {t.repository}
              </a>
            </td>
          </tr>
          <tr>
            <th scope="row">{t.releases}</th>
            <td>
              <a href={view.releasesUrl} rel="noopener noreferrer">
                {t.releaseList}
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 class="bar">{t.filesAndChecks}</h2>
      <ul class="files">
        {release.assets.map((asset) => (
          <li>
            <div class="name">
              <a href={asset.downloadUrl} rel="noopener noreferrer" translate="no">
                {asset.name}
              </a>{' '}
              <span class="meta">{formatSize(asset.size, lang)}</span>
            </div>
            <div class="hash">SHA-256: {asset.digest.replace(/^sha256:/, '')}</div>
            <ul class="checks">
              <li>
                VirusTotal: {checkLabel(t, 'virustotal', asset.scans.virustotal?.result)}
                {asset.scans.virustotal?.detail ? ` (${asset.scans.virustotal.detail})` : ''},{' '}
                {formatDateTime(asset.scans.virustotal?.scannedAt, lang)}
              </li>
              <li>
                MalwareBazaar: {checkLabel(t, 'malwarebazaar', asset.scans.malwarebazaar?.result)},{' '}
                {formatDateTime(asset.scans.malwarebazaar?.scannedAt, lang)}
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <p>{t.noDetectionNotSafe}</p>
      {view.pendingReleases[0] ? (
        <p class="callout">{t.newerUnderCheck(view.pendingReleases[0].tag, release.tag)}</p>
      ) : null}

      <h2 class="bar">{t.cautions}</h2>
      <ul>
        {t.cautionItems.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
      <p>
        <a href={withLang('/report', lang)}>{t.reportPlugin}</a>
      </p>
    </>
  );
};

export const StaticPage: FC<{ content: PageContent; t: Dict; lang: Lang; path: string; anchorMcp: boolean }> = ({
  content,
  t,
  lang,
  path,
  anchorMcp,
}) => (
  <>
    <h1>{content.title}</h1>
    {lang !== 'en' ? (
      <p class="callout">
        {t.translationNote} <a href={withLang(path, 'en')}>{t.englishVersion}</a>
      </p>
    ) : null}
    {content.sections.map((section, index) => (
      <section id={anchorMcp && index === 2 ? 'mcp' : undefined}>
        <h2 class="bar">{section.heading}</h2>
        {section.paragraphs.map((paragraph) => (
          <p>{paragraph}</p>
        ))}
      </section>
    ))}
  </>
);
