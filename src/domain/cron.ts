// 15 分ごとの定期処理。無料プランの 1 回の上限に収めるため、予算を使い切ったら次回へ持ち越す。
import { Budget, BudgetExceededError } from '../budget';
import type { Env } from '../env';
import { GitHubClient, GitHubError, type GitHubRelease } from '../github';
import { checkImage, expectedType, IMAGE_LIMITS, type ImageKind } from '../images';
import { runPreviews } from '../previews';
import { ScannerRateLimitedError, scanWithMalwareBazaar } from '../scanners';
import { runTranslations } from '../translate';
import { loadAllViews } from './catalog';
import { inferOs } from './metadata';
import { runReleaseChecks } from './release-checks';
import type { Scanner } from './status';

export const MALWAREBAZAAR_PER_RUN = 10;
const MAX_ATTEMPTS = 5;
const TAG = /^[A-Za-z0-9._-]{1,100}$/;

export interface CronReport {
  scanned: number;
  synced: number;
  failed: number;
  translated: number;
  previews: number;
  downloadsRecorded: number;
  subrequests: number;
  d1Queries: number;
  releasesChecked?: number;
  stoppedBy?: string;
}

function now(): string {
  return new Date().toISOString();
}

interface PendingScan {
  digest: string;
  scanner: Scanner;
  attempts: number;
}

// 掲載中の配布物を MalwareBazaar へ照会し直す間隔。
const RESCAN_AFTER_DAYS = 7;

async function runScans(env: Env, budget: Budget, report: CronReport): Promise<void> {
  const key = env.MALWAREBAZAAR_AUTH_KEY;
  // 鍵が無いときは照会しない。結果は検査待ちのまま残り、検査済みとは表示されない。
  if (!key) return;
  budget.takeD1Query();
  const rescanBefore = new Date(Date.now() - RESCAN_AFTER_DAYS * 86_400_000).toISOString();
  const { results } = await env.DB.prepare(
    // 未照会と失敗を先に、残りの件数で掲載中の配布物を照会し直す (ADR 0013)。
    `SELECT digest, scanner, attempts FROM scans
     WHERE scanner = 'malwarebazaar' AND (result = 'pending' OR (result = 'error' AND attempts < ?)
       OR (result = 'not_found' AND scanned_at < ?
         AND digest IN (SELECT digest FROM listing_periods WHERE ended_at IS NULL)))
     ORDER BY result = 'not_found', scanned_at IS NOT NULL, scanned_at LIMIT ?`,
  )
    .bind(MAX_ATTEMPTS, rescanBefore, MALWAREBAZAAR_PER_RUN)
    .all<PendingScan>();
  const updates: D1PreparedStatement[] = [];
  for (const row of results) {
    if (!budget.canFetch()) break;
    try {
      const outcome = await scanWithMalwareBazaar(budget, key, row.digest);
      updates.push(
        env.DB.prepare(
          'UPDATE scans SET result = ?, detail = ?, attempts = attempts + 1, scanned_at = ? WHERE digest = ? AND scanner = ?',
        ).bind(outcome.result, outcome.detail, now(), row.digest, row.scanner),
      );
      report.scanned += 1;
    } catch (error) {
      if (error instanceof ScannerRateLimitedError) break;
      throw error;
    }
  }
  if (updates.length > 0) {
    budget.takeD1Query();
    await env.DB.batch(updates);
  }
}

interface SyncRow {
  id: string;
  github_repo_id: number;
  owner: string;
  repo: string;
  releases_etag: string | null;
  images_tag: string | null;
  latest_tag: string | null;
  latest_release_id: number | null;
  // 掲載中の版より新しく、まだ掲載していない版がある。確認待ちの間は概要を追従させない (ADR 0013)。
  has_pending: number;
}

// プラグイン 1 件の同期に必要な外部呼び出しの最大数: リポジトリ、リリース、コミットの解決、画像の一覧とダウンロード 2 件、buildspec.json。
const SYNC_COST = 7;

