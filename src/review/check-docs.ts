// 確認のモードの README 以外の文書の照合 (docs/design/scanning.md の「README 以外の文書の照合」)。
// 本審査は GitHub Actions が git で取り出したソースを照合し、結果は版の公開の後に届く。確認のモードは同期の応答のため、
// GitHub の tarball を 1 回取得し、Worker の中で逐次に展開して、本審査と同じ選び方 (doc-scan.mjs) で照合する。
import type { GitHubClient } from '../github';
import { isDoc, MAX_DOC_FILE_BYTES, scanDocFiles } from './doc-scan.mjs';
import type { DocScan } from './network';

export const MAX_TARBALL_BYTES = 100 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 200 * 1024 * 1024;
export const MAX_SCAN_MS = 20_000;

// 確認のモードで文書を照合できなかったことと、その理由。規則は重大の not_met にする。
export interface DocScanGap {
  missing: string;
}

const BLOCK = 512;

class TarError extends Error {}

// 本文を逐次に読み、要求した長さのバイト列を返す。展開した長さの上限と時間の上限を確かめる。
class ByteReader {
  private chunks: Uint8Array[] = [];
  private buffered = 0;
  private total = 0;
  private done = false;

  constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    private readonly deadline: number,
  ) {}

  private async fill(n: number): Promise<void> {
    while (this.buffered < n && !this.done) {
      if (Date.now() > this.deadline) throw new TarError('time');
      const chunk = await this.reader.read();
      if (chunk.done) {
        this.done = true;
        break;
      }
      this.total += chunk.value.byteLength;
      if (this.total > MAX_EXPANDED_BYTES) throw new TarError('expanded');
      this.chunks.push(chunk.value);
      this.buffered += chunk.value.byteLength;
    }
  }

  // n バイトを返す。途中で終わったら null。
  async read(n: number): Promise<Uint8Array | null> {
    await this.fill(n);
    if (this.buffered < n) return null;
    const out = new Uint8Array(n);
    let offset = 0;
    while (offset < n) {
      const head = this.chunks[0] as Uint8Array;
      const take = Math.min(head.byteLength, n - offset);
      out.set(head.subarray(0, take), offset);
      offset += take;
      if (take === head.byteLength) this.chunks.shift();
      else this.chunks[0] = head.subarray(take);
    }
    this.buffered -= n;
    return out;
  }

  // n バイトを読み捨てる。
  async skip(n: number): Promise<void> {
    let left = n;
    while (left > 0) {
      const step = Math.min(left, 1024 * 1024);
      if ((await this.read(step)) === null) throw new TarError('truncated');
      left -= step;
    }
  }
}

const decoder = new TextDecoder();

function cstring(block: Uint8Array, start: number, length: number): string {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);
  return decoder.decode(end < 0 ? field : field.subarray(0, end));
}

function octal(block: Uint8Array, start: number, length: number): number {
  // base-256 の大きさ (8 GiB 以上) は上限を超えるため読まない。
  if (((block[start] ?? 0) & 0x80) !== 0) throw new TarError('expanded');
  const text = cstring(block, start, length).trim();
  const value = text === '' ? 0 : Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new TarError('header');
  return value;
}

// pax の拡張ヘッダーの path を返す。レコードは "<長さ> <キー>=<値>\n"。
function paxPath(data: Uint8Array): string | undefined {
  const text = decoder.decode(data);
  let found: string | undefined;
  for (const record of text.split('\n')) {
    const space = record.indexOf(' ');
    const body = space < 0 ? '' : record.slice(space + 1);
    if (body.startsWith('path=')) found = body.slice('path='.length);
  }
  return found;
}

