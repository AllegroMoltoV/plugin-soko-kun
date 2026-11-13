// 乗っ取りの兆候の境界。危険側 (当たるべき変更を見逃して自動で掲載する) に倒れる経路を確かめる。
import { describe, expect, it } from 'vitest';
import { checkDiff } from '../../src/review/diff-rules';

const diff = (...lines: string[]) => lines.join('\n');

describe('checkDiff', () => {
  it('ワークフローと、ワークフローが呼ぶ処理の変更に当たる。名前の変更で移した場合も当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/.github/workflows/push.yaml b/.github/workflows/push.yaml',
        'diff --git a/scripts/x.sh b/.github/scripts/x.sh',
        'diff --git a/.github/actions/setup/action.yml b/.github/actions/setup/action.yml',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits.map((hit) => hit.file)).toEqual([
      '.github/workflows/push.yaml',
      '.github/scripts/x.sh',
      '.github/actions/setup/action.yml',
    ]);
  });

  it('バイナリの追加に当たる', () => {
    const hits = checkDiff(
      diff('diff --git a/data/model.onnx b/data/model.onnx', 'Binary files /dev/null and b/data/model.onnx differ'),
      false,
      'owner',
      'plugin',
    );
    expect(hits).toEqual([{ rule: 'diff-binary-added', file: 'data/model.onnx' }]);
  });

  it('別のホストと、同じ名前の別のリポジトリへのリンクの追加に当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/README.md b/README.md',
        '+Download from https://example.com/plugin.zip',
        '+Also https://github.com/attacker/plugin/releases',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits).toEqual([{ rule: 'diff-external-link', file: 'README.md' }]);
  });

  it('このリポジトリ・obsproject.com・倉庫くんへのリンクと、削除した行には当たらない', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/README.md b/README.md',
        '+See https://github.com/Owner/Plugin/releases and https://obsproject.com/kb',
        '+Listed on https://soko-kun.allegromoltov.jp/plugins/owner/plugin',
        '-Old link https://example.com/old',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits).toEqual([]);
  });

  it('切り詰めた差分は大きすぎる差分として当たる', () => {
    expect(checkDiff('', true, 'owner', 'plugin')).toEqual([{ rule: 'diff-too-large' }]);
  });
});
