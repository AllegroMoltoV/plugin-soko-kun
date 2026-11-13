// 掲載状態の算出。状態は保存せず、検査結果と管理操作から毎回求める (ADR 0004)。
// 照会先は MalwareBazaar だけ (ADR 0012)。新しい版には、証明・不変・配布の形・差分の検査・レビューの条件を加える (ADR 0013)。
export type Scanner = 'malwarebazaar';
export type ScanResult = 'pending' | 'malicious' | 'not_found' | 'error';
export type PluginStatus = 'listed' | 'pending' | 'suspended' | 'removed';

export type AttestationResult = 'pending' | 'passed' | 'failed' | 'error';
export type DiffState = 'pending' | 'passed' | 'held' | 'skipped' | 'error';
export type ConfigState = 'pending' | 'ok' | 'missing' | 'invalid' | 'no_declared_assets';
export type ReviewState = 'pending' | 'done' | 'failed';

// レビューは 2 回まで試み、2 回失敗した版は管理者の判断を待つ。
export const MAX_REVIEW_ATTEMPTS = 2;

export interface ReleaseChecks {
  legacy: boolean;
  immutable: boolean;
  diffState: DiffState;
  configState: ConfigState;
  reviewState: ReviewState;
  reviewAttempts: number;
  reviewSerious: number;
  adminApproved: boolean;
}

export interface AssetForStatus {
  name: string;
  digest: string;
  os: string | null;
  attestation?: AttestationResult;
}

export interface ReleaseForStatus {
  githubReleaseId: number;
  publishedAt: string;
  assets: AssetForStatus[];
  // 検査の行が無いリリースは、どの条件も確かめていないものとして掲載しない。
  checks?: ReleaseChecks;
  suspended?: boolean;
}

export interface PluginForStatus {
  adminSuspended: boolean;
  removed: boolean;
}

export type ScanLookup = (digest: string, scanner: Scanner) => ScanResult | undefined;

// 掲載を止めている理由。waitsFor は、作者が直すもの、管理者の確認を待つもの、本サービスの処理を待つもの。
export type BlockerCode =
  | 'no_assets'
  | 'scan_pending'
  | 'release_suspended'
  | 'checks_missing'
  | 'not_immutable'
  | 'installer_not_allowed'
  | 'attestation_pending'
  | 'attestation_failed'
  | 'config_pending'
  | 'config_invalid'
  | 'config_no_declared_assets'
  | 'diff_pending'
  | 'diff_held'
  | 'diff_error'
  | 'review_pending'
  | 'review_failed'
  | 'review_serious';

export type WaitsFor = 'author' | 'admin' | 'system';

export const BLOCKER_WAITS_FOR: Record<BlockerCode, WaitsFor> = {
  no_assets: 'author',
  scan_pending: 'system',
  release_suspended: 'admin',
  checks_missing: 'system',
  not_immutable: 'author',
  installer_not_allowed: 'author',
  attestation_pending: 'system',
  attestation_failed: 'author',
  config_pending: 'system',
  config_invalid: 'author',
  config_no_declared_assets: 'author',
  diff_pending: 'system',
  diff_held: 'admin',
  diff_error: 'admin',
  review_pending: 'system',
  review_failed: 'admin',
  review_serious: 'admin',
};

export interface StatusResult {
  status: PluginStatus;
  reason?: 'admin' | 'removed' | 'malicious';
  // 検査を通った最新のリリース。掲載中のときだけ値を持つ。
  listedReleaseId?: number;
  // 掲載対象より新しく、条件を満たしていないリリース。作者向けの表示にだけ使う。
  pendingReleaseIds: number[];
}

const INSTALLER = /\.(exe|msi)$/i;

export function hasInstaller(assets: AssetForStatus[]): boolean {
  return assets.some((asset) => INSTALLER.test(asset.name));
}

// リリースの掲載を止めている理由を、すべて挙げる。空なら掲載できる。
export function releaseBlockers(release: ReleaseForStatus, lookup: ScanLookup): BlockerCode[] {
  const blockers: BlockerCode[] = [];
  if (release.assets.length === 0) blockers.push('no_assets');
  // MalwareBazaar は既知のマルウェアだけを収録するため、未登録は既知のマルウェアに該当しないことを意味する (ADR 0005)。
  if (!release.assets.every((asset) => lookup(asset.digest, 'malwarebazaar') === 'not_found')) {
    blockers.push('scan_pending');
  }
  if (release.suspended) blockers.push('release_suspended');
  const checks = release.checks;
  if (!checks) {
    blockers.push('checks_missing');
    return blockers;
  }
  if (checks.legacy) return blockers;

  if (!checks.immutable) blockers.push('not_immutable');
  if (hasInstaller(release.assets)) blockers.push('installer_not_allowed');
  const attestations = release.assets.map((asset) => asset.attestation ?? 'pending');
  if (attestations.some((result) => result === 'failed')) blockers.push('attestation_failed');
  else if (attestations.some((result) => result !== 'passed')) blockers.push('attestation_pending');

  if (checks.configState === 'pending') blockers.push('config_pending');
  if (checks.configState === 'invalid') blockers.push('config_invalid');
  if (checks.configState === 'no_declared_assets') blockers.push('config_no_declared_assets');

  if (!checks.adminApproved) {
    if (checks.diffState === 'pending') blockers.push('diff_pending');
    if (checks.diffState === 'held') blockers.push('diff_held');
    if (checks.diffState === 'error') blockers.push('diff_error');
    if (checks.reviewState === 'pending') blockers.push('review_pending');
    if (checks.reviewState === 'failed') {
      blockers.push(checks.reviewAttempts >= MAX_REVIEW_ATTEMPTS ? 'review_failed' : 'review_pending');
    }
    if (checks.reviewState === 'done' && checks.reviewSerious > 0) blockers.push('review_serious');
  }
  return blockers;
}

export function computeStatus(plugin: PluginForStatus, releases: ReleaseForStatus[], lookup: ScanLookup): StatusResult {
  if (plugin.adminSuspended) return { status: 'suspended', reason: 'admin', pendingReleaseIds: [] };
  if (plugin.removed) return { status: 'removed', reason: 'removed', pendingReleaseIds: [] };

  const hasMalicious = releases.some((release) =>
    release.assets.some((asset) => lookup(asset.digest, 'malwarebazaar') === 'malicious'),
  );
  if (hasMalicious) return { status: 'suspended', reason: 'malicious', pendingReleaseIds: [] };

  const newestFirst = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const pendingReleaseIds: number[] = [];
  for (const release of newestFirst) {
    if (releaseBlockers(release, lookup).length === 0) {
      return { status: 'listed', listedReleaseId: release.githubReleaseId, pendingReleaseIds };
    }
    pendingReleaseIds.push(release.githubReleaseId);
  }
  return { status: 'pending', pendingReleaseIds };
}
