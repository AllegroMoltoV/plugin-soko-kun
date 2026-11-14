// 検索と詳細表示のためのデータ読み出し。掲載状態はここで算出し、掲載中のものだけを一覧に出す。
import type { Env } from '../env';
import { detectLang, type TranslationLang } from '../translate';
import type { Category, Os } from './metadata';
import {
  type AttestationResult,
  type ConfigState,
  computeStatus,
  type DiffState,
  type PluginStatus,
  type ReleaseChecks,
  type ReleaseForStatus,
  type ReviewState,
  type Scanner,
  type ScanResult,
} from './status';

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
  githubReleaseId: number;
  tag: string;
  name: string | null;
  commitSha: string;
  publishedAt: string;
  htmlUrl: string;
  // タグの時点の buildspec.json に書かれた、ビルドに使った OBS Studio の版。外部データ。
  obsBuildVersion: string | null;
  assets: AssetView[];
}

export interface ImageView {
  sha: string;
  width: number;
  height: number;
  type: string;
  // 説明の画像の表示用の WebP。元の画像と同じ SHA から作ったものだけを持つ。
  preview?: { width: number; height: number };
}

export interface SuspendedReleaseView {
  tag: string;
  reason: 'admin' | 'malicious';
  // 管理者が書いた告知の文。公開してよい内容だけを書く運用。
  note: string | null;
  suspendedAt: string;
  assets: Array<{ name: string; digest: string }>;
  listedFrom: string | null;
  listedUntil: string | null;
}

export interface PluginView {
  // URL と MCP で示す ID。現在の owner/repo を小文字にしたもので、名前を変えると変わる。
  id: string;
  // 内部のプラグイン ID。登録したときの owner/repo で、名前の変更では変えない。
  internalId: string;
  // 表示名。.soko-kun/config.json の name、無ければリポジトリ名。外部データ。
  name: string;
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
  // 管理者が画像を非表示にしたプラグインでは空にする。
  images: { logo?: ImageView; image?: ImageView };
  // GitHub でのダウンロード数の最新の記録。週間の数は 7 日以上前の記録が無ければ null。
  downloads: { total: number; day: string; weekly: number | null } | null;
  // 止めた版。掲載中でも、止めた版があれば警告に使う。
  suspendedReleases: SuspendedReleaseView[];
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
  images_hidden: number;
  display_name: string | null;
  declared_os: string | null;
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
  obs_build_version: string | null;
}
interface AssetRow {
  github_asset_id: number;
  release_id: number;
  name: string;
  size: number;
  digest: string;
  download_url: string;
  os: Os | null;
}
interface CheckRow {
  github_release_id: number;
  legacy: number;
  immutable: number;
  diff_state: DiffState;
  config_state: ConfigState;
  review_state: ReviewState;
  review_attempts: number;
  review_serious: number;
  admin_approved_at: string | null;
}
interface ScanRow {
  digest: string;
  scanner: Scanner;
  result: ScanResult;
  detail: string | null;
  scanned_at: string | null;
}

