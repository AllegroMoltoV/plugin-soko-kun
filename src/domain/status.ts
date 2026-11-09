// 掲載状態の算出。状態は保存せず、検査結果と管理操作から毎回求める。
// 照会先は MalwareBazaar だけ (ADR 0012)。
export type Scanner = 'malwarebazaar';
export type ScanResult = 'pending' | 'malicious' | 'not_found' | 'error';
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

export interface StatusResult {
  status: PluginStatus;
  reason?: 'admin' | 'removed' | 'malicious';
  // 検査を通った最新のリリース。掲載中のときだけ値を持つ。
  listedReleaseId?: number;
  // 掲載対象より新しく、検査が終わっていないリリース。
  pendingReleaseIds: number[];
}

// MalwareBazaar は既知のマルウェアだけを収録するため、未登録は既知のマルウェアに該当しないことを意味する (ADR 0005)。
export function isReleaseInspected(release: ReleaseForStatus, lookup: ScanLookup): boolean {
  if (release.digests.length === 0) return false;
  return release.digests.every((digest) => lookup(digest, 'malwarebazaar') === 'not_found');
}

export function computeStatus(plugin: PluginForStatus, releases: ReleaseForStatus[], lookup: ScanLookup): StatusResult {
  if (plugin.adminSuspended) return { status: 'suspended', reason: 'admin', pendingReleaseIds: [] };
  if (plugin.removed) return { status: 'removed', reason: 'removed', pendingReleaseIds: [] };

  const hasMalicious = releases.some((release) =>
    release.digests.some((digest) => lookup(digest, 'malwarebazaar') === 'malicious'),
  );
  if (hasMalicious) return { status: 'suspended', reason: 'malicious', pendingReleaseIds: [] };

  const newestFirst = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const pendingReleaseIds: number[] = [];
  for (const release of newestFirst) {
    if (isReleaseInspected(release, lookup)) {
      return { status: 'listed', listedReleaseId: release.githubReleaseId, pendingReleaseIds };
    }
    pendingReleaseIds.push(release.githubReleaseId);
  }
  return { status: 'pending', pendingReleaseIds };
}