async function syncOne(env: Env, budget: Budget, github: GitHubClient, row: SyncRow): Promise<void> {
  const timestamp = now();
  let repo: Awaited<ReturnType<GitHubClient['getRepoById']>>;
  try {
    // ID で引き直すと、リネームや移管の後も同じリポジトリを追える。
    repo = await github.getRepoById(row.github_repo_id);
  } catch (error) {
    if (error instanceof GitHubError && error.kind === 'not_found') {
      budget.takeD1Query();
      await env.DB.prepare('UPDATE plugins SET removed = 1, updated_at = ?, last_synced_at = ? WHERE id = ?')
        .bind(timestamp, timestamp, row.id)
        .run();
      return;
    }
    throw error;
  }
  if (repo.private) {
    budget.takeD1Query();
    await env.DB.prepare('UPDATE plugins SET removed = 1, updated_at = ?, last_synced_at = ? WHERE id = ?')
      .bind(timestamp, timestamp, row.id)
      .run();
    return;
  }

  const statements: D1PreparedStatement[] = [];
  const latest = await github.getLatestRelease(repo.owner.login, repo.name, row.releases_etag ?? undefined);
  // 新しい版が来た同期と、確認待ちの版がある間は、description を概要に追従させない。
  // 乗っ取ったアカウントで、新しい版と同時に概要へ誘導の文言を書く経路を止めるため。
  const newRelease =
    latest?.release !== null && latest?.release !== undefined && latest.release.id !== row.latest_release_id;
  const freezeSummary = row.has_pending === 1 || newRelease;
  statements.push(
    // 概要は description が空でなければ追従させ、空なら登録時の概要 (README から作ったものを含む) を残す。
    env.DB.prepare(
      'UPDATE plugins SET owner = ?, repo = ?, license_spdx = COALESCE(?, license_spdx), summary = COALESCE(?, summary), removed = 0 WHERE id = ?',
    ).bind(
      repo.owner.login,
      repo.name,
      // 登録時と同じく NOASSERTION はライセンスとみなさず、保存している値を残す。
      repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : null,
      freezeSummary ? null : repo.description?.trim() || null,
      row.id,
    ),
  );
  // 名前の変更と移管では、変わる前の URL の ID を記録し、旧い URL から転送できるようにする。
  const previousSlug = `${row.owner}/${row.repo}`.toLowerCase();
  if (previousSlug !== `${repo.owner.login}/${repo.name}`.toLowerCase()) {
    statements.push(
      env.DB.prepare('INSERT OR IGNORE INTO plugin_aliases (alias, plugin_id, created_at) VALUES (?, ?, ?)').bind(
        previousSlug,
        row.id,
        timestamp,
      ),
    );
  }
  let latestTag = row.latest_tag;
  if (latest?.release) {
    const saved = await releaseStatements(env, budget, github, row.id, repo.owner.login, repo.name, latest.release);
    if (saved.length > 0) latestTag = latest.release.tag_name;
    statements.push(...saved);
    statements.push(env.DB.prepare('UPDATE plugins SET releases_etag = ? WHERE id = ?').bind(latest.etag, row.id));
  }
  // 画像は最新リリースのタグの時点のものを使う。タグが変わったときだけ取得し直し、外部呼び出しを抑える。
  if (latestTag && latestTag !== row.images_tag) {
    statements.push(...(await imageStatements(env, budget, github, row.id, repo.owner.login, repo.name, latestTag)));
  }
  if (latestTag) {
    statements.push(
      ...(await obsVersionStatements(env, budget, github, row.id, repo.owner.login, repo.name, latestTag)),
    );
  }
  statements.push(
    env.DB.prepare('UPDATE plugins SET updated_at = ?, last_synced_at = ? WHERE id = ?').bind(
      timestamp,
      timestamp,
      row.id,
    ),
  );
  budget.takeD1Query();
  await env.DB.batch(statements);
}

