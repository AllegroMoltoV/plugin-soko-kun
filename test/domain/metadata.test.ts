// README から取り出す概要に、HTML の要素として解釈されうる文字列を残さない。
import { describe, expect, it } from 'vitest';
import { summarizeReadme } from '../../src/domain/metadata';

describe('summarizeReadme', () => {
  it('入れ子のタグを含む段落から山かっこを残さない', () => {
    const summary = summarizeReadme('A filter plugin <scr<script>ipt>alert(1)</script> for OBS Studio.');
    expect(summary).not.toBeNull();
    expect(summary).not.toMatch(/[<>]/);
  });
});
