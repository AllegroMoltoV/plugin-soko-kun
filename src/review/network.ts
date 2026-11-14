// 新しい版のソースのコードからの通信の API の検出 (docs/design/scanning.md の「通信の検出」)。
// 検出は .github/workflows/verify.yaml が行い、結果を証明の検証と同じ受け口へ返す。ここでは結果の形と保存の形を決める。

// verify.yaml の検出のパターンの名前。受け口はこの名前の値だけを受け付ける。verify.yaml の一覧と同じにする。
export const NETWORK_APIS = [
  'winhttp',
  'wininet',
  'libcurl',
  'qt-network',
  'socket',
  'cpp-httplib',
  'ixwebsocket',
  'websocketpp',
  'libwebsockets',
  'boost-asio',
  'poco-net',
  'nsurlsession',
] as const;

export type NetworkApi = (typeof NETWORK_APIS)[number];

export interface NetworkHit {
  file: string;
  line: number;
  api: NetworkApi;
  text: string;
}

export interface NetworkScan {
  hits: NetworkHit[];
  truncated: boolean;
}

export const MAX_NETWORK_HITS = 50;
export const MAX_NETWORK_ATTEMPTS = 3;
const MAX_SCANS = 5;
// 検出の結果を待たずにレビューへ進むまでの時間。verify.yaml の schedule が止まる障害でレビューが止まり続けないようにする。
export const NETWORK_WAIT_MS = 6 * 60 * 60 * 1000;

// 検出の結果をまだ待っている状態。c は release_checks。
export const NETWORK_WAITING = `(c.network_state = 'pending'
  OR (c.network_state = 'error' AND c.network_attempts < ${MAX_NETWORK_ATTEMPTS}))`;

// 検出を待つ版の条件。受け口の pending と、定期処理のワークフローの起動の判断で同じ条件を使う。p は plugins。
export const NETWORK_PENDING = `c.legacy = 0 AND p.removed = 0 AND ${NETWORK_WAITING}`;
export const NETWORK_PENDING_LIMIT = MAX_SCANS;

const API_SET = new Set<string>(NETWORK_APIS);
const FILE = /^[^\0\r\n]{1,200}$/;

function clean(text: string, max: number): string {
  return text.replace(/[\r\n\t]/g, ' ').slice(0, max);
}

export interface NetworkScanInput {
  releaseId: number;
  result: 'done' | 'error';
  scan: NetworkScan | null;
}

// 受け口の本文の networkScans を確かめる。形の合わない要素と、知らない API の名前の当たりは捨てる。
export function parseNetworkScans(raw: unknown): NetworkScanInput[] {
  if (!Array.isArray(raw)) return [];
  const scans: NetworkScanInput[] = [];
  for (const item of raw.slice(0, MAX_SCANS)) {
    const entry = item as Record<string, unknown>;
    if (typeof entry?.releaseId !== 'number' || !Number.isSafeInteger(entry.releaseId)) continue;
    if (entry.result === 'error') {
      scans.push({ releaseId: entry.releaseId, result: 'error', scan: null });
      continue;
    }
    if (entry.result !== 'done' || !Array.isArray(entry.hits)) continue;
    const hits: NetworkHit[] = [];
    for (const hit of entry.hits.slice(0, MAX_NETWORK_HITS)) {
      const value = hit as Record<string, unknown>;
      if (typeof value?.file !== 'string' || !FILE.test(value.file)) continue;
      if (typeof value.line !== 'number' || !Number.isSafeInteger(value.line) || value.line < 1) continue;
      if (typeof value.api !== 'string' || !API_SET.has(value.api)) continue;
      hits.push({
        file: value.file,
        line: value.line,
        api: value.api as NetworkApi,
        text: typeof value.text === 'string' ? clean(value.text, 160) : '',
      });
    }
    scans.push({
      releaseId: entry.releaseId,
      result: 'done',
      scan: { hits, truncated: entry.truncated === true || entry.hits.length > MAX_NETWORK_HITS },
    });
  }
  return scans;
}

// 保存した network_hits を読む。読めなければ null。
export function readNetworkScan(json: string | null): NetworkScan | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as NetworkScan;
    return Array.isArray(value.hits) ? value : null;
  } catch {
    return null;
  }
}
