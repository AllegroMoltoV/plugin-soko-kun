// 画像のテスト用のバイト列。形式の判定に使う先頭のバイト列だけを持つ。

export function png(width: number, height: number, padding = 0): Uint8Array {
  const bytes = new Uint8Array(33 + padding);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

export function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13);
  bytes.set(new TextEncoder().encode('GIF89a'));
  new DataView(bytes.buffer).setUint16(6, width, true);
  new DataView(bytes.buffer).setUint16(8, height, true);
  return bytes;
}

export const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
