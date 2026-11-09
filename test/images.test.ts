// 画像の危険側の境界: 拡張子を偽った SVG や別形式、上限を超える画像を保存しない。
import { describe, expect, it } from 'vitest';
import { checkImage } from '../src/images';
import { gif, png, svg } from './fixtures/images';

describe('checkImage', () => {
  it('拡張子を png にした SVG を受け付けない', () => {
    expect(checkImage('logo', 'logo.png', svg)).toBeNull();
  });

  it('拡張子と中身の形式が食い違う画像を受け付けない', () => {
    expect(checkImage('image', 'image.png', gif(100, 100))).toBeNull();
  });

  it('大きさの上限を超える画像を受け付けない', () => {
    expect(checkImage('logo', 'logo.png', png(64, 64, 256 * 1024))).toBeNull();
    expect(checkImage('logo', 'logo.png', png(2048, 64))).toBeNull();
  });

  it('条件に合う画像の形式と幅と高さを返す', () => {
    expect(checkImage('image', 'image.GIF', gif(320, 180))).toEqual({ type: 'image/gif', width: 320, height: 180 });
  });
});
