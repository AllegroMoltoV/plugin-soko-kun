// ライセンスの判定 (docs/design/scanning.md の「ライセンスの判定」)。版ごとに、その版のタグが指すコミットの時点のライセンスで判定する。
// 判定に LLM は使わない。LICENSE の本文は攻撃者が書ける外部データのため。
import type { GitHubClient } from '../github';
import openLicenses from './spdx-open-licenses.json';
import type { LicenseState } from './status';

// SPDX License List の固定した版で、isOsiApproved か isFsfLibre が true の識別子。scripts/spdx-open-licenses.mjs で作る。
const OPEN_LICENSES: ReadonlySet<string> = new Set(openLicenses.ids);

export type LicenseFailure = Exclude<LicenseState, 'pending' | 'passed'>;

// ライセンスが無いか、OSI/FSF の集合に入らないときの直し方。OBS のプラグインは libobs に合わせる。
export const LICENSE_FIX =
  'Put a LICENSE file with a license approved by the OSI or certified as free by the FSF at the root of the repository, then publish a new release. OBS Studio plugins link with libobs, so use GPL-2.0-or-later or a license compatible with it.';

// GitHub が検出した SPDX 識別子 (ライセンスのファイルが無ければ null) を判定する。
export function judgeLicense(spdx: string | null): Exclude<LicenseState, 'pending'> {
  if (spdx === null) return 'no_license';
  if (spdx === 'NOASSERTION') return 'license_unrecognized';
  return OPEN_LICENSES.has(spdx) ? 'passed' : 'license_not_open';
}

// コミットの時点のライセンスを取得して判定する。外部呼び出しは 1 件。
export async function licenseAtCommit(
  github: GitHubClient,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<{ state: Exclude<LicenseState, 'pending'>; spdx: string | null }> {
  const spdx = await github.getLicenseSpdx(owner, repo, commitSha);
  return { state: judgeLicense(spdx), spdx };
}