async function releaseStatements(
  env: Env,
  budget: Budget,
  github: GitHubClient,
  pluginId: string,
  owner: string,
  repo: string,
  release: GitHubRelease,
): Promise<D1PreparedStatement[]> {
  const assets = release.assets.filter((asset) => asset.digest?.startsWith('sha256:'));
  if (release.draft || !release.published_at || assets.length === 0 || !TAG.test(release.tag_name)) return [];
  budget.takeD1Query();
  const known = await env.DB.prepare(
    'SELECT a.github_asset_id AS id, a.digest FROM assets a JOIN releases r ON r.github_release_id = a.release_id WHERE r.plugin_id = ?',
  )
    .bind(pluginId)
    .all<{ id: number; digest: string }>();
  const knownKeys = new Set(known.results.map((row) => `${row.id}:${row.digest}`));
  const commitSha = await github.getCommitSha(owner, repo, release.tag_name);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (github_release_id) DO UPDATE SET tag = excluded.tag, name = excluded.name,
         commit_sha = excluded.commit_sha, html_url = excluded.html_url`,
    ).bind(release.id, pluginId, release.tag_name, release.name, commitSha, release.published_at, release.html_url),
    // 新しい版の検査の行。差分の起点とレビューは定期処理の新しい版の検査で決める (ADR 0013)。
    env.DB.prepare(
      `INSERT INTO release_checks (github_release_id, immutable) VALUES (?, ?)
       ON CONFLICT (github_release_id) DO UPDATE SET immutable = excluded.immutable`,
    ).bind(release.id, release.immutable === true ? 1 : 0),
    // リリースから外された配布物は掲載対象から外す。
    env.DB.prepare(
      `DELETE FROM assets WHERE release_id = ? AND github_asset_id NOT IN (${assets.map(() => '?').join(', ')})`,
    ).bind(release.id, ...assets.map((asset) => asset.id)),
  ];
  for (const asset of assets) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO assets (github_asset_id, release_id, name, size, digest, download_url, os) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (github_asset_id) DO UPDATE SET name = excluded.name, size = excluded.size, digest = excluded.digest,
           download_url = excluded.download_url, os = excluded.os`,
      ).bind(
        asset.id,
        release.id,
        asset.name,
        asset.size,
        asset.digest,
        asset.browser_download_url,
        inferOs(asset.name),
      ),
    );
    // 新しく現れた配布物 (新しいアセット、または digest の変化) は、同じ digest の過去の結果があっても照会し直す。
    // 既知の配布物はダウンロード数の変化などで ETag が変わっても照会し直さず、照会の上限を使い切らないようにする。
    if (!knownKeys.has(`${asset.id}:${asset.digest}`)) {
      statements.push(...resetScanStatements(env, asset.digest as string));
      statements.push(resetAttestationStatement(env, asset.id));
    }
  }
  return statements;
}

const BUILDSPEC_MAX_BYTES = 64 * 1024;
const OBS_VERSION = /^\d{1,3}\.\d{1,3}(\.\d{1,3})?$/;

// buildspec.json の dependencies.obs-studio.version を読む。形の合わない値は外部データとして捨てる。
export function parseObsBuildVersion(bytes: Uint8Array | null): string {
  if (!bytes) return '';
  try {
    const spec = JSON.parse(new TextDecoder().decode(bytes)) as {
      dependencies?: { 'obs-studio'?: { version?: unknown } };
    };
    const version = spec.dependencies?.['obs-studio']?.version;
    return typeof version === 'string' && OBS_VERSION.test(version) ? version : '';
  } catch {
    return '';
  }
}

