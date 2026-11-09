// 検索と詳細表示のためのデータ読み出し。掲載状態はここで算出し、掲載中のものだけを一覧に出す。
import type { Env } from '../env';
import { detectLang, type TranslationLang } from '../translate';
import type { Category, Os } from './metadata';
import { computeStatus, type PluginStatus, type ReleaseForStatus, type Scanner, type ScanResult } from './status';

export interface ScanView {
  result: ScanResult;
  detail: string | null;
  scannedAt: string | null;
}

export interface AssetView {
  name: string;
  size: number;
  digest: string;
  downloadUrl: string;
  os: Os | null;
  scans: Record<Scanner, ScanView | null>;
}

export interface ReleaseView {
  tag: string;
  name: string | null;
  commitSha: string;
  publishedAt: string;
  htmlUrl: string;
  assets: AssetView[];
}

export interface PluginView {
  id: string;
  owner: string;
  repo: string;
  summary: string | null;
  // 概要の原文の言語と、言語ごとの機械翻訳。翻訳も外部データとして扱う。
  summaryLang: TranslationLang | null;
  translations: Partial<Record<TranslationLang, string>>;
  license: string;
  category: Category;
  os: Os[];
  status: PluginStatus;
  reason?: string;
  suspendedReason: string | null;
  githubUrl: string;
  releasesUrl: string;
  listedRelease: ReleaseView | null;
  pendingReleases: Array<{ tag: string; publishedAt: string }>;
  createdAt: string;
  updatedAt: string;
}

interface PluginRow {
  id: string;
  owner: string;
  repo: string;
  summary: string | null;
  license_spdx: string;
  category: Category;
  admin_suspended: number;
  suspended_reason: string | null;
  removed: number;
  created_at: string;
  updated_at: string;
}
interface ReleaseRow {
  github_release_id: number;
  plugin_id: string;
  tag: string;
  name: string | null;
  commit_sha: string;
  published_at: string;
  html_url: string;
}
interface AssetRow {
  release_id: number;
  name: string;
  size: number;
  digest: string;
  download_url: string;
  os: Os | null;
}
interface ScanRow {
  digest: string;
  scanner: Scanner;
  result: ScanResult;
  detail: string | null;
  scanned_at: string | null;
}

