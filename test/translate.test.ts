// 機械翻訳の危険側の境界: 概要に書かれた指示に従って、原文に無い URL を出した訳を表示しない。
import { describe, expect, it } from 'vitest';
import { acceptTranslation, sha256, TRANSLATION_MODEL, translationHash, unwrapEmphasis } from '../src/translate';

describe('unwrapEmphasis', () => {
  it('モデルが足した全体の太字の記号を外し、原文にある記号は残す', () => {
    expect(unwrapEmphasis('チャットの見た目を変える', '**Muda a aparência do chat**')).toBe('Muda a aparência do chat');
    expect(unwrapEmphasis('**重要** チャットの見た目を変える', '**Importante** muda a aparência do chat**')).toBe(
      '**Importante** muda a aparência do chat**',
    );
  });
});

describe('translationHash', () => {
  // 指示を直したあとに、前の指示で作った崩れた訳を表示し続けないための境界。
  it('モデルと原文だけで作った以前のハッシュと一致しない', async () => {
    const summary = 'OBS Studio plugin that restyles chat / チャットの見た目を変える OBS Studio のプラグイン';
    const old = await sha256(`${TRANSLATION_MODEL}\n${summary}`);
    expect(await translationHash(summary, 'ja', 'pt-BR')).not.toBe(old);
  });
});

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
