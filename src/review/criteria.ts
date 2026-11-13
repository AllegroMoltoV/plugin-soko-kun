// 審査の基準の固定の文言。正本は docs/design/review-criteria.md で、ID の一致をテストで確かめる。
// 作者の LLM に返す文言は英語に固定する。title・fix・viewpoint は本サービスが書き、LLM には書かせない。
export type CriterionKind = 'condition' | 'takeover' | 'criterion' | 'recommendation';
export type JudgedBy = 'rule' | 'llm' | 'future';

export interface Criterion {
  id: string;
  kind: CriterionKind;
  judgedBy: JudgedBy;
  title: string;
  // LLM に渡す判定の観点。LLM が判定する項目だけが持つ。
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
    id: 'ci-source-build',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Release files are built from source in CI',
    viewpoint:
      'The job that produces release files builds them from the source in the repository. It does not only attach binaries built elsewhere.',
    fix: 'Build the release files from source in the GitHub Actions job that creates the release.',
  },
  {
    id: 'ci-scenario-tests',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Tests exercise the plugin in real use scenarios',
    viewpoint:
      'CI runs tests that load the plugin in OBS Studio and check its features, not only a build that compiles.',
    fix: 'Add a CI job that starts OBS Studio with the built plugin and checks that its features work in a scene.',
  },
  {
    id: 'no-security-bypass',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Users are not told to turn off security features',
    viewpoint:
      'The README and install instructions do not tell users to disable SmartScreen, Microsoft Defender, Gatekeeper, or Smart App Control.',
    serious: 'The instructions tell users to disable a security feature.',
    fix: 'Remove instructions that disable security features. If a warning appears, explain how to verify the file instead.',
  },
  {
    id: 'dependency-pinning',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Dependencies are installed by a package manager with fixed versions',
    viewpoint:
      'Dependencies come from a package manager such as vcpkg, or from FetchContent with a fixed commit or hash. There are no downloads from URLs without a hash and no binaries committed to the repository.',
    fix: 'Manage dependencies with vcpkg (fix the baseline) or pin each download to a commit or hash.',
  },
  {
    id: 'ci-hardening',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'CI runs with least privilege',
    viewpoint:
      'Workflows set minimal permissions, pin actions to a commit SHA, use persist-credentials: false for checkout, and the repository configures Dependabot.',
    fix: 'Set minimal permissions in each workflow, pin actions to full commit SHAs, set persist-credentials: false, and add .github/dependabot.yml.',
  },
  {
    id: 'third-party-provenance',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Third-party models and binaries document their origin and license',
    viewpoint:
      'For bundled third-party models or binaries, the repository documents the upstream URL, version, hash, and the copyright, license, patent, and redistribution terms.',
    fix: 'Document the upstream URL, version, hash, and license terms of each bundled model or binary.',
  },
  {
    id: 'license-compatibility',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'The plugin license is compatible with its dependencies',
    viewpoint:
      'The plugin license and the licenses of its dependencies can be combined (for example, GPLv2 code is not linked with an incompatible library).',
    fix: 'Check that each dependency license is compatible with the plugin license, and replace dependencies that are not.',
  },
  {
    id: 'user-data-handling',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Video, audio, settings, and keys are not sent out without telling users',
    viewpoint:
      'Find code that sends data over the network. If video, audio, settings, or keys are sent, the README states where and what is sent, and the code matches the README.',
    serious: 'The code sends video, audio, settings, or keys to another host and the README does not say so.',
    fix: 'State in the README what data is sent and where, or remove the transmission.',
  },
  {
    id: 'build-hardening',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'The build has hardening options',
    viewpoint: 'The build can enable sanitizers (ASan, UBSan) and uses stack protection flags.',
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
    judgedBy: 'llm',
    title: 'Users are shown how to verify downloads',
    viewpoint: 'The README shows how to verify a downloaded file, for example with gh attestation verify or a SHA-256 hash.',
    fix: 'Add a short section to the README that shows how to verify a download with gh attestation verify.',
  },
  {
    id: 'install-location',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'Windows users install into ProgramData',
    viewpoint:
      'Windows install instructions place the plugin in C:\\ProgramData\\obs-studio\\plugins and not under Program Files.',
    fix: 'Tell Windows users to extract the plugin into C:\\ProgramData\\obs-studio\\plugins.',
  },
  {
    id: 'hermetic-build',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'The build environment is narrowed and tool versions are fixed',
    viewpoint: 'Build workflows limit PATH and the environment and fix the versions of build tools.',
    fix: 'Fix tool versions and narrow PATH in the build workflows.',
  },
  {
    id: 'contribution-compliance',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'Contributors agree to the license and sign off',
    viewpoint: 'CONTRIBUTING or a PR template asks contributors for license agreement, DCO sign-off, and signed commits.',
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
    judgedBy: 'llm',
    title: 'Bundled dependencies and models are credited with their licenses',
    viewpoint: 'The README or a notices file lists the licenses of bundled dependencies and models.',
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
    viewpoint: 'Issue templates for crash reports or logs ask users to check that no personal information is included.',
    fix: 'Add a checkbox to the crash report template that asks users to remove personal information.',
  },
  {
    id: 'resource-raii',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'OBS resources are released with RAII',
    viewpoint: 'Calls such as bfree, obs_data_release, and obs_source_release are wrapped so that resources are released automatically.',
    fix: 'Wrap OBS resources in RAII helpers (for example, std::unique_ptr with a custom deleter).',
  },
  {
    id: 'diagnostic-logging',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'Failures are logged with enough detail to find the cause',
    viewpoint: 'The plugin logs failures with enough detail for users to report the cause.',
    fix: 'Log failures with blog() including what failed and why.',
  },
  {
    id: 'cpu-compatibility',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'Instruction sets such as AVX2 are not required unconditionally',
    viewpoint: 'The build does not force /arch:AVX2 or -mavx2 for all code without runtime dispatch.',
    fix: 'Use runtime CPU dispatch instead of requiring AVX2 for the whole plugin.',
  },
  {
    id: 'dll-footprint',
    kind: 'recommendation',
    judgedBy: 'llm',
    title: 'Few DLLs are bundled',
    viewpoint: 'The package bundles few extra DLLs, to avoid conflicts with other plugins.',
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
