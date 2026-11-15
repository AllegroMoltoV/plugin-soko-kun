// 掲載状態の算出。状態は保存せず、検査結果と管理操作から毎回求める (ADR 0004)。
// 照会先は MalwareBazaar だけ (ADR 0012)。新しい版には、証明・不変・配布の形・差分の検査・レビューの条件を加える (ADR 0013)。
export type Scanner = 'malwarebazaar';
export type ScanResult = 'pending' | 'malicious' | 'not_found' | 'error';
export type PluginStatus = 'listed' | 'pending' | 'suspended' | 'removed';

// exhausted は保存する値ではなく、error のまま試行を使い切った配布物を読み出すときの値 (attestationResultSql)。
export type AttestationResult = 'pending' | 'passed' | 'failed' | 'error' | 'exhausted';

// 証明の検証は error のとき MAX_ATTESTATION_ATTEMPTS 回まで試み、使い切った配布物は検証待ちから外れて管理者を待つ。
export const MAX_ATTESTATION_ATTEMPTS = 5;

// attestation_checks を別名 t で読むときの、作者と算出規則に渡す結果の式。
export const attestationResultSql = `CASE WHEN t.result = 'error' AND t.attempts >= ${MAX_ATTESTATION_ATTEMPTS} THEN 'exhausted' ELSE t.result END`;
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
  // 照合の後に本文が編集され、新しい本文が案内の型に当たった (release_checks.notes_held)。
  notesHeld?: boolean;
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
  // プラグインの所有者が変わり、管理者がまだ版を承認していない (ADR 0015)。
  ownerChanged?: boolean;
  // 掲載の後に既定のブランチの README へ新しい案内が足された (plugins.readme_held)。プラグインのどの版にも付く。
  readmeHeld?: boolean;
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
  | 'attestation_retries_exhausted'
  | 'config_pending'
  | 'config_invalid'
  | 'config_no_declared_assets'
  | 'diff_pending'
  | 'diff_held'
  | 'owner_changed'
  | 'diff_error'
  | 'review_pending'
  | 'review_failed'
  | 'review_serious'
  | 'notes_held'
  | 'readme_held';

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
  attestation_retries_exhausted: 'admin',
  config_pending: 'system',
  config_invalid: 'author',
  config_no_declared_assets: 'author',
  diff_pending: 'system',
  diff_held: 'admin',
  owner_changed: 'admin',
  diff_error: 'admin',
  review_pending: 'system',
  review_failed: 'admin',
  review_serious: 'admin',
  notes_held: 'admin',
  readme_held: 'admin',
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
  // 版の承認では解かず、検査の前提を持たない旧い版 (legacy) にも付ける。旧い版や、案内を README に残したまま出した
  // 新しい版に掲載が移らないようにするため。
  if (release.readmeHeld) blockers.push('readme_held');
  const checks = release.checks;
  if (!checks) {
    blockers.push('checks_missing');
    return blockers;
  }
  if (checks.legacy) return blockers;

  if (!checks.immutable) blockers.push('not_immutable');
  if (hasInstaller(release.assets)) blockers.push('installer_not_allowed');
  const attestations = release.assets.map((asset) => asset.attestation ?? 'pending');
  // 試行を使い切った配布物は誰も検証し直さないため、本サービスの処理待ちではなく管理者の待ちとして返す。
  if (attestations.some((result) => result === 'failed')) blockers.push('attestation_failed');
  else if (attestations.some((result) => result === 'exhausted')) blockers.push('attestation_retries_exhausted');
  else if (attestations.some((result) => result !== 'passed')) blockers.push('attestation_pending');

  if (checks.configState === 'pending') blockers.push('config_pending');
  if (checks.configState === 'invalid') blockers.push('config_invalid');
  if (checks.configState === 'no_declared_assets') blockers.push('config_no_declared_assets');

  if (!checks.adminApproved) {
    if (checks.diffState === 'pending') blockers.push('diff_pending');
    if (checks.diffState === 'held') blockers.push('diff_held');
    if (release.ownerChanged) blockers.push('owner_changed');
    if (checks.diffState === 'error') blockers.push('diff_error');
    if (checks.reviewState === 'pending') blockers.push('review_pending');
    if (checks.reviewState === 'failed') {
      blockers.push(checks.reviewAttempts >= MAX_REVIEW_ATTEMPTS ? 'review_failed' : 'review_pending');
    }
    if (checks.reviewState === 'done' && checks.reviewSerious > 0) blockers.push('review_serious');
    if (checks.notesHeld) blockers.push('notes_held');
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
