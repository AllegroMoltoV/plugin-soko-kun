// 宣言ファイルの申告の危険側の境界: 作者が書く supportUrl で、許可していない宛先へ利用者を誘導させない (ADR 0018)。
import { describe, expect, it } from 'vitest';
import { isAllowedSupportUrl, parseDeclarations } from '../../src/domain/declarations';

describe('isAllowedSupportUrl', () => {
  it.each([
    ['https://booth.pm/ja/items/1', true],
    ['https://allegromoltov.booth.pm/', true],
    ['https://github.com/sponsors/AllegroMoltoV', true],
    // 末尾だけが一致する宛先、https 以外、利用者情報や port の付いた URL、github.com の別のパスとサブドメインは通さない。
    ['https://evilbooth.pm/', false],
    ['https://booth.pm.example/', false],
    ['http://booth.pm/', false],
    ['javascript:alert(1)//booth.pm', false],
    ['https://user@booth.pm/', false],
    ['https://booth.pm:8443/', false],
    ['https://github.com/AllegroMoltoV/plugin-soko-kun', false],
    ['https://gist.github.com/sponsors/AllegroMoltoV', false],
    ['https://github.com/sponsors/AllegroMoltoV/../../evil', false],
  ])('%s → %s', (url, expected) => {
    expect(isAllowedSupportUrl(url)).toBe(expected);
  });

  it('許可していない supportUrl は申告に残さず、固定のコードだけを残す', () => {
    expect(parseDeclarations({ supportUrl: 'https://evilbooth.pm/' })).toMatchObject({
      supportUrl: null,
      notices: ['support_url_invalid'],
    });
  });
});
