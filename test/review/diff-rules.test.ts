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

  // 削除だけの版を管理者の確認待ちにしない。姉妹版の test/review/diff-rules.test.ts と同じ形。
  it('バイナリのファイルの削除は数えない', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/data/old.onnx b/data/old.onnx',
        'deleted file mode 100644',
        'Binary files a/data/old.onnx and /dev/null differ',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits).toEqual([]);
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

  // git と GitHub の compare は、パスに空白を含むと引用符なしで、非 ASCII を含むと引用符と 8 進のエスケープで見出しを出す。
  it('パスに空白や非 ASCII を含むワークフローの変更と、そうしたパスからの名前の変更に当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/.github/workflows/re lease.yml b/.github/workflows/re lease.yml',
        'diff --git "a/.github/scripts/\\343\\201\\202.sh" "b/.github/scripts/\\343\\201\\202.sh"',
        'diff --git a/old name.yml b/.github/actions/new name/action.yml',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits.map((hit) => hit.rule)).toEqual([
      'diff-workflow-changed',
      'diff-workflow-changed',
      'diff-workflow-changed',
    ]);
  });

  it('入れ子の .github/workflows/ には当たらない', () => {
    const hits = checkDiff(
      diff('diff --git a/data/.github/workflows/x.yml b/data/.github/workflows/x.yml'),
      false,
      'owner',
      'plugin',
    );
    expect(hits).toEqual([]);
  });

  it('削除したファイルの直後に、空白を含むパスのバイナリを足すと当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/data/old.bin b/data/old.bin',
        'deleted file mode 100644',
        'Binary files a/data/old.bin and /dev/null differ',
        'diff --git a/data/sp ace.bin b/data/sp ace.bin',
        'new file mode 100644',
        'Binary files /dev/null and b/data/sp ace.bin differ',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits.map((hit) => hit.rule)).toEqual(['diff-binary-added']);
  });

  it('名前が " and /dev/null" で終わるバイナリの追加に当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/x and /dev/null b/x and /dev/null',
        'new file mode 100644',
        'Binary files /dev/null and b/x and /dev/null differ',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits.map((hit) => hit.rule)).toEqual(['diff-binary-added']);
  });

  // 本文が ++ で始まる行は、差分では +++ で始まる。
  it('変更の塊の中の +++ で始まる追加の行も照合する', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/README.md b/README.md',
        '--- a/README.md',
        '+++ b/README.md',
        '@@ -1,1 +1,2 @@',
        ' # Plugin',
        '+++ https://evil.example/x',
      ),
      false,
      'owner',
      'plugin',
    );
    expect(hits).toEqual([{ rule: 'diff-external-link', file: 'README.md' }]);
  });

  it('切り詰めた差分は大きすぎる差分として当たる', () => {
    expect(checkDiff('', true, 'owner', 'plugin')).toEqual([{ rule: 'diff-too-large' }]);
  });
});
