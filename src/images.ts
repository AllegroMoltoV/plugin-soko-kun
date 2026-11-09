// プラグインのロゴと説明の画像の形式と大きさの確認。画像は外部データなので、拡張子を信用せず先頭のバイト列で判定する。
// 無料プランの CPU 時間に収めるため、画像の全体は解析しない。

export type ImageKind = 'logo' | 'image';
export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export const IMAGE_LIMITS: Record<ImageKind, { maxBytes: number; maxSide: number }> = {
  logo: { maxBytes: 256 * 1024, maxSide: 1024 },
  // D1 の 1 行の上限 2 MB に収めるため。
  image: { maxBytes: 1536 * 1024, maxSide: 4096 },
};

const EXTENSIONS: Record<string, ImageType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

// .soko-kun/ の中のファイル名が、その種類の画像の名前に当たれば、拡張子から想定する形式を返す。
export function expectedType(kind: ImageKind, fileName: string): ImageType | null {
  const match = /^(logo|image)\.([a-z]+)$/i.exec(fileName);
  if (!match || match[1]?.toLowerCase() !== kind) return null;
  return EXTENSIONS[match[2]?.toLowerCase() ?? ''] ?? null;
}

export interface ImageInfo {
  type: ImageType;
  width: number;
  height: number;
}

const ascii = (bytes: Uint8Array, start: number, text: string) =>
  [...text].every((char, index) => bytes[start + index] === char.charCodeAt(0));
const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number) => u16be(b, i) * 65536 + u16be(b, i + 2);
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => u16le(b, i) | ((b[i + 2] ?? 0) << 16);

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  // セグメントを順にたどり、フレームの開始 (SOF) から幅と高さを読む。
  for (let steps = 0; steps < 512 && i + 9 < bytes.length; steps += 1) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: u16be(bytes, i + 5), width: u16be(bytes, i + 7) };
    i += 2 + u16be(bytes, i + 2);
  }
  return null;
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (ascii(bytes, 12, 'VP8 ')) return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  if (ascii(bytes, 12, 'VP8L')) {
    const [b0, b1, b2, b3] = [bytes[21] ?? 0, bytes[22] ?? 0, bytes[23] ?? 0, bytes[24] ?? 0];
    return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (ascii(bytes, 12, 'VP8X')) return { width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
  return null;
}

export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  let size: { width: number; height: number } | null = null;
  let type: ImageType | null = null;
  if (bytes.length >= 24 && ascii(bytes, 0, '\x89PNG\r\n\x1a\n') && ascii(bytes, 12, 'IHDR')) {
    type = 'image/png';
    size = { width: u32be(bytes, 16), height: u32be(bytes, 20) };
  } else if (bytes.length >= 10 && (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a'))) {
    type = 'image/gif';
    size = { width: u16le(bytes, 6), height: u16le(bytes, 8) };
  } else if (bytes.length >= 30 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    type = 'image/webp';
    size = webpSize(bytes);
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    type = 'image/jpeg';
    size = jpegSize(bytes);
  }
  if (!type || !size || size.width <= 0 || size.height <= 0) return null;
  return { type, ...size };
}

// 形式が拡張子と一致し、大きさが上限に収まる画像だけを受け付ける。
export function checkImage(kind: ImageKind, fileName: string, bytes: Uint8Array): ImageInfo | null {
  const expected = expectedType(kind, fileName);
  const limit = IMAGE_LIMITS[kind];
  if (!expected || bytes.length > limit.maxBytes) return null;
  const info = sniffImage(bytes);
  if (!info || info.type !== expected) return null;
  if (info.width > limit.maxSide || info.height > limit.maxSide) return null;
  return info;
}
