// 掲載状態の算出。状態は保存せず、検査結果と管理操作から毎回求める。
export type Scanner = 'virustotal' | 'malwarebazaar';
export type ScanResult = 'pending' | 'clean' | 'malicious' | 'not_found' | 'error';
export type PluginStatus = 'listed' | 'pending' | 'suspended' | 'removed';

export interface ReleaseForStatus {
  githubReleaseId: number;
  publishedAt: string;
  digests: string[];
}

export interface PluginForStatus {
  adminSuspended: boolean;
  removed: boolean;
}

export type ScanLookup = (digest: string, scanner: Scanner) => ScanResult | undefined;

export interface StatusPolicy {
  // VirusTotal に未登録のハッシュの扱い。依頼者の判断待ちのため、既定では検査済みとみなさない。
  virustotalNotFound: 'unverified' | 'clean';
}

export const DEFAULT_POLICY: StatusPolicy = { virustotalNotFound: 'unverified' };

export interface StatusResult {
  status: PluginStatus;
  reason?: 'admin' | 'removed' | 'malicious';
  // 検査を通った最新のリリース。掲載中のときだけ値を持つ。
  listedReleaseId?: number;
  // 掲載対象より新しく、検査が終わっていないリリース。
  pendingReleaseIds: number[];
}

function isCleanEquivalent(scanner: Scanner, result: ScanResult | undefined, policy: StatusPolicy): boolean {
  if (result === 'clean') return true;
  if (result !== 'not_found') return false;
  // MalwareBazaar は既知のマルウェアだけを収録するため、未登録は該当なしを意味する。
  if (scanner === 'malwarebazaar') return true;
  return policy.virustotalNotFound === 'clean';
}

export function isReleaseInspected(release: ReleaseForStatus, lookup: ScanLookup, policy: StatusPolicy): boolean {
  if (release.digests.length === 0) return false;
  return release.digests.every(
    (digest) =>
      isCleanEquivalent('virustotal', lookup(digest, 'virustotal'), policy) &&
      isCleanEquivalent('malwarebazaar', lookup(digest, 'malwarebazaar'), policy),
  );
}

export function computeStatus(
  plugin: PluginForStatus,
  releases: ReleaseForStatus[],
  lookup: ScanLookup,
  policy: StatusPolicy = DEFAULT_POLICY,
): StatusResult {
  if (plugin.adminSuspended) return { status: 'suspended', reason: 'admin', pendingReleaseIds: [] };
  if (plugin.removed) return { status: 'removed', reason: 'removed', pendingReleaseIds: [] };

  const hasMalicious = releases.some((release) =>
    release.digests.some(
      (digest) => lookup(digest, 'virustotal') === 'malicious' || lookup(digest, 'malwarebazaar') === 'malicious',
    ),
  );
  if (hasMalicious) return { status: 'suspended', reason: 'malicious', pendingReleaseIds: [] };

  const newestFirst = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const pendingReleaseIds: number[] = [];
  for (const release of newestFirst) {
    if (isReleaseInspected(release, lookup, policy)) {
      return { status: 'listed', listedReleaseId: release.githubReleaseId, pendingReleaseIds };
    }
    pendingReleaseIds.push(release.githubReleaseId);
  }
  return { status: 'pending', pendingReleaseIds };
}