// 最新リリースのタグの時点の buildspec.json から、ビルドに使った OBS の版を取得する。リリースごとに 1 回だけ取得する。
async function obsVersionStatements(
  env: Env,
  budget: Budget,
  github: GitHubClient,
  pluginId: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<D1PreparedStatement[]> {
  budget.takeD1Query();
  const release = await env.DB.prepare(
    'SELECT github_release_id, obs_build_version FROM releases WHERE plugin_id = ? AND tag = ?',
  )
    .bind(pluginId, tag)
    .first<{ github_release_id: number; obs_build_version: string | null }>();
  // 同じ同期で追加したリリースはまだ書き込まれていないため、次の同期で取得する。
  if (!release || release.obs_build_version !== null) return [];
  let bytes: Uint8Array | null = null;
  try {
    bytes = await github.getFileBytes(owner, repo, '', 'buildspec.json', tag, BUILDSPEC_MAX_BYTES);
  } catch (error) {
    if (!(error instanceof GitHubError && error.kind === 'not_found')) throw error;
  }
  return [
    env.DB.prepare('UPDATE releases SET obs_build_version = ? WHERE github_release_id = ?').bind(
      parseObsBuildVersion(bytes),
      release.github_release_id,
    ),
  ];
}

const IMAGE_DIR = '.soko-kun';

async function imageStatements(
  env: Env,
  budget: Budget,
  github: GitHubClient,
  pluginId: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<D1PreparedStatement[]> {
  const entries = (await github.listDirectory(owner, repo, IMAGE_DIR, tag)) ?? [];
  budget.takeD1Query();
  const stored = await env.DB.prepare('SELECT kind, blob_sha FROM plugin_images WHERE plugin_id = ?')
    .bind(pluginId)
    .all<{ kind: ImageKind; blob_sha: string }>();
  const storedSha = new Map(stored.results.map((row) => [row.kind, row.blob_sha]));
  const statements: D1PreparedStatement[] = [];
  const remove = (kind: ImageKind) =>
    env.DB.prepare('DELETE FROM plugin_images WHERE plugin_id = ? AND kind = ?').bind(pluginId, kind);
  for (const kind of ['logo', 'image'] as const) {
    const entry = entries.find((item) => item.type === 'file' && expectedType(kind, item.name));
    if (!entry) {
      statements.push(remove(kind));
      continue;
    }
    if (storedSha.get(kind) === entry.sha) continue;
    // 一覧の大きさで上限を超えるものは、ダウンロードせずに外す。
    const bytes =
      entry.size <= IMAGE_LIMITS[kind].maxBytes
        ? await github.getFileBytes(owner, repo, IMAGE_DIR, entry.name, tag, IMAGE_LIMITS[kind].maxBytes)
        : null;
    const info = bytes ? checkImage(kind, entry.name, bytes) : null;
    if (!bytes || !info) {
      statements.push(remove(kind));
      continue;
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (plugin_id, kind) DO UPDATE SET blob_sha = excluded.blob_sha, content_type = excluded.content_type,
           width = excluded.width, height = excluded.height, bytes = excluded.bytes, fetched_at = excluded.fetched_at`,
      ).bind(pluginId, kind, entry.sha, info.type, info.width, info.height, bytes, now()),
    );
  }
  statements.push(env.DB.prepare('UPDATE plugins SET images_tag = ? WHERE id = ?').bind(tag, pluginId));
  return statements;
}

export function resetScanStatements(env: Env, digest: string): D1PreparedStatement[] {
  return (['malwarebazaar'] as const).map((scanner) =>
    env.DB.prepare(
      `INSERT INTO scans (digest, scanner, result) VALUES (?, ?, 'pending')
       ON CONFLICT (digest, scanner) DO UPDATE SET result = 'pending', detail = NULL, attempts = 0, scanned_at = NULL`,
    ).bind(digest, scanner),
  );
}

// 新しく現れた配布物は、証明を検証し直す。署名の検証は GitHub Actions が行う (ADR 0014)。
export function resetAttestationStatement(env: Env, assetId: number): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO attestation_checks (github_asset_id, result) VALUES (?, 'pending')
     ON CONFLICT (github_asset_id) DO UPDATE SET result = 'pending', reason = NULL, signer_workflow = NULL, attempts = 0,
       checked_at = NULL`,
  ).bind(assetId);
}

async function runSync(env: Env, budget: Budget, report: CronReport): Promise<void> {
  const github = new GitHubClient(budget, {
    kind: 'app',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });
  budget.takeD1Query();
  const { results } = await env.DB.prepare(
    // 掲載終了のプラグインも同期し、GitHub で公開に戻れば掲載の判定へ戻す。一時的な 404 で恒久に外さないため。
    `SELECT p.id, p.github_repo_id, p.owner, p.repo, p.releases_etag, p.images_tag,
       (SELECT r.tag FROM releases r WHERE r.plugin_id = p.id ORDER BY r.published_at DESC LIMIT 1) AS latest_tag,
       (SELECT r.github_release_id FROM releases r WHERE r.plugin_id = p.id ORDER BY r.published_at DESC LIMIT 1)
         AS latest_release_id,
       EXISTS (SELECT 1 FROM releases r JOIN release_checks c ON c.github_release_id = r.github_release_id
         WHERE r.plugin_id = p.id AND c.legacy = 0
           AND NOT EXISTS (SELECT 1 FROM listing_periods l WHERE l.github_release_id = r.github_release_id)
           AND NOT EXISTS (SELECT 1 FROM release_suspensions s WHERE s.github_release_id = r.github_release_id)
           AND r.published_at > COALESCE((SELECT max(r2.published_at) FROM releases r2
             JOIN listing_periods l2 ON l2.github_release_id = r2.github_release_id WHERE r2.plugin_id = p.id), '')
       ) AS has_pending
     FROM plugins p ORDER BY p.last_synced_at LIMIT 20`,
  ).all<SyncRow>();
  for (const row of results) {
    if (!budget.canFetch(SYNC_COST) || !budget.canQuery(3)) break;
    try {
      await syncOne(env, budget, github, row);
      report.synced += 1;
    } catch (error) {
      // GitHub の障害やレート制限では、そのプラグインを更新せずに次回へ回す。既存の正常な情報は変えない。
      if (error instanceof GitHubError && (error.kind === 'rate_limited' || error.kind === 'unavailable')) {
        report.stoppedBy = `github_${error.kind}`;
        break;
      }
      // そのプラグインに固有の失敗 (403 など) は、同期済みの時刻だけ進めて次へ回す。
      // 毎回先頭で失敗して、ほかのプラグインの同期が止まり続けないようにするため。
      if (error instanceof GitHubError && budget.canQuery()) {
        budget.takeD1Query();
        await env.DB.prepare('UPDATE plugins SET last_synced_at = ? WHERE id = ?').bind(now(), row.id).run();
        report.failed += 1;
        continue;
      }
      throw error;
    }
  }
}

export const DOWNLOADS_PER_RUN = 10;
const SNAPSHOT_RETENTION_DAYS = 15;

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

// プラグインごとに 1 日 1 回、すべてのリリースの配布物のダウンロード数の合計を記録する。
async function runDownloads(env: Env, budget: Budget, report: CronReport, today = new Date()): Promise<void> {
  const github = new GitHubClient(budget, {
    kind: 'app',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });
  const day = dayOf(today);
  budget.takeD1Query();
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.owner, p.repo, (SELECT max(d.day) FROM download_snapshots d WHERE d.plugin_id = p.id) AS last_day
     FROM plugins p WHERE p.removed = 0 AND (last_day IS NULL OR last_day < ?)
     ORDER BY last_day IS NOT NULL, last_day LIMIT ?`,
  )
    .bind(day, DOWNLOADS_PER_RUN)
    .all<{ id: string; owner: string; repo: string }>();
  const statements: D1PreparedStatement[] = [];
  for (const row of results) {
    if (!budget.canFetch()) break;
    try {
      const releases = await github.listReleases(row.owner, row.repo);
      const total = releases
        .filter((release) => !release.draft)
        .flatMap((release) => release.assets)
        .reduce((sum, asset) => sum + (asset.download_count ?? 0), 0);
      statements.push(
        env.DB.prepare(
          'INSERT INTO download_snapshots (plugin_id, day, total) VALUES (?, ?, ?) ON CONFLICT (plugin_id, day) DO UPDATE SET total = excluded.total',
        ).bind(row.id, day, total),
      );
    } catch (error) {
      if (error instanceof GitHubError && (error.kind === 'rate_limited' || error.kind === 'unavailable')) {
        report.stoppedBy = `github_${error.kind}`;
        break;
      }
      // そのプラグインに固有の失敗は記録せず、次回の起動で処理する。
      if (error instanceof GitHubError) continue;
      throw error;
    }
  }
  if (statements.length === 0) return;
  const cutoff = dayOf(new Date(today.getTime() - SNAPSHOT_RETENTION_DAYS * 86_400_000));
  statements.push(env.DB.prepare('DELETE FROM download_snapshots WHERE day < ?').bind(cutoff));
  budget.takeD1Query();
  await env.DB.batch(statements);
  report.downloadsRecorded = statements.length - 1;
}

// 掲載の期間と、マルウェアを検出した版を記録する。どちらの表も行を削除しない (ADR 0013)。
export async function recordListings(env: Env, budget: Budget): Promise<void> {
  if (!budget.canQuery(3)) return;
  const timestamp = now();
  budget.takeD1Query();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO release_suspensions (plugin_id, github_release_id, tag, reason, suspended_at)
     SELECT DISTINCT r.plugin_id, r.github_release_id, r.tag, 'malicious', ?
     FROM releases r JOIN assets a ON a.release_id = r.github_release_id
     JOIN scans s ON s.digest = a.digest AND s.scanner = 'malwarebazaar' AND s.result = 'malicious'`,
  )
    .bind(timestamp)
    .run();
  budget.takeD1Query();
  const views = await loadAllViews(env);
  const statements: D1PreparedStatement[] = [];
  for (const view of views) {
    const listed = view.status === 'listed' ? view.listedRelease : null;
    // 掲載対象が変わった、または掲載をやめたプラグインの、それまでの期間を閉じる。
    statements.push(
      env.DB.prepare(
        'UPDATE listing_periods SET ended_at = ? WHERE plugin_id = ? AND ended_at IS NULL AND github_release_id != ?',
      ).bind(timestamp, view.internalId, listed?.githubReleaseId ?? -1),
    );
    for (const asset of listed?.assets ?? []) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO listing_periods (plugin_id, github_release_id, digest, tag, asset_name, started_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (github_release_id, digest) DO UPDATE SET ended_at = NULL`,
        ).bind(view.internalId, listed?.githubReleaseId, asset.digest, listed?.tag, asset.name, timestamp),
      );
    }
  }
  if (statements.length === 0) return;
  budget.takeD1Query();
  await env.DB.batch(statements);
}

export async function runCron(env: Env, budget = new Budget()): Promise<CronReport> {
  const report: CronReport = {
    scanned: 0,
    synced: 0,
    failed: 0,
    translated: 0,
    previews: 0,
    downloadsRecorded: 0,
    subrequests: 0,
    d1Queries: 0,
  };
  try {
    await runScans(env, budget, report);
    await runSync(env, budget, report);
    if (!report.stoppedBy) {
      try {
        report.releasesChecked = await runReleaseChecks(env, budget);
      } catch (error) {
        if (!(error instanceof GitHubError)) throw error;
        report.stoppedBy = `github_${error.kind}`;
      }
    }
    await recordListings(env, budget);
    if (!report.stoppedBy) await runDownloads(env, budget, report);
    report.translated = await runTranslations(env, budget);
    report.previews = await runPreviews(env, budget);
  } catch (error) {
    if (!(error instanceof BudgetExceededError)) throw error;
    report.stoppedBy = `budget_${error.kind}`;
  }
  report.subrequests = budget.subrequests;
  report.d1Queries = budget.d1Queries;
  return report;
}