// tar を逐次に読み、通常のファイルのうち isDoc に当たるものを返す。パスは先頭のディレクトリ (owner-repo-sha/) を外す。
async function readDocs(
  stream: ReadableStream<Uint8Array>,
  deadline: number,
): Promise<Array<{ path: string; bytes: Uint8Array | null }>> {
  const reader = new ByteReader(stream.getReader(), deadline);
  const docs: Array<{ path: string; bytes: Uint8Array | null }> = [];
  let longPath: string | undefined;
  for (;;) {
    const header = await reader.read(BLOCK);
    if (header === null || header.every((byte) => byte === 0)) break;
    const size = octal(header, 124, 12);
    const padded = Math.ceil(size / BLOCK) * BLOCK;
    const type = String.fromCharCode(header[156] ?? 0);
    if (type === 'x' || type === 'L') {
      const data = await reader.read(padded);
      if (data === null) throw new TarError('truncated');
      longPath = type === 'x' ? paxPath(data.subarray(0, size)) : cstring(data, 0, size);
      continue;
    }
    const name = cstring(header, 0, 100);
    const prefix = cstring(header, 345, 155);
    const full = longPath ?? (prefix ? `${prefix}/${name}` : name);
    longPath = undefined;
    const slash = full.indexOf('/');
    const path = slash < 0 ? '' : full.slice(slash + 1);
    const regular = type === '0' || type === '\0' || type === '7';
    // シンボリックリンクは本審査と同じく照合しない。ファイルの一覧には blob として載るため、有ったことだけを残す。
    if (type === '2' && path !== '' && isDoc(path)) {
      docs.push({ path, bytes: null });
      await reader.skip(padded);
      continue;
    }
    if (!regular || path === '' || !isDoc(path)) {
      await reader.skip(padded);
      continue;
    }
    // 上限を超える文書は中身を読まず、有ったことだけを残す (本審査も読み飛ばす)。
    if (size > MAX_DOC_FILE_BYTES) {
      docs.push({ path, bytes: null });
      await reader.skip(padded);
      continue;
    }
    const data = await reader.read(padded);
    if (data === null) throw new TarError('truncated');
    docs.push({ path, bytes: data.slice(0, size) });
  }
  return docs;
}

// 圧縮された本文の長さを数え、上限を超えたら止める。codeload の応答には Content-Length が無いため、読みながら数える。
function limitCompressed(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let total = 0;
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > MAX_TARBALL_BYTES) controller.error(new TarError('compressed'));
        else controller.enqueue(chunk);
      },
    }),
  );
}

const LIMITS =
  'the check mode reads the repository archive up to 100 MB compressed and 200 MB expanded, within 20 seconds';
const RELEASE_CHECK =
  'The check after a release scans the documents with different limits, so fix this or keep the documents small before you publish.';

// 既定のブランチの文書を照合する。照合できなかったときは理由を返す。paths と treeTruncated は collectReviewFiles の
// ファイルの一覧で、tarball に無い文書 (.gitattributes の export-ignore) を見つけるために使う。
export async function scanDocsForCheck(
  github: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  paths: string[],
  treeTruncated: boolean,
  now = Date.now,
): Promise<(DocScan & { note?: string }) | DocScanGap> {
  let docs: Array<{ path: string; bytes: Uint8Array | null }>;
  try {
    const body = await github.getTarball(owner, repo, ref);
    docs = await readDocs(limitCompressed(body).pipeThrough(new DecompressionStream('gzip')), now() + MAX_SCAN_MS);
  } catch (error) {
    const reason =
      error instanceof TarError && ['compressed', 'expanded', 'time'].includes(error.message)
        ? `the repository archive exceeded the limits (${LIMITS})`
        : 'the repository archive could not be downloaded or read';
    return {
      missing: `Checked by rules: the documents other than the README could not be checked in the check mode because ${reason}. ${RELEASE_CHECK}`,
    };
  }
  const inArchive = new Set(docs.map((doc) => doc.path));
  const absent = paths.filter((path) => isDoc(path) && !inArchive.has(path));
  if (absent.length > 0) {
    return {
      // パスはリポジトリの文字列のため、作者の AI へ返す説明に入れない。
      missing: `Checked by rules: ${absent.length} document(s) in the repository are left out of the repository archive (for example by export-ignore in .gitattributes), so the check mode could not check them. The check after a release checks them.`,
    };
  }
  const scan = scanDocFiles(docs.flatMap((doc) => (doc.bytes ? [{ path: doc.path, bytes: doc.bytes }] : [])));
  return treeTruncated
    ? {
        ...scan,
        note: 'The file list was too large to confirm that the repository archive includes every document.',
      }
    : scan;
}