async function loadViews(env: Env, pluginId?: string): Promise<PluginView[]> {
  const where = pluginId ? 'WHERE p.id = ?' : '';
  const bind = (statement: D1PreparedStatement) => (pluginId ? statement.bind(pluginId) : statement);
  // 4 件の SELECT を 1 回の batch にまとめ、D1 のクエリ 1 件として扱う。
  const [plugins, releases, assets, scans, translations] = await env.DB.batch([
    bind(env.DB.prepare(`SELECT * FROM plugins p ${where}`)),
    bind(env.DB.prepare(`SELECT r.* FROM releases r JOIN plugins p ON p.id = r.plugin_id ${where}`)),
    bind(
      env.DB.prepare(
        `SELECT a.* FROM assets a JOIN releases r ON r.github_release_id = a.release_id JOIN plugins p ON p.id = r.plugin_id ${where}`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT DISTINCT s.* FROM scans s JOIN assets a ON a.digest = s.digest JOIN releases r ON r.github_release_id = a.release_id
         JOIN plugins p ON p.id = r.plugin_id ${where}`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT t.plugin_id, t.lang, t.text FROM plugin_translations t JOIN plugins p ON p.id = t.plugin_id ${where}`,
      ),
    ),
  ]);
  const translationsByPlugin = new Map<string, Partial<Record<TranslationLang, string>>>();
  for (const row of (translations?.results ?? []) as Array<{
    plugin_id: string;
    lang: TranslationLang;
    text: string;
  }>) {
    const entry = translationsByPlugin.get(row.plugin_id) ?? {};
    entry[row.lang] = row.text;
    translationsByPlugin.set(row.plugin_id, entry);
  }
  const scanMap = new Map<string, ScanRow>();
  for (const row of (scans?.results ?? []) as ScanRow[]) scanMap.set(`${row.digest}:${row.scanner}`, row);
  const assetsByRelease = new Map<number, AssetRow[]>();
  for (const row of (assets?.results ?? []) as AssetRow[]) {
    const list = assetsByRelease.get(row.release_id) ?? [];
    list.push(row);
    assetsByRelease.set(row.release_id, list);
  }
  const releasesByPlugin = new Map<string, ReleaseRow[]>();
  for (const row of (releases?.results ?? []) as ReleaseRow[]) {
    const list = releasesByPlugin.get(row.plugin_id) ?? [];
    list.push(row);
    releasesByPlugin.set(row.plugin_id, list);
  }

  const toScan = (digest: string, scanner: Scanner): ScanView | null => {
    const row = scanMap.get(`${digest}:${scanner}`);
    return row ? { result: row.result, detail: row.detail, scannedAt: row.scanned_at } : null;
  };

  return ((plugins?.results ?? []) as PluginRow[]).map((plugin) => {
    const pluginReleases = releasesByPlugin.get(plugin.id) ?? [];
    const forStatus: ReleaseForStatus[] = pluginReleases.map((release) => ({
      githubReleaseId: release.github_release_id,
      publishedAt: release.published_at,
      digests: (assetsByRelease.get(release.github_release_id) ?? []).map((asset) => asset.digest),
    }));
    const status = computeStatus(
      { adminSuspended: plugin.admin_suspended === 1, removed: plugin.removed === 1 },
      forStatus,
      (digest, scanner) => scanMap.get(`${digest}:${scanner}`)?.result,
    );
    const listed = pluginReleases.find((release) => release.github_release_id === status.listedReleaseId);
    const listedAssets = listed ? (assetsByRelease.get(listed.github_release_id) ?? []) : [];
    const releaseById = new Map(pluginReleases.map((release) => [release.github_release_id, release]));
    return {
      id: plugin.id,
      owner: plugin.owner,
      repo: plugin.repo,
      summary: plugin.summary,
      summaryLang: plugin.summary ? detectLang(plugin.summary) : null,
      translations: translationsByPlugin.get(plugin.id) ?? {},
      license: plugin.license_spdx,
      category: plugin.category,
      os: [...new Set(listedAssets.map((asset) => asset.os).filter((os): os is Os => os !== null))].sort(),
      status: status.status,
      reason: status.reason,
      suspendedReason: plugin.suspended_reason,
      githubUrl: `https://github.com/${plugin.owner}/${plugin.repo}`,
      releasesUrl: `https://github.com/${plugin.owner}/${plugin.repo}/releases`,
      listedRelease: listed
        ? {
            tag: listed.tag,
            name: listed.name,
            commitSha: listed.commit_sha,
            publishedAt: listed.published_at,
            htmlUrl: listed.html_url,
            assets: listedAssets.map((asset) => ({
              name: asset.name,
              size: asset.size,
              digest: asset.digest,
              downloadUrl: asset.download_url,
              os: asset.os,
              scans: {
                virustotal: toScan(asset.digest, 'virustotal'),
                malwarebazaar: toScan(asset.digest, 'malwarebazaar'),
              },
            })),
          }
        : null,
      pendingReleases: status.pendingReleaseIds
        .map((id) => releaseById.get(id))
        .filter((release): release is ReleaseRow => release !== undefined)
        .map((release) => ({ tag: release.tag, publishedAt: release.published_at })),
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at,
    };
  });
}

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export interface SearchQuery {
  keyword?: string;
  os?: Os;
  category?: Category;
  limit?: number;
  offset?: number;
}

export async function searchPlugins(env: Env, query: SearchQuery): Promise<{ total: number; items: PluginView[] }> {
  const tokens = (query.keyword ?? '')
    .split(/\s+/)
    .map(normalize)
    .filter((token) => token.length > 0);
  // 検査待ち、停止、掲載終了のプラグインは、検索結果に含めない。
  const listed = (await loadViews(env)).filter((view) => view.status === 'listed');
  const matched = listed
    .filter((view) => !query.os || view.os.includes(query.os))
    .filter((view) => !query.category || view.category === query.category)
    .filter((view) => {
      if (tokens.length === 0) return true;
      const haystack = normalize(`${view.owner} ${view.repo} ${view.summary ?? ''} ${view.category}`);
      return tokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;
  return { total: matched.length, items: matched.slice(offset, offset + limit) };
}

export async function getPluginView(env: Env, id: string): Promise<PluginView | null> {
  const [view] = await loadViews(env, id.toLowerCase());
  return view ?? null;
}

export async function catalogStats(
  env: Env,
): Promise<{ listed: number; lastSyncedAt: string | null; latest: PluginView[] }> {
  const views = (await loadViews(env)).filter((view) => view.status === 'listed');
  const row = await env.DB.prepare('SELECT max(last_synced_at) AS t FROM plugins').first<{ t: string | null }>();
  // 新着は、このプラットフォームに登録した日の新しい順に 5 件。
  const latest = [...views].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return { listed: views.length, lastSyncedAt: row?.t ?? null, latest };
}
