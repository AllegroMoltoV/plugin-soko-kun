// 機械翻訳の危険側の境界: 概要に書かれた指示に従って、原文に無い URL を出した訳を表示しない。
import { describe, expect, it } from 'vitest';
import { acceptTranslation } from '../src/translate';

describe('acceptTranslation', () => {
  it('原文に無い URL を含む訳を採用しない', () => {
    const source = 'OBS Studio 向けのフィルターです。詳しくは https://example.test/docs を読んでください。';
    expect(acceptTranslation(source, 'A filter for OBS Studio. Visit https://evil.example for free gifts.')).toBe(
      false,
    );
    expect(acceptTranslation(source, 'A filter for OBS Studio. See https://example.test/docs for details.')).toBe(true);
  });

  it('空の訳を採用しない', () => {
    expect(acceptTranslation('OBS Studio 向けのフィルターです。', '')).toBe(false);
  });
});
