// 掲載状態の境界。危険側 (検査前の配布物を掲載する、停止を解除してしまう、条件を満たさない新しい版を掲載する) に倒れる経路だけを確かめる。
import { describe, expect, it } from 'vitest';
import {
  BLOCKER_WAITS_FOR,
  computeStatus,
  MAX_SCAN_ATTEMPTS,
  type ReleaseChecks,
  type ReleaseForStatus,
  releaseBlockers,
  type ScanLookup,
  type ScanResult,
} from '../../src/domain/status';

const active = { adminSuspended: false, removed: false };
const legacy: ReleaseChecks = {
  legacy: true,
  immutable: false,
  diffState: 'skipped',
  configState: 'missing',
  licenseState: 'passed',
  reviewState: 'done',
  reviewAttempts: 0,
  reviewSerious: 0,
  adminApproved: false,
};
// 新しい条件をすべて満たした新しい版。
const passing: ReleaseChecks = {
  legacy: false,
  immutable: true,
  diffState: 'passed',
  configState: 'ok',
  licenseState: 'passed',
  reviewState: 'done',
  reviewAttempts: 1,
  reviewSerious: 0,
  adminApproved: false,
};
const older: ReleaseForStatus = {
  githubReleaseId: 1,
  publishedAt: '2026-10-01T00:00:00Z',
  assets: [{ name: 'plugin-1.0.0-windows-x64.zip', digest: 'sha256:old', os: 'windows' }],
  checks: legacy,
};
const newer: ReleaseForStatus = {
  githubReleaseId: 2,
  publishedAt: '2026-11-01T00:00:00Z',
  assets: [{ name: 'plugin-1.0.1-windows-x64.zip', digest: 'sha256:new', os: 'windows', attestation: 'passed' }],
  checks: passing,
};
const clean = lookupFrom({ 'sha256:old': 'not_found', 'sha256:new': 'not_found' });

// 値が結果だけなら、続けて失敗した回数 (attempts) を 1 とする。表に無い digest は結果の行が無いものとする。
function lookupFrom(table: Record<string, ScanResult | { result: ScanResult; attempts: number }>): ScanLookup {
  return (digest) => {
    const value = table[digest];
    return typeof value === 'string' ? { result: value, attempts: 1 } : value;
  };
}

function withChecks(changes: Partial<ReleaseChecks>, release: ReleaseForStatus = newer): ReleaseForStatus {
  return { ...release, checks: { ...passing, ...changes } };
}

describe('computeStatus', () => {
  it('検査が終わっていないリリースしか無ければ掲載しない', () => {
    const result = computeStatus(active, [newer], lookupFrom({ 'sha256:new': 'pending' }));
    expect(result.status).toBe('pending');
  });

  it('MalwareBazaar の未登録は既知のマルウェアに該当しないとして掲載する', () => {
    const result = computeStatus(active, [newer], clean);
    expect(result).toMatchObject({ status: 'listed', listedReleaseId: 2 });
  });

  it('検査の失敗は検査済みとしない', () => {
    const result = computeStatus(active, [newer], lookupFrom({ 'sha256:new': 'error' }));
    expect(result.status).toBe('pending');
  });

  it('新しいリリースの検査中は、検査を通った前のリリースを掲載対象にする', () => {
    const result = computeStatus(
      active,
      [older, newer],
      lookupFrom({ 'sha256:old': 'not_found', 'sha256:new': 'pending' }),
    );
    expect(result).toEqual({ status: 'listed', listedReleaseId: 1, pendingReleaseIds: [2] });
  });

  it('どのリリースでも malicious が出たら停止する', () => {
    const result = computeStatus(
      active,
      [older, newer],
      lookupFrom({ 'sha256:old': 'malicious', 'sha256:new': 'not_found' }),
    );
    expect(result).toMatchObject({ status: 'suspended', reason: 'malicious' });
  });

  it('管理者の停止は検査結果に関わらず維持する', () => {
    const result = computeStatus({ adminSuspended: true, removed: false }, [newer], clean);
    expect(result).toMatchObject({ status: 'suspended', reason: 'admin' });
  });

  it('GitHub で消えたリポジトリは掲載終了にする', () => {
    const result = computeStatus({ adminSuspended: false, removed: true }, [newer], clean);
    expect(result.status).toBe('removed');
  });

  it('止めた版は掲載せず、前の版に戻す', () => {
    const result = computeStatus(active, [older, { ...newer, suspended: true }], clean);
    expect(result).toMatchObject({ status: 'listed', listedReleaseId: 1 });
  });
});

