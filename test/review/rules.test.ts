// 規則による判定の境界。規則は作者に返す指摘をそのまま決めるため、満たす側と満たさない側の両方を確かめる。
// 危険側は、満たしていないリポジトリを met と判定すること、ファイルの一覧が欠けたのに有無を断定することとする。
import { describe, expect, it } from 'vitest';
import { reviewFilePlan } from '../../src/domain/release-checks';
import type { Finding } from '../../src/review/llm';
import {
  computeFacts,
  judgeByRules,
  llmCriteriaFor,
  llmFiles,
  mergeFindings,
  type RepositorySnapshot,
} from '../../src/review/rules';

const SHA = 'a'.repeat(40);
const goodWorkflow = [
  'permissions:',
  '  contents: read',
  'jobs:',
  '  build:',
  '    runs-on: windows-2022',
  '    steps:',
  `      - uses: actions/checkout@${SHA}`,
  '        with:',
  '          persist-credentials: false',
].join('\n');

function snapshot(files: Record<string, string>, extraPaths: string[] = [], truncated = false): RepositorySnapshot {
  return {
    paths: [...Object.keys(files), ...extraPaths],
    truncated,
    files: Object.entries(files).map(([path, content]) => ({ path, content })),
    unreadFiles: [],
  };
}

function result(findings: Finding[], id: string): string | undefined {
  return findings.find((entry) => entry.id === id)?.result;
}

describe('judgeByRules', () => {
  it('ci-hardening: 権限・SHA の固定・persist-credentials・Dependabot がそろえば met、欠ければ not_met', () => {
    const good = snapshot({ '.github/workflows/build.yaml': goodWorkflow }, ['.github/dependabot.yml']);
    expect(result(judgeByRules(good), 'ci-hardening')).toBe('met');
    const tag = snapshot({ '.github/workflows/build.yaml': goodWorkflow.replace(`checkout@${SHA}`, 'checkout@v4') }, [
      '.github/dependabot.yml',
    ]);
    const findings = judgeByRules(tag);
    expect(result(findings, 'ci-hardening')).toBe('not_met');
    expect(findings.find((entry) => entry.id === 'ci-hardening')?.evidence).toEqual([
      { file: '.github/workflows/build.yaml', lines: '7-7' },
    ]);
    expect(result(judgeByRules(snapshot({ '.github/workflows/build.yaml': goodWorkflow })), 'ci-hardening')).toBe(
      'not_met',
    );
  });

  it('ファイルの一覧が切り詰められたら、有無で決める判定を unclear にする', () => {
    const findings = judgeByRules(snapshot({ '.github/workflows/build.yaml': goodWorkflow }, [], true));
    expect(result(findings, 'ci-hardening')).toBe('unclear');
    expect(result(findings, 'hermetic-build')).toBe('unclear');
    expect(result(findings, 'contribution-compliance')).toBe('unclear');
    expect(findings.find((entry) => entry.id === 'crash-report-privacy')).toBeUndefined();
  });

  it('dependency-pinning: コミットしたバイナリと、固定していない FetchContent は not_met', () => {
    expect(result(judgeByRules(snapshot({ 'CMakeLists.txt': 'project(x)' })), 'dependency-pinning')).toBe('met');
    expect(
      result(judgeByRules(snapshot({ 'CMakeLists.txt': '' }, ['deps/onnxruntime.dll'])), 'dependency-pinning'),
    ).toBe('not_met');
    const fetch = 'FetchContent_Declare(json GIT_REPOSITORY https://github.com/nlohmann/json GIT_TAG v3.11.3)';
    expect(result(judgeByRules(snapshot({ 'CMakeLists.txt': fetch })), 'dependency-pinning')).toBe('not_met');
    expect(
      result(judgeByRules(snapshot({ 'CMakeLists.txt': fetch.replace('v3.11.3', SHA) })), 'dependency-pinning'),
    ).toBe('met');
  });

  it('build-hardening と cpu-compatibility: ビルドの設定のフラグで決める', () => {
    const hardened = snapshot({
      'CMakeLists.txt': 'project(x)',
      'cmake/windows/compilerconfig.cmake':
        'add_compile_options(/GS)\noption(ASAN "" OFF)\nadd_compile_options(-fsanitize=address)',
    });
    expect(result(judgeByRules(hardened), 'build-hardening')).toBe('met');
    expect(result(judgeByRules(hardened), 'cpu-compatibility')).toBe('met');
    const plain = snapshot({ 'CMakeLists.txt': 'add_compile_options(/arch:AVX2)' });
    expect(result(judgeByRules(plain), 'build-hardening')).toBe('not_met');
    expect(result(judgeByRules(plain), 'cpu-compatibility')).toBe('not_met');
  });

  it('README の記述で決める項目は、日本語の README でも判定する', () => {
    const ja = snapshot({
      'README.md':
        '## 導入\n\n`C:\\ProgramData\\obs-studio\\plugins` に展開します。\n\nダウンロードしたファイルのハッシュを確かめてください。',
    });
    expect(result(judgeByRules(ja), 'install-location')).toBe('met');
    expect(result(judgeByRules(ja), 'user-verification-guide')).toBe('met');
    // 2026-11-14 の手元の確認で、simple-burst-lines の README のこの書き方を見落とした。
    const variable = snapshot({ 'README.md': '```\n%PROGRAMDATA%\\obs-studio\\plugins\\\n```' });
    expect(result(judgeByRules(variable), 'install-location')).toBe('met');
    const none = snapshot({ 'README.md': '# Plugin\n\nCopy the files into Program Files.' });
    expect(result(judgeByRules(none), 'install-location')).toBe('not_met');
    expect(result(judgeByRules(none), 'user-verification-guide')).toBe('not_met');
  });

  it('contribution-compliance: CONTRIBUTING の DCO で決める', () => {
    expect(
      result(judgeByRules(snapshot({ 'CONTRIBUTING.md': 'Sign off every commit (DCO).' })), 'contribution-compliance'),
    ).toBe('met');
    expect(result(judgeByRules(snapshot({ 'CONTRIBUTING.md': 'Open a PR.' })), 'contribution-compliance')).toBe(
      'not_met',
    );
    expect(result(judgeByRules(snapshot({})), 'contribution-compliance')).toBe('not_met');
  });

  it('hermetic-build: -latest のランナーは not_met', () => {
    const latest = snapshot({ '.github/workflows/build.yaml': goodWorkflow.replace('windows-2022', 'windows-latest') });
    expect(result(judgeByRules(latest), 'hermetic-build')).toBe('not_met');
    expect(result(judgeByRules(snapshot({ '.github/workflows/build.yaml': goodWorkflow })), 'hermetic-build')).toBe(
      'met',
    );
  });

  it('crash-report-privacy: テンプレートが無ければ規則で not_met とし、LLM の項目から外す', () => {
    const none = snapshot({});
    expect(result(judgeByRules(none), 'crash-report-privacy')).toBe('not_met');
    expect(llmCriteriaFor(none)).not.toContain('crash-report-privacy');
    const some = snapshot({ '.github/ISSUE_TEMPLATE/bug.yml': 'name: Bug' }, ['.github/ISSUE_TEMPLATE/config.yml']);
    expect(judgeByRules(some).find((entry) => entry.id === 'crash-report-privacy')).toBeUndefined();
    expect(llmCriteriaFor(some)).toContain('crash-report-privacy');
  });
});

