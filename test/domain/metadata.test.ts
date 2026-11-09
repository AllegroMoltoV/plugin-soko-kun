// README から取り出す概要に、HTML の要素として解釈されうる文字列を残さない。
import { describe, expect, it } from 'vitest';
import { cmakeReferencesLibobs, summarizeReadme } from '../../src/domain/metadata';

describe('summarizeReadme', () => {
  it('入れ子のタグを含む段落から山かっこを残さない', () => {
    const summary = summarizeReadme('A filter plugin <scr<script>ipt>alert(1)</script> for OBS Studio.');
    expect(summary).not.toBeNull();
    expect(summary).not.toMatch(/[<>]/);
  });
});

describe('cmakeReferencesLibobs', () => {
  it('pkg-config で libobs を参照する CMakeLists.txt を受け付ける', () => {
    expect(cmakeReferencesLibobs('find_package(PkgConfig QUIET)\npkg_check_modules(LIBOBS QUIET libobs)\n')).toBe(true);
  });
});
