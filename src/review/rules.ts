// 審査の基準と推奨のうち、ファイルを見れば機械的に決まる項目の判定 (docs/design/review-criteria.md)。
// 同じ入力には同じ結果を返す純粋な関数にする。LLM には、ここで計算した事実を渡し、文章の意図を読む項目だけを判定させる。
import { LLM_CRITERIA } from './criteria';
import type { Finding, FindingResult } from './llm';

export interface RepositorySnapshot {
  // ref の時点のファイルのパスの一覧。
  paths: string[];
  // 一覧が切り詰められたか、得られなかった。ファイルの有無で決める判定を unclear にする。
  truncated: boolean;
  files: Array<{ path: string; content: string }>;
  // 上限のため読まなかったファイル。
  unreadFiles: string[];
}

type Evidence = Finding['evidence'][number];

const SHA = /^[0-9a-f]{40}$/;
const WORKFLOW = /^\.github\/workflows\//;
const TEMPLATE = /^\.github\/ISSUE_TEMPLATE\/[^/]+\.(md|ya?ml)$/i;
const TEMPLATE_CONFIG = /\/config\.ya?ml$/i;
const BINARY = /\.(dll|lib|so|dylib|a|exe)$/i;

function finding(id: string, result: FindingResult, explanation: string, evidence: Evidence[] = []): Finding {
  return { id, result, serious: false, explanation, evidence: evidence.slice(0, 5) };
}

// 正規表現に当たる行の番号 (1 始まり) と、その行の文字列。
function matchingLines(content: string, pattern: RegExp): Array<{ line: number; text: string }> {
  const result: Array<{ line: number; text: string }> = [];
  content.split('\n').forEach((text, index) => {
    if (pattern.test(text)) result.push({ line: index + 1, text });
  });
  return result;
}

function at(file: string, line: number): Evidence {
  return { file, lines: `${line}-${line}` };
}

function file(snapshot: RepositorySnapshot, path: string): string | undefined {
  return snapshot.files.find((entry) => entry.path === path)?.content;
}

function readme(snapshot: RepositorySnapshot): { path: string; content: string } | undefined {
  return snapshot.files.find((entry) => entry.path === 'README.md');
}

function buildFiles(snapshot: RepositorySnapshot): Array<{ path: string; content: string }> {
  return snapshot.files.filter((entry) => entry.path === 'CMakeLists.txt' || /^cmake\/.*\.cmake$/i.test(entry.path));
}

function workflows(snapshot: RepositorySnapshot): Array<{ path: string; content: string }> {
  return snapshot.files.filter((entry) => WORKFLOW.test(entry.path));
}

function unreadWorkflows(snapshot: RepositorySnapshot): boolean {
  return snapshot.unreadFiles.some((path) => WORKFLOW.test(path));
}

export function issueTemplates(snapshot: RepositorySnapshot): string[] {
  return snapshot.paths.filter((path) => TEMPLATE.test(path) && !TEMPLATE_CONFIG.test(path)).sort();
}