describe('releaseBlockers (新しい版の条件)', () => {
  it('検査の行が無いリリースは掲載しない', () => {
    expect(releaseBlockers({ ...newer, checks: undefined }, clean)).toContain('checks_missing');
  });

  it('不変でないリリースは掲載しない', () => {
    expect(releaseBlockers(withChecks({ immutable: false }), clean)).toContain('not_immutable');
  });

  it('exe や msi の配布物があるリリースは掲載しない', () => {
    const release = {
      ...newer,
      assets: [{ name: 'setup.EXE', digest: 'sha256:new', os: 'windows', attestation: 'passed' as const }],
    };
    expect(releaseBlockers(release, clean)).toContain('installer_not_allowed');
  });

  it('証明が 1 件でも失敗か未検証なら掲載しない', () => {
    const failed = {
      ...newer,
      assets: [
        { name: 'a.zip', digest: 'sha256:new', os: 'windows', attestation: 'passed' as const },
        { name: 'b.zip', digest: 'sha256:new', os: 'linux', attestation: 'failed' as const },
      ],
    };
    expect(releaseBlockers(failed, clean)).toContain('attestation_failed');
    const unknown = { ...newer, assets: [{ name: 'a.zip', digest: 'sha256:new', os: 'windows' }] };
    expect(releaseBlockers(unknown, clean)).toContain('attestation_pending');
  });

  // 試行を使い切った証明は誰も検証し直さないため、本サービスの処理待ち (対応不要) と返し続けない。
  it('試行を使い切った証明は、管理者の待ちとして返す', () => {
    const exhausted = {
      ...newer,
      assets: [{ name: 'a.zip', digest: 'sha256:new', os: 'windows', attestation: 'exhausted' as const }],
    };
    expect(releaseBlockers(exhausted, clean)).toContain('attestation_retries_exhausted');
    expect(releaseBlockers(exhausted, clean)).not.toContain('attestation_pending');
    expect(BLOCKER_WAITS_FOR.attestation_retries_exhausted).toBe('admin');
  });

  it('乗っ取りの兆候とレビューの重大な指摘は、管理者の承認があるまで掲載しない', () => {
    expect(releaseBlockers(withChecks({ diffState: 'held' }), clean)).toEqual(['diff_held']);
    expect(releaseBlockers(withChecks({ diffState: 'error' }), clean)).toEqual(['diff_error']);
    expect(releaseBlockers(withChecks({ reviewSerious: 1 }), clean)).toEqual(['review_serious']);
    expect(releaseBlockers(withChecks({ diffState: 'held', reviewSerious: 1, adminApproved: true }), clean)).toEqual(
      [],
    );
  });

  // 所有者が変わったら、管理者が版を承認するまで新しい版を掲載しない (ADR 0015)。
  it('所有者の変更のあとの新しい版は、管理者の承認があるまで掲載しない', () => {
    expect(releaseBlockers({ ...withChecks({}), ownerChanged: true }, clean)).toEqual(['owner_changed']);
    expect(releaseBlockers({ ...withChecks({ adminApproved: true }), ownerChanged: true }, clean)).toEqual([]);
    expect(releaseBlockers({ ...withChecks({}), ownerChanged: false }, clean)).toEqual([]);
  });

  it('管理者の承認でも、証明・不変・配布の形の条件は解けない', () => {
    const release = {
      ...withChecks({ adminApproved: true, immutable: false }),
      assets: [{ name: 'setup.msi', digest: 'sha256:new', os: 'windows', attestation: 'failed' as const }],
    };
    expect(releaseBlockers(release, clean)).toEqual(['not_immutable', 'installer_not_allowed', 'attestation_failed']);
  });

  it('レビューが終わるまで掲載せず、2 回失敗したら管理者の判断を待つ', () => {
    expect(releaseBlockers(withChecks({ reviewState: 'pending' }), clean)).toEqual(['review_pending']);
    expect(releaseBlockers(withChecks({ reviewState: 'failed', reviewAttempts: 1 }), clean)).toEqual([
      'review_pending',
    ]);
    expect(releaseBlockers(withChecks({ reviewState: 'failed', reviewAttempts: 2 }), clean)).toEqual(['review_failed']);
  });

  it('宣言ファイルの誤りは掲載しない', () => {
    expect(releaseBlockers(withChecks({ configState: 'invalid' }), clean)).toEqual(['config_invalid']);
    expect(releaseBlockers(withChecks({ configState: 'no_declared_assets' }), clean)).toEqual([
      'config_no_declared_assets',
    ]);
  });

  // ライセンスの条件は、旧い版 (legacy) にも当て、管理者の承認でも解けない (ADR 0018)。
  it('タグの時点のライセンスが OSI/FSF に無い版は、旧い版も管理者の承認があっても掲載しない', () => {
    expect(releaseBlockers(withChecks({ licenseState: 'license_not_open', adminApproved: true }), clean)).toEqual([
      'license_not_open',
    ]);
    const legacyWith = (licenseState: ReleaseChecks['licenseState']) => ({
      ...older,
      checks: { ...legacy, licenseState },
    });
    expect(releaseBlockers(legacyWith('no_license'), clean)).toEqual(['no_license']);
    expect(releaseBlockers(legacyWith('pending'), clean)).toEqual(['license_pending']);
    const result = computeStatus(
      active,
      [{ ...older, checks: { ...legacy, licenseState: 'license_unrecognized' } }],
      lookupFrom({ 'sha256:old': 'not_found' }),
    );
    expect(result.status).toBe('pending');
  });
});

