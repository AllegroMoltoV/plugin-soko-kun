// 掲載状態の境界。危険側 (検査前の配布物を掲載する、停止を解除してしまう) に倒れる経路だけを確かめる。
import { describe, expect, it } from 'vitest';
import { computeStatus, type ReleaseForStatus, type ScanLookup, type ScanResult } from '../../src/domain/status';

const active = { adminSuspended: false, removed: false };
const older: ReleaseForStatus = { githubReleaseId: 1, publishedAt: '2026-10-01T00:00:00Z', digests: ['sha256:old'] };
const newer: ReleaseForStatus = { githubReleaseId: 2, publishedAt: '2026-11-01T00:00:00Z', digests: ['sha256:new'] };

function lookupFrom(table: Record<string, [ScanResult, ScanResult]>): ScanLookup {
  return (digest, scanner) => table[digest]?.[scanner === 'virustotal' ? 0 : 1];
}

describe('computeStatus', () => {
  it('検査が終わっていないリリースしか無ければ掲載しない', () => {
    const result = computeStatus(active, [newer], lookupFrom({ 'sha256:new': ['pending', 'clean'] }));
    expect(result.status).toBe('pending');
  });

  it('VirusTotal に未登録のハッシュは、既定では検査済みとしない', () => {
    const result = computeStatus(active, [newer], lookupFrom({ 'sha256:new': ['not_found', 'not_found'] }));
    expect(result.status).toBe('pending');
  });

  it('MalwareBazaar の未登録は該当なしとして扱う', () => {
    const result = computeStatus(active, [newer], lookupFrom({ 'sha256:new': ['clean', 'not_found'] }));
    expect(result).toMatchObject({ status: 'listed', listedReleaseId: 2 });
  });

  it('検査の失敗は検査済みとしない', () => {
    const result = computeStatus(active, [newer], lookupFrom({ 'sha256:new': ['error', 'clean'] }));
    expect(result.status).toBe('pending');
  });

  it('新しいリリースの検査中は、検査を通った前のリリースを掲載対象にする', () => {
    const result = computeStatus(
      active,
      [older, newer],
      lookupFrom({ 'sha256:old': ['clean', 'clean'], 'sha256:new': ['pending', 'pending'] }),
    );
    expect(result).toEqual({ status: 'listed', listedReleaseId: 1, pendingReleaseIds: [2] });
  });

  it('どのリリースでも malicious が出たら停止する', () => {
    const result = computeStatus(
      active,
      [older, newer],
      lookupFrom({ 'sha256:old': ['malicious', 'clean'], 'sha256:new': ['clean', 'clean'] }),
    );
    expect(result).toMatchObject({ status: 'suspended', reason: 'malicious' });
  });

  it('管理者の停止は検査結果に関わらず維持する', () => {
    const result = computeStatus(
      { adminSuspended: true, removed: false },
      [newer],
      lookupFrom({ 'sha256:new': ['clean', 'clean'] }),
    );
    expect(result).toMatchObject({ status: 'suspended', reason: 'admin' });
  });

  it('GitHub で消えたリポジトリは掲載終了にする', () => {
    const result = computeStatus(
      { adminSuspended: false, removed: true },
      [newer],
      lookupFrom({ 'sha256:new': ['clean', 'clean'] }),
    );
    expect(result.status).toBe('removed');
  });
});
