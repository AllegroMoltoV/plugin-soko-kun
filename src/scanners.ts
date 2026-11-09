// マルウェアのハッシュ照会。配布物はダウンロードせず、GitHub が付けた SHA-256 で照会する。
import { type Budget, budgetedFetch } from './budget';
import type { ScanResult } from './domain/status';

export interface ScanOutcome {
  result: Exclude<ScanResult, 'pending'>;
  detail: string;
}

export class ScannerRateLimitedError extends Error {
  constructor(readonly scanner: string) {
    super(`${scanner} rate limited`);
    this.name = 'ScannerRateLimitedError';
  }
}

const HEX64 = /^[0-9a-f]{64}$/;

export function sha256Hex(digest: string): string {
  const hex = digest.replace(/^sha256:/, '').toLowerCase();
  if (!HEX64.test(hex)) throw new Error('invalid sha256 digest');
  return hex;
}

export async function scanWithMalwareBazaar(budget: Budget, authKey: string, digest: string): Promise<ScanOutcome> {
  const response = await budgetedFetch(budget, 'https://mb-api.abuse.ch/api/v1/', {
    method: 'POST',
    headers: { 'Auth-Key': authKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: 'get_info', hash: sha256Hex(digest) }).toString(),
  });
  if (response.status === 429) {
    await response.body?.cancel();
    throw new ScannerRateLimitedError('malwarebazaar');
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { result: 'error', detail: `MalwareBazaar HTTP ${response.status}` };
  }
  const body = (await response.json()) as { query_status?: string };
  // MalwareBazaar は既知のマルウェアだけを収録する。登録があれば既知のマルウェアに一致したことを意味する。
  if (body.query_status === 'ok') return { result: 'malicious', detail: 'known malware sample in MalwareBazaar' };
  if (body.query_status === 'hash_not_found') return { result: 'not_found', detail: 'not a known malware sample' };
  return { result: 'error', detail: `MalwareBazaar ${body.query_status ?? 'unknown response'}` };
}
