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

// 少数のエンジンだけの検出は誤検知もありうるため、停止ではなく保留にして管理者の判断を待つ。
export const VIRUSTOTAL_MALICIOUS_THRESHOLD = 3;

export async function scanWithVirusTotal(budget: Budget, apiKey: string, digest: string): Promise<ScanOutcome> {
  const response = await budgetedFetch(budget, `https://www.virustotal.com/api/v3/files/${sha256Hex(digest)}`, {
    headers: { 'x-apikey': apiKey, Accept: 'application/json' },
  });
  if (response.status === 404) {
    await response.body?.cancel();
    return { result: 'not_found', detail: 'not in VirusTotal' };
  }
  if (response.status === 429) {
    await response.body?.cancel();
    throw new ScannerRateLimitedError('virustotal');
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { result: 'error', detail: `VirusTotal HTTP ${response.status}` };
  }
  const body = (await response.json()) as {
    data?: { attributes?: { last_analysis_stats?: Record<string, number> } };
  };
  const stats = body.data?.attributes?.last_analysis_stats;
  if (!stats) return { result: 'error', detail: 'VirusTotal returned no analysis' };
  const malicious = stats.malicious ?? 0;
  const suspicious = stats.suspicious ?? 0;
  const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
  const detail = `${malicious}/${total} malicious, ${suspicious} suspicious`;
  if (malicious >= VIRUSTOTAL_MALICIOUS_THRESHOLD) return { result: 'malicious', detail };
  if (malicious > 0 || suspicious > 0) return { result: 'suspicious', detail };
  return { result: 'clean', detail };
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
