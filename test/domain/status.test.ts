// 掲載状態の境界。危険側 (検査前の配布物を掲載する、停止を解除してしまう、条件を満たさない新しい版を掲載する) に倒れる経路だけを確かめる。
import { describe, expect, it } from 'vitest';
import {
  computeStatus,
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

function lookupFrom(table: Record<string, ScanResult>): ScanLookup {
  return (digest) => table[digest];
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

  it('乗っ取りの兆候とレビューの重大な指摘は、管理者の承認があるまで掲載しない', () => {
    expect(releaseBlockers(withChecks({ diffState: 'held' }), clean)).toEqual(['diff_held']);
    expect(releaseBlockers(withChecks({ diffState: 'error' }), clean)).toEqual(['diff_error']);
    expect(releaseBlockers(withChecks({ reviewSerious: 1 }), clean)).toEqual(['review_serious']);
    expect(releaseBlockers(withChecks({ diffState: 'held', reviewSerious: 1, adminApproved: true }), clean)).toEqual(
      [],
    );
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
});