// 記録は日付の昇順。週間の数は、最新の記録と、その 7 日以上前の記録のうち最も新しいものとの差。
function downloadsOf(list: Array<{ day: string; total: number }>): PluginView['downloads'] {
  const latest = list.at(-1);
  if (!latest) return null;
  const weekAgo = new Date(Date.parse(`${latest.day}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const base = list.filter((entry) => entry.day <= weekAgo).at(-1);
  return { total: latest.total, day: latest.day, weekly: base ? Math.max(0, latest.total - base.total) : null };
}

async function loadViews(env: Env, pluginId?: string): Promise<PluginView[]> {
  const where = pluginId ? 'WHERE p.id = ?' : '';
  const bind = (statement: D1PreparedStatement) => (pluginId ? statement.bind(pluginId) : statement);
  // SELECT を 1 回の batch にまとめ、D1 のクエリ 1 件として扱う。
  const [
    plugins,
    releases,
    assets,
    scans,
    translations,
    images,
    snapshots,
    checks,
    attestations,
    suspensions,
    periods,
  ] = await env.DB.batch([
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
    // 画像の本体は配信のときだけ読む。
    bind(
      env.DB.prepare(
        `SELECT i.plugin_id, i.kind, i.blob_sha, i.width, i.height, i.content_type,
           v.width AS preview_width, v.height AS preview_height
         FROM plugin_images i JOIN plugins p ON p.id = i.plugin_id
         LEFT JOIN plugin_image_previews v ON v.plugin_id = i.plugin_id AND i.kind = 'image' AND v.source_sha = i.blob_sha
         ${where}`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT d.plugin_id, d.day, d.total FROM download_snapshots d JOIN plugins p ON p.id = d.plugin_id ${where} ORDER BY d.day`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT c.* FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id
         JOIN plugins p ON p.id = r.plugin_id ${where}`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT t.github_asset_id, t.result FROM attestation_checks t JOIN assets a ON a.github_asset_id = t.github_asset_id
         JOIN releases r ON r.github_release_id = a.release_id JOIN plugins p ON p.id = r.plugin_id ${where}`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT s.plugin_id, s.github_release_id, s.tag, s.reason, s.note, s.suspended_at
           FROM release_suspensions s JOIN plugins p ON p.id = s.plugin_id ${where} ORDER BY s.suspended_at DESC`,
      ),
    ),
    bind(
      env.DB.prepare(
        `SELECT l.github_release_id, l.digest, l.asset_name, l.started_at, l.ended_at FROM listing_periods l
           JOIN release_suspensions s ON s.github_release_id = l.github_release_id
           JOIN plugins p ON p.id = s.plugin_id ${where}`,
      ),
    ),
  ]);
  const snapshotsByPlugin = new Map<string, Array<{ day: string; total: number }>>();
  for (const row of (snapshots?.results ?? []) as Array<{ plugin_id: string; day: string; total: number }>) {
    const list = snapshotsByPlugin.get(row.plugin_id) ?? [];
    list.push({ day: row.day, total: row.total });
    snapshotsByPlugin.set(row.plugin_id, list);
  }
  const imagesByPlugin = new Map<string, { logo?: ImageView; image?: ImageView }>();
  for (const row of (images?.results ?? []) as Array<{
    plugin_id: string;
    kind: 'logo' | 'image';
    blob_sha: string;
    width: number;
    height: number;
    content_type: string;
    preview_width: number | null;
    preview_height: number | null;
  }>) {
    const entry = imagesByPlugin.get(row.plugin_id) ?? {};
    entry[row.kind] = {
      sha: row.blob_sha,
      width: row.width,
      height: row.height,
      type: row.content_type,
      ...(row.preview_width && row.preview_height
        ? { preview: { width: row.preview_width, height: row.preview_height } }
        : {}),
    };
    imagesByPlugin.set(row.plugin_id, entry);
  }
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

  const checksByRelease = new Map<number, ReleaseChecks>();
  for (const row of (checks?.results ?? []) as CheckRow[]) {
    checksByRelease.set(row.github_release_id, {
      legacy: row.legacy === 1,
      immutable: row.immutable === 1,
      diffState: row.diff_state,
      configState: row.config_state,
      reviewState: row.review_state,
      reviewAttempts: row.review_attempts,
      reviewSerious: row.review_serious,
      adminApproved: row.admin_approved_at !== null,
    });
  }
  const attestationByAsset = new Map<number, AttestationResult>();
  for (const row of (attestations?.results ?? []) as Array<{ github_asset_id: number; result: AttestationResult }>) {
    attestationByAsset.set(row.github_asset_id, row.result);
  }
  const suspensionRows = (suspensions?.results ?? []) as Array<{
    plugin_id: string;
    github_release_id: number;
    tag: string;
    reason: 'admin' | 'malicious';
    note: string | null;
    suspended_at: string;
  }>;
  const suspendedReleases = new Set(suspensionRows.map((row) => row.github_release_id));
  const periodsByRelease = new Map<
    number,
    Array<{ digest: string; asset_name: string; started_at: string; ended_at: string | null }>
  >();
  for (const row of (periods?.results ?? []) as Array<{
    github_release_id: number;
    digest: string;
    asset_name: string;
    started_at: string;
    ended_at: string | null;
  }>) {
    const list = periodsByRelease.get(row.github_release_id) ?? [];
    list.push(row);
    periodsByRelease.set(row.github_release_id, list);
  }
  const suspendedByPlugin = new Map<string, SuspendedReleaseView[]>();
  for (const row of suspensionRows) {
    const list = periodsByRelease.get(row.github_release_id) ?? [];
    const started = list.map((period) => period.started_at).sort();
    const ended = list
      .map((period) => period.ended_at)
      .filter((value): value is string => value !== null)
      .sort();
    const entry: SuspendedReleaseView = {
      tag: row.tag,
      reason: row.reason,
      note: row.note,
      suspendedAt: row.suspended_at,
      assets: list.map((period) => ({ name: period.asset_name, digest: period.digest })),
      listedFrom: started[0] ?? null,
      listedUntil: list.some((period) => period.ended_at === null) ? null : (ended.at(-1) ?? null),
    };
    suspendedByPlugin.set(row.plugin_id, [...(suspendedByPlugin.get(row.plugin_id) ?? []), entry]);
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
      assets: (assetsByRelease.get(release.github_release_id) ?? []).map((asset) => ({
        name: asset.name,
        digest: asset.digest,
        os: asset.os,
        attestation: attestationByAsset.get(asset.github_asset_id),
      })),
      checks: checksByRelease.get(release.github_release_id),
      suspended: suspendedReleases.has(release.github_release_id),
    }));
    const status = computeStatus(
      { adminSuspended: plugin.admin_suspended === 1, removed: plugin.removed === 1 },
      forStatus,
      (digest, scanner) => scanMap.get(`${digest}:${scanner}`)?.result,
    );
    const listed = pluginReleases.find((release) => release.github_release_id === status.listedReleaseId);
    // 作者が OS を宣言していれば、宣言した OS の配布物だけを載せる。OS を推定できないソースの配布物は残す。
    const declaredOs = parseDeclaredOs(plugin.declared_os);
    const listedAssets = (listed ? (assetsByRelease.get(listed.github_release_id) ?? []) : []).filter(
      (asset) => !declaredOs || asset.os === null || declaredOs.includes(asset.os),
    );
    const releaseById = new Map(pluginReleases.map((release) => [release.github_release_id, release]));
    return {
      id: `${plugin.owner}/${plugin.repo}`.toLowerCase(),
      internalId: plugin.id,
      name: plugin.display_name ?? plugin.repo,
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
            githubReleaseId: listed.github_release_id,
            tag: listed.tag,
            name: listed.name,
            commitSha: listed.commit_sha,
            publishedAt: listed.published_at,
            htmlUrl: listed.html_url,
            obsBuildVersion: listed.obs_build_version || null,
            assets: listedAssets.map((asset) => ({
              name: asset.name,
              size: asset.size,
              digest: asset.digest,
              downloadUrl: asset.download_url,
              os: asset.os,
              scans: {
                malwarebazaar: toScan(asset.digest, 'malwarebazaar'),
              },
            })),
          }
        : null,
      pendingReleases: status.pendingReleaseIds
        .map((id) => releaseById.get(id))
        .filter((release): release is ReleaseRow => release !== undefined)
        .map((release) => ({ tag: release.tag, publishedAt: release.published_at })),
      images: plugin.images_hidden === 1 ? {} : (imagesByPlugin.get(plugin.id) ?? {}),
      downloads: downloadsOf(snapshotsByPlugin.get(plugin.id) ?? []),
      suspendedReleases: suspendedByPlugin.get(plugin.id) ?? [],
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at,
    };
  });
}

function parseDeclaredOs(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null;
  } catch {
    return null;
  }
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
      // 概要は原文に加えて機械翻訳も照合し、どの言語のキーワードでも見つかるようにする。
      const translated = Object.values(view.translations).join(' ');
      const haystack = normalize(`${view.owner} ${view.repo} ${view.summary ?? ''} ${translated} ${view.category}`);
      return tokens.every((token) => haystack.includes(token));
    })
    // 掲載対象バージョンの公開日の新しい順。updated_at は同期のたびに進むため使わない。
    .sort((a, b) => (b.listedRelease?.publishedAt ?? '').localeCompare(a.listedRelease?.publishedAt ?? ''));
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;
  return { total: matched.length, items: matched.slice(offset, offset + limit) };
}

// URL と MCP の ID (現在の owner/repo) か、名前を変える前の ID からプラグインを引く。
// 呼び出し側は、返ったプラグインの id と要求の ID を比べて、旧い ID からの転送を判定する。
export async function getPluginView(env: Env, slug: string): Promise<PluginView | null> {
  const lower = slug.toLowerCase();
  const row = await env.DB.prepare(
    `SELECT id FROM plugins WHERE lower(owner || '/' || repo) = ?
     UNION ALL SELECT plugin_id AS id FROM plugin_aliases WHERE alias = ? LIMIT 1`,
  )
    .bind(lower, lower)
    .first<{ id: string }>();
  if (!row) return null;
  const [view] = await loadViews(env, row.id);
  return view ?? null;
}

export async function getPluginViewByInternalId(env: Env, id: string): Promise<PluginView | null> {
  const [view] = await loadViews(env, id);
  return view ?? null;
}

export async function catalogStats(
  env: Env,
): Promise<{ listed: number; lastSyncedAt: string | null; latest: PluginView[]; weekly: PluginView[] }> {
  const views = (await loadViews(env)).filter((view) => view.status === 'listed');
  // 確認日時は、掲載中のプラグインを最後に同期した日時。
  const listedIds = new Set(views.map((view) => view.id));
  const { results: synced } = await env.DB.prepare('SELECT id, last_synced_at FROM plugins').all<{
    id: string;
    last_synced_at: string;
  }>();
  const lastSyncedAt =
    synced
      .filter((entry) => listedIds.has(entry.id))
      .map((entry) => entry.last_synced_at)
      .sort()
      .at(-1) ?? null;
  // 新着は、このプラットフォームに登録した日の新しい順に 5 件。
  const latest = [...views].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  // 週間ダウンロード数の上位 5 件。週間の数を求められないものと 0 のものは出さない。
  const weekly = views
    .filter((view) => (view.downloads?.weekly ?? 0) > 0)
    .sort((a, b) => (b.downloads?.weekly ?? 0) - (a.downloads?.weekly ?? 0) || a.repo.localeCompare(b.repo))
    .slice(0, 5);
  return { listed: views.length, lastSyncedAt, latest, weekly };
}

// 掲載中で、画像を非表示にしていないプラグインの画像だけを返す。
export async function getPluginImage(
  env: Env,
  id: string,
  kind: 'logo' | 'image',
): Promise<{ contentType: string; bytes: ArrayBuffer } | null> {
  const view = await getPluginView(env, id);
  if (view?.status !== 'listed' || !view.images[kind]) return null;
  const row = await env.DB.prepare('SELECT content_type, bytes FROM plugin_images WHERE plugin_id = ? AND kind = ?')
    .bind(view.internalId, kind)
    .first<{ content_type: string; bytes: ArrayBuffer | number[] }>();
  if (!row) return null;
  const bytes = Array.isArray(row.bytes) ? new Uint8Array(row.bytes).buffer : row.bytes;
  return { contentType: row.content_type, bytes };
}

// 説明の画像の表示用の WebP。説明の画像と同じ条件で、元の画像と同じ SHA から作ったものだけを返す。
export async function getPluginPreview(
  env: Env,
  id: string,
): Promise<{ contentType: string; bytes: ArrayBuffer } | null> {
  const view = await getPluginView(env, id);
  const image = view?.images.image;
  if (view?.status !== 'listed' || !image?.preview) return null;
  const row = await env.DB.prepare('SELECT bytes FROM plugin_image_previews WHERE plugin_id = ? AND source_sha = ?')
    .bind(view.internalId, image.sha)
    .first<{ bytes: ArrayBuffer | number[] }>();
  if (!row) return null;
  const bytes = Array.isArray(row.bytes) ? new Uint8Array(row.bytes).buffer : row.bytes;
  return { contentType: 'image/webp', bytes };
}

// 定期処理が、すべてのプラグインの掲載状態から掲載の期間を記録するために使う。D1 のクエリは 1 件。
export function loadAllViews(env: Env): Promise<PluginView[]> {
  return loadViews(env);
}

// 告知ページの一覧。止めた版を、止めた日時の新しい順に並べる。
export async function listNotices(env: Env): Promise<Array<{ view: PluginView; release: SuspendedReleaseView }>> {
  return (await loadViews(env))
    .flatMap((view) => view.suspendedReleases.map((release) => ({ view, release })))
    .sort((a, b) => b.release.suspendedAt.localeCompare(a.release.suspendedAt));
}
