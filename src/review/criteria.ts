// 審査の基準の固定の文言。正本は docs/design/review-criteria.md で、ID の一致をテストで確かめる。
// 作者の LLM に返す文言は英語に固定する。title・fix・viewpoint は本サービスが書き、LLM には書かせない。
export type CriterionKind = 'condition' | 'takeover' | 'criterion' | 'recommendation';
export type JudgedBy = 'rule' | 'llm' | 'future';

export interface Criterion {
  id: string;
  kind: CriterionKind;
  judgedBy: JudgedBy;
  title: string;
  // LLM に渡す判定の観点。LLM が判定する項目だけが持つ。規則で判定する項目の基準は src/review/rules.ts にある。
  viewpoint?: string;
  // 重大とする場合。審査の基準のうち、重大な指摘を管理者の確認待ちにする項目だけが持つ。
  serious?: string;
  fix: string;
}

const DOC = 'https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md';

export function referenceOf(id: string): string {
  return `${DOC}#${id}`;
}

export const CRITERIA: Criterion[] = [
  {
    id: 'attestation',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'Every release file has a build provenance attestation',
    fix: 'Add actions/attest-build-provenance to the job that creates the release, with subject-checksums covering every release file, and grant id-token: write and attestations: write. Then publish a new release.',
  },
  {
    id: 'immutable-release',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'The release is immutable',
    fix: 'Enable immutable releases in the repository settings (Settings > General > Releases), then publish a new release.',
  },
  {
    id: 'distribution-format',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'No exe or msi installer is distributed',
    fix: 'Distribute the Windows build as a zip archive instead of an exe or msi installer, then publish a new release.',
  },
  {
    id: 'diff-workflow-changed',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'A workflow changed since the listed version',
    fix: 'No action is needed if the change is intended. An administrator reviews it before listing.',
  },
  {
    id: 'diff-binary-added',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'A binary file was added or changed since the listed version',
    fix: 'No action is needed if the change is intended. An administrator reviews it before listing.',
  },
  {
    id: 'diff-external-link',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'A link or download to another host was added since the listed version',
    fix: 'No action is needed if the change is intended. An administrator reviews it before listing.',
  },
  {
    id: 'diff-too-large',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'The change since the listed version is too large to check automatically',
    fix: 'No action is needed. An administrator reviews it before listing. Smaller releases are checked automatically.',
  },
  {
    id: 'tag-not-on-default-branch',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'The release tag points to a commit that is not on the default branch',
    fix: 'No action is needed if this is intended, for example a release branch. An administrator reviews it before listing. Tag releases on the default branch to have them checked automatically.',
  },
  {
    id: 'owner-changed',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'The repository owner changed since the plugin was registered',
    fix: 'No action is needed if the transfer is intended. An administrator reviews the next release before listing.',
  },
  {
    id: 'ci-source-build',
    kind: 'criterion',
    judgedBy: 'future',
    title: 'Release files are built from source in CI',
    fix: 'Build the release files from source in the GitHub Actions job that creates the release.',
  },
  {
    id: 'ci-scenario-tests',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Tests exercise the plugin in real use scenarios',
    // 依頼者の決定 (2026-11-15): libobs を画面なしで初期化してプラグインを読み込むテストも満たす。LLM の判定が回によって
    // 分かれたため、同じ日にルールの判定に移した。
    fix: 'Add a CI job that loads the built plugin, through libobs without a window or by starting OBS Studio, and checks that a plugin feature produces the expected result.',
  },
  {
    id: 'no-security-bypass',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Users are not told to turn off security features',
    serious: 'The instructions tell users to turn off a security feature.',
    fix: 'Remove instructions that remove the quarantine attribute, disable Gatekeeper, or turn off SmartScreen, Microsoft Defender, or Smart App Control. Sign and notarize the files instead, and explain how to verify them.',
  },
  {
    id: 'no-terminal-paste',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Users are not told to paste a command that downloads and runs code',
    serious: 'The instructions tell users to paste a command that downloads and runs code.',
    fix: 'Remove commands that pipe downloaded content into a shell, PowerShell, or osascript. Tell users to download the zip archive from the release page instead.',
  },
  {
    id: 'dependency-pinning',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Dependencies are installed by a package manager with fixed versions',
    fix: 'Manage dependencies with vcpkg (fix the baseline) or pin each download to a commit or hash.',
  },
  {
    id: 'ci-hardening',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'CI runs with least privilege',
    fix: 'Set minimal permissions in each workflow, pin actions to full commit SHAs, set persist-credentials: false, and add .github/dependabot.yml.',
  },
  {
    id: 'third-party-provenance',
    kind: 'criterion',
    judgedBy: 'future',
    title: 'Third-party models and binaries document their origin and license',
    fix: 'Document the upstream URL, version, hash, and license terms of each bundled model or binary.',
  },
  {
    id: 'license-compatibility',
    kind: 'criterion',
    judgedBy: 'future',
    title: 'The plugin license is compatible with its dependencies',
    fix: 'Check that each dependency license is compatible with the plugin license, and replace dependencies that are not.',
  },
  {
    id: 'user-data-handling',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Video, audio, settings, and keys are not sent out without telling users',
    // ソースのコードは入力に含まない。通信の API の検出の結果 (事実) と、README とワークフローから判定する。
    // 重大は、通信の API があり、README が外部への送信に一切触れていないときに限る。README で説明している作者を止めないため。
    viewpoint:
      'If the facts show network API use in the source, or the README or the workflows show that the plugin sends video, audio, settings, or keys to another host, the README states where and what is sent. Read the network API lines in the facts to see what is sent. If the facts say none found and the files show no sending, answer met. If the facts say not scanned and the files do not show whether the plugin sends such data, answer unclear.',
    serious:
      'The facts show network API use in the source, and the README mentions no external host and no sending of data at all.',
    fix: 'State in the README what data is sent and where, or remove the transmission.',
  },
  {
    id: 'build-hardening',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'The build has hardening options',
    fix: 'Add a build option for sanitizers and enable stack protection flags such as -fstack-protector-strong or /GS.',
  },
  {
    id: 'windows-code-signing',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Windows DLLs are signed',
    fix: 'Consider Authenticode signing. Unsigned DLLs can be blocked by Smart App Control. This is not required for listing.',
  },
  {
    id: 'macos-code-signing',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'macOS packages are signed and notarized',
    fix: 'Consider a Developer ID signature and notarization. This is not required for listing.',
  },
  {
    id: 'user-verification-guide',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Users are shown how to verify downloads',
    fix: 'Add a short section to the README that shows how to verify a download with gh attestation verify.',
  },
  {
    id: 'install-location',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Windows users install into ProgramData',
    fix: 'Tell Windows users to extract the plugin into C:\\ProgramData\\obs-studio\\plugins.',
  },
  {
    id: 'hermetic-build',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Build runner images have fixed versions',
    fix: 'Use runner images with a fixed version, such as windows-2022, instead of windows-latest.',
  },
  {
    id: 'repository-protection',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'The default branch and release tags are protected by rulesets',
    fix: 'Add a branch ruleset for the default branch that blocks deletion and force pushes and requires a pull request with at least one approval, and a tag ruleset that restricts creating, updating, and deleting release tags to repository admins.',
  },
  {
    id: 'contribution-compliance',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Contributors agree to the license and sign off',
    fix: 'Ask contributors for DCO sign-off and license agreement in CONTRIBUTING.md.',
  },
  {
    id: 'reuse-compliance',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'The repository complies with REUSE',
    fix: 'Consider adding SPDX headers or REUSE.toml and running reuse lint in CI.',
  },
  {
    id: 'license-notices',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Bundled dependencies and models are credited with their licenses',
    fix: 'List the licenses of bundled dependencies and models in the README or a notices file.',
  },
  {
    id: 'plugin-name',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'The plugin name does not include OBS',
    fix: 'Avoid OBS in the plugin and repository names, as the OBS Forum Resource and IP Policy asks.',
  },
  {
    id: 'manifest-consistency',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'buildspec.json and data/manifest.json agree',
    fix: 'Keep the name, version, ID, and URL in buildspec.json and data/manifest.json the same.',
  },
  {
    id: 'crash-report-privacy',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'Crash report templates ask users to remove personal information',
    viewpoint:
      'The issue templates for crash reports or logs ask users to check that no personal information is included. The facts list the issue templates.',
    fix: 'Add a checkbox to the crash report template that asks users to remove personal information.',
  },
  {
    id: 'resource-raii',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'OBS resources are released with RAII',
    fix: 'Wrap OBS resources in RAII helpers (for example, std::unique_ptr with a custom deleter).',
  },
  {
    id: 'diagnostic-logging',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Failures are logged with enough detail to find the cause',
    fix: 'Log failures with blog() including what failed and why.',
  },
  {
    id: 'cpu-compatibility',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Instruction sets such as AVX2 are not required unconditionally',
    fix: 'Use runtime CPU dispatch instead of requiring AVX2 for the whole plugin.',
  },
  {
    id: 'dll-footprint',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Few DLLs are bundled',
    fix: 'Link dependencies statically where licenses allow, to reduce bundled DLLs.',
  },
  {
    id: 'security-policy',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'SECURITY.md states how to report issues',
    fix: 'Add SECURITY.md with a reporting channel and the supported versions.',
  },
];

export const CRITERIA_BY_ID = new Map(CRITERIA.map((criterion) => [criterion.id, criterion]));

export const LLM_CRITERIA = CRITERIA.filter((criterion) => criterion.judgedBy === 'llm');