// MalwareBazaar の照会が続けて失敗し、上限に達した版は、本サービスの処理待ちではなく管理者の待ちとして返す。
describe('releaseBlockers (MalwareBazaar の照会の試行切れ)', () => {
  const exhausted = { result: 'error' as const, attempts: MAX_SCAN_ATTEMPTS };

  it('error が上限に達した配布物を持つ版は scan_retries_exhausted を付け、scan_pending を付けない', () => {
    const blockers = releaseBlockers(newer, lookupFrom({ 'sha256:new': exhausted }));
    expect(blockers).toContain('scan_retries_exhausted');
    expect(blockers).not.toContain('scan_pending');
    expect(BLOCKER_WAITS_FOR.scan_retries_exhausted).toBe('admin');
  });

  it('管理者の承認があっても掲載しない', () => {
    const result = computeStatus(
      active,
      [withChecks({ adminApproved: true })],
      lookupFrom({ 'sha256:new': exhausted }),
    );
    expect(result.status).toBe('pending');
  });

  it('上限の手前の error は scan_pending のまま', () => {
    const below = lookupFrom({ 'sha256:new': { result: 'error', attempts: MAX_SCAN_ATTEMPTS - 1 } });
    expect(releaseBlockers(newer, below)).toContain('scan_pending');
    expect(releaseBlockers(newer, below)).not.toContain('scan_retries_exhausted');
  });

  it('試行切れとほかの未確定の配布物があれば、両方を挙げる', () => {
    const release = {
      ...newer,
      assets: [
        { name: 'a.zip', digest: 'sha256:a', os: 'windows', attestation: 'passed' as const },
        { name: 'b.zip', digest: 'sha256:b', os: 'linux', attestation: 'passed' as const },
      ],
    };
    const mixed = lookupFrom({ 'sha256:a': exhausted, 'sha256:b': 'pending' });
    expect(releaseBlockers(release, mixed)).toEqual(expect.arrayContaining(['scan_pending', 'scan_retries_exhausted']));
  });

  it('旧い版 (legacy) にも付ける', () => {
    expect(releaseBlockers(older, lookupFrom({ 'sha256:old': exhausted }))).toEqual(['scan_retries_exhausted']);
  });
});