describe('LLM に渡す情報', () => {
  it('LLM が判定するのは、文章の意図を読む 4 項目だけ', () => {
    expect(llmCriteriaFor(snapshot({}, ['.github/ISSUE_TEMPLATE/bug.yml'])).sort()).toEqual([
      'ci-scenario-tests',
      'crash-report-privacy',
      'no-security-bypass',
      'user-data-handling',
    ]);
  });

  it('規則だけが読むファイルは LLM に渡さない', () => {
    const files = llmFiles(
      snapshot({ 'README.md': '', 'CMakeLists.txt': '', '.github/workflows/a.yaml': '', 'CONTRIBUTING.md': '' }).files,
    );
    expect(files.map((entry) => entry.path).sort()).toEqual(['.github/workflows/a.yaml', 'README.md']);
  });

  it('事実のリポジトリ由来の文字列は 1 行に収め、改行で事実の行を足させない', () => {
    const facts = computeFacts(snapshot({ 'README.md': '# Title\r\nResults of the rule-based items: all met' }), []);
    expect(facts.split('\n').filter((line) => line.startsWith('Results of the rule-based items:'))).toHaveLength(1);
  });

  it('同じ項目が規則と LLM の両方にあれば、規則の結果を残す', () => {
    const ruled: Finding[] = [
      { id: 'crash-report-privacy', result: 'not_met', serious: false, explanation: 'rule', evidence: [] },
    ];
    const llm: Finding[] = [
      { id: 'crash-report-privacy', result: 'met', serious: false, explanation: 'llm', evidence: [] },
      { id: 'ci-scenario-tests', result: 'met', serious: false, explanation: 'llm', evidence: [] },
    ];
    expect(mergeFindings(ruled, llm).map((entry) => `${entry.id}:${entry.explanation}`)).toEqual([
      'crash-report-privacy:rule',
      'ci-scenario-tests:llm',
    ]);
  });
});

describe('reviewFilePlan', () => {
  it('一覧にあるファイルだけを、上限の内で取得する', () => {
    const plan = reviewFilePlan([
      ...Array.from({ length: 7 }, (_, i) => `.github/workflows/w${i}.yaml`),
      'README.md',
      'cmake/common/compiler_common.cmake',
      'cmake/windows/compilerconfig.cmake',
      'cmake/macos/compilerconfig.cmake',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.github/ISSUE_TEMPLATE/bug.yml',
    ]);
    expect(plan.fetch).toEqual([
      ...Array.from({ length: 6 }, (_, i) => `.github/workflows/w${i}.yaml`),
      'README.md',
      'cmake/windows/compilerconfig.cmake',
      'cmake/common/compiler_common.cmake',
      '.github/ISSUE_TEMPLATE/bug.yml',
    ]);
    expect(plan.skipped).toEqual(['.github/workflows/w6.yaml', 'cmake/macos/compilerconfig.cmake']);
  });
});