function ciHardening(snapshot: RepositorySnapshot): Finding {
  const id = 'ci-hardening';
  const flows = workflows(snapshot);
  if (snapshot.truncated) return finding(id, 'unclear', 'The repository file list was too large to read in full.');
  if (flows.length === 0 && !unreadWorkflows(snapshot))
    return finding(id, 'not_applicable', 'The repository has no GitHub Actions workflows.');
  const problems: Evidence[] = [];
  const reasons = new Set<string>();
  for (const flow of flows) {
    if (!/^\s*permissions\s*:/m.test(flow.content)) {
      problems.push({ file: flow.path });
      reasons.add('a workflow does not set permissions');
    }
    for (const { line } of matchingLines(flow.content, /write-all/)) {
      problems.push(at(flow.path, line));
      reasons.add('a workflow grants write-all');
    }
    for (const { line, text } of matchingLines(flow.content, /^\s*-?\s*uses\s*:/)) {
      const ref = /uses\s*:\s*['"]?([^\s'"#]+)/.exec(text)?.[1] ?? '';
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
      if (!SHA.test(ref.split('@')[1] ?? '')) {
        problems.push(at(flow.path, line));
        reasons.add('an action is not pinned to a full commit SHA');
      }
    }
    const checkouts = matchingLines(flow.content, /uses\s*:\s*['"]?actions\/checkout@/).length;
    const persist = matchingLines(flow.content, /persist-credentials\s*:\s*['"]?false/).length;
    if (persist < checkouts) {
      problems.push({ file: flow.path });
      reasons.add('a checkout step does not set persist-credentials: false');
    }
  }
  if (!snapshot.paths.some((path) => /^\.github\/dependabot\.ya?ml$/.test(path)))
    reasons.add('Dependabot is not configured');
  if (reasons.size > 0) return finding(id, 'not_met', `Checked by rules: ${[...reasons].join('; ')}.`, problems);
  if (unreadWorkflows(snapshot))
    return finding(id, 'unclear', 'The workflows that were read meet the rules, but some workflows were not read.');
  return finding(
    id,
    'met',
    'Checked by rules: every workflow sets permissions, pins actions, and disables persisted credentials.',
  );
}

function dependencyPinning(snapshot: RepositorySnapshot): Finding {
  const id = 'dependency-pinning';
  const problems: Evidence[] = [];
  const reasons = new Set<string>();
  for (const path of snapshot.paths.filter((entry) => BINARY.test(entry)).slice(0, 5)) {
    problems.push({ file: path });
    reasons.add('binaries are committed to the repository');
  }
  for (const build of buildFiles(snapshot)) {
    for (const block of build.content.matchAll(/FetchContent_Declare\s*\(([^)]*)\)/gi)) {
      const body = block[1] ?? '';
      const tag = /GIT_TAG\s+(\S+)/i.exec(body)?.[1] ?? '';
      if (!SHA.test(tag) && !/URL_HASH/i.test(body)) {
        problems.push(at(build.path, build.content.slice(0, block.index).split('\n').length));
        reasons.add('a FetchContent dependency is not pinned to a commit or hash');
      }
    }
    for (const block of build.content.matchAll(/file\s*\(\s*DOWNLOAD([^)]*)\)/gi)) {
      if (!/EXPECTED_HASH/i.test(block[1] ?? '')) {
        problems.push(at(build.path, build.content.slice(0, block.index).split('\n').length));
        reasons.add('a download has no expected hash');
      }
    }
  }
  const vcpkg = file(snapshot, 'vcpkg.json');
  if (
    vcpkg !== undefined &&
    !/"builtin-baseline"/.test(vcpkg) &&
    !snapshot.paths.includes('vcpkg-configuration.json')
  ) {
    problems.push({ file: 'vcpkg.json' });
    reasons.add('vcpkg.json has no builtin-baseline');
  }
  if (reasons.size > 0) return finding(id, 'not_met', `Checked by rules: ${[...reasons].join('; ')}.`, problems);
  if (snapshot.truncated) return finding(id, 'unclear', 'The repository file list was too large to read in full.');
  return finding(id, 'met', 'Checked by rules: no committed binaries and no unpinned downloads were found.');
}

function buildHardening(snapshot: RepositorySnapshot): Finding {
  const id = 'build-hardening';
  const builds = buildFiles(snapshot);
  if (builds.length === 0) return finding(id, 'unclear', 'No CMake build files were read.');
  const sanitizer = builds.flatMap((build) =>
    matchingLines(build.content, /[-/]fsanitize/i).map(({ line }) => at(build.path, line)),
  );
  const stack = builds.flatMap((build) =>
    matchingLines(build.content, /-fstack-protector|\/GS\b/).map(({ line }) => at(build.path, line)),
  );
  if (sanitizer.length > 0 && stack.length > 0)
    return finding(id, 'met', 'Checked by rules: the build sets sanitizer and stack protection options.', [
      ...sanitizer,
      ...stack,
    ]);
  return finding(
    id,
    'not_met',
    `Checked by rules: the build files that were read do not set ${[
      sanitizer.length === 0 ? 'a sanitizer option (-fsanitize)' : '',
      stack.length === 0
        ? 'stack protection (-fstack-protector or /GS; MSVC enables /GS by default, but the criterion asks for the setting to be explicit)'
        : '',
    ]
      .filter(Boolean)
      .join(' or ')}.`,
  );
}

function cpuCompatibility(snapshot: RepositorySnapshot): Finding {
  const id = 'cpu-compatibility';
  const builds = buildFiles(snapshot);
  if (builds.length === 0) return finding(id, 'unclear', 'No CMake build files were read.');
  const forced = builds.flatMap((build) =>
    matchingLines(build.content, /\/arch:AVX(2|512)|-mavx(2|512)|-march=native/i).map(({ line }) =>
      at(build.path, line),
    ),
  );
  if (forced.length > 0)
    return finding(id, 'not_met', 'Checked by rules: the build forces an instruction set such as AVX2.', forced);
  return finding(id, 'met', 'Checked by rules: the build does not force AVX2, AVX-512, or -march=native.');
}

function userVerificationGuide(snapshot: RepositorySnapshot): Finding {
  const id = 'user-verification-guide';
  const doc = readme(snapshot);
  const hits = doc
    ? matchingLines(doc.content, /gh attestation verify|sha-?256|checksum|get-filehash|ハッシュ/i).map(({ line }) =>
        at(doc.path, line),
      )
    : [];
  if (hits.length > 0) return finding(id, 'met', 'Checked by rules: the README shows how to verify a download.', hits);
  return finding(
    id,
    'not_met',
    'Checked by rules: the README does not mention gh attestation verify, a SHA-256 hash, or a checksum.',
  );
}

function installLocation(snapshot: RepositorySnapshot): Finding {
  const id = 'install-location';
  const doc = readme(snapshot);
  const hits = doc
    ? // %PROGRAMDATA%\obs-studio\plugins の書き方も同じ場所を指す。
      matchingLines(doc.content, /programdata%?[\\/]+obs-studio[\\/]+plugins/i).map(({ line }) => at(doc.path, line))
    : [];
  if (hits.length > 0)
    return finding(id, 'met', 'Checked by rules: the README places the plugin in ProgramData.', hits);
  return finding(
    id,
    'not_met',
    'Checked by rules: the README does not tell Windows users to use C:\\ProgramData\\obs-studio\\plugins.',
  );
}

function contributionCompliance(snapshot: RepositorySnapshot): Finding {
  const id = 'contribution-compliance';
  const docs = snapshot.files.filter((entry) => /(^|\/)CONTRIBUTING\.md$|pull_request_template\.md$/i.test(entry.path));
  const hits = docs.flatMap((doc) =>
    matchingLines(doc.content, /\bDCO\b|Developer Certificate of Origin|Signed-off-by|sign-?off/i).map(({ line }) =>
      at(doc.path, line),
    ),
  );
  if (hits.length > 0) return finding(id, 'met', 'Checked by rules: contributors are asked for a DCO sign-off.', hits);
  if (docs.length === 0 && snapshot.truncated)
    return finding(id, 'unclear', 'The repository file list was too large to read in full.');
  return finding(
    id,
    'not_met',
    docs.length === 0
      ? 'Checked by rules: the repository has no CONTRIBUTING.md or pull request template.'
      : 'Checked by rules: CONTRIBUTING.md and the pull request template do not ask for a DCO sign-off.',
    docs.map((doc) => ({ file: doc.path })),
  );
}

function hermeticBuild(snapshot: RepositorySnapshot): Finding {
  const id = 'hermetic-build';
  const flows = workflows(snapshot);
  if (snapshot.truncated) return finding(id, 'unclear', 'The repository file list was too large to read in full.');
  if (flows.length === 0 && !unreadWorkflows(snapshot))
    return finding(id, 'not_applicable', 'The repository has no GitHub Actions workflows.');
  const latest = flows.flatMap((flow) =>
    matchingLines(flow.content, /\b(ubuntu|windows|macos)-latest\b/).map(({ line }) => at(flow.path, line)),
  );
  if (latest.length > 0)
    return finding(
      id,
      'not_met',
      'Checked by rules: a workflow uses a runner image whose version is not fixed (-latest).',
      latest,
    );
  if (unreadWorkflows(snapshot))
    return finding(
      id,
      'unclear',
      'The workflows that were read fix runner versions, but some workflows were not read.',
    );
  return finding(id, 'met', 'Checked by rules: every workflow uses runner images with fixed versions.');
}

function crashReportPrivacy(snapshot: RepositorySnapshot): Finding | null {
  // テンプレートがあれば、中身を LLM が判定する。
  if (issueTemplates(snapshot).length > 0 || snapshot.truncated) return null;
  return finding('crash-report-privacy', 'not_met', 'Checked by rules: the repository has no issue templates.');
}

export function judgeByRules(snapshot: RepositorySnapshot): Finding[] {
  const findings = [
    ciHardening(snapshot),
    dependencyPinning(snapshot),
    buildHardening(snapshot),
    cpuCompatibility(snapshot),
    userVerificationGuide(snapshot),
    installLocation(snapshot),
    contributionCompliance(snapshot),
    hermeticBuild(snapshot),
    crashReportPrivacy(snapshot),
  ];
  return findings.filter((entry): entry is Finding => entry !== null);
}

// LLM に判定させる項目。crash-report-privacy は、テンプレートが無くて規則で決まった回は含めない。
export function llmCriteriaFor(snapshot: RepositorySnapshot): string[] {
  const ruled = crashReportPrivacy(snapshot) !== null;
  return LLM_CRITERIA.map((criterion) => criterion.id).filter((id) => !(ruled && id === 'crash-report-privacy'));
}

// LLM に渡すファイル。規則だけが読むビルドの設定、vcpkg.json、CONTRIBUTING は渡さない。
export function llmFiles(files: RepositorySnapshot['files']): RepositorySnapshot['files'] {
  return files.filter((entry) => entry.path === 'README.md' || WORKFLOW.test(entry.path) || TEMPLATE.test(entry.path));
}

// リポジトリから取った文字列を、事実の 1 行に収まる短い文字列にする。
function clean(text: string): string {
  return text
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

const NETWORK_WORDS = /\bAPI\b|api key|openai|upload|send|transmit|送信|外部/i;

// 本サービスがファイルの一覧と中身から計算した事実。LLM が自分で探す手間と思い込みを減らすため。
export function computeFacts(snapshot: RepositorySnapshot, ruled: Finding[]): string {
  const lines: string[] = [];
  lines.push(`File list complete: ${snapshot.truncated ? 'no (too large)' : 'yes'}`);
  const templates = issueTemplates(snapshot);
  lines.push(`Issue templates: ${templates.length > 0 ? templates.map(clean).join(', ') : 'none'}`);
  const scripts = snapshot.paths.filter((path) => /^\.github\/scripts\//.test(path)).slice(0, 30);
  lines.push(`Scripts under .github/scripts: ${scripts.length > 0 ? scripts.map(clean).join(', ') : 'none'}`);
  const doc = readme(snapshot);
  if (doc) {
    const headings = matchingLines(doc.content, /^#{1,4}\s/).slice(0, 40);
    lines.push(`README headings: ${headings.map(({ line, text }) => `${line}: ${clean(text)}`).join(' | ') || 'none'}`);
    const hosts = new Map<string, number[]>();
    for (const { line, text } of matchingLines(doc.content, /https?:\/\//)) {
      for (const match of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        const host = (match[1] ?? '').toLowerCase();
        hosts.set(host, [...(hosts.get(host) ?? []), line]);
      }
    }
    lines.push(
      `README URL hosts (line numbers): ${
        [...hosts.entries()]
          .slice(0, 30)
          .map(([host, at]) => `${clean(host)} (${at.slice(0, 5).join(', ')})`)
          .join(', ') || 'none'
      }`,
    );
    const network = matchingLines(doc.content, NETWORK_WORDS).map(({ line }) => line);
    lines.push(`README lines that mention APIs or sending data: ${network.slice(0, 30).join(', ') || 'none'}`);
  } else {
    lines.push('README: not present');
  }
  lines.push(`Results of the rule-based items: ${ruled.map((entry) => `${entry.id}=${entry.result}`).join(', ')}`);
  return lines.join('\n');
}

// 同じ項目が規則と LLM の両方にあれば、規則の結果を使う。
export function mergeFindings(ruled: Finding[], llm: Finding[]): Finding[] {
  const ids = new Set(ruled.map((entry) => entry.id));
  return [...ruled, ...llm.filter((entry) => !ids.has(entry.id))];
}
