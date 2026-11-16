// 審査の基準と推奨のうち、ファイルを見れば機械的に決まる項目の判定 (docs/design/review-criteria.md)。
// 同じ入力には同じ結果を返す純粋な関数にする。LLM には、ここで計算した事実を渡し、文章の意図を読む項目だけを判定させる。

import type { RulesetSnapshot } from '../github';
import { LLM_CRITERIA } from './criteria';
import { type GuidanceRule, matchesSecurityBypass, matchesTerminalPaste } from './guidance-patterns.mjs';
import type { Finding, FindingResult } from './llm';
import type { DocScan, NetworkScan } from './network';

export interface RepositorySnapshot {
  // ref の時点のファイルのパスの一覧。
  paths: string[];
  // 一覧が切り詰められたか、得られなかった。ファイルの有無で決める判定を unclear にする。
  truncated: boolean;
  files: Array<{ path: string; content: string }>;
  // 上限のため読まなかったファイル。
  unreadFiles: string[];
  // ref の時点で GitHub がリポジトリの画面に表示する README のパス。中身は files にある。未設定か null なら README は無い。
  readmePath?: string | null;
  // README はあるが、上限を超えたか読めなかった。
  readmeUnread?: boolean;
  // 新しい版のリリースノートで、案内の型に当たった行。未設定なら照合していない (確認のモード)。
  releaseNotesHits?: Array<{ line: number; rule: 'no-security-bypass' | 'no-terminal-paste' }>;
  // README 以外の文書の照合の結果。本審査は GitHub Actions、確認のモードは src/review/check-docs.ts が照合する。
  // 'missing' は、本審査で期限までに結果が届かなかった。{missing} は、確認のモードで照合できなかった理由。
  // note は、照合の結果に添える説明。未設定なら照合していない。
  docScan?: (DocScan & { note?: string }) | 'missing' | { missing: string };
  // 通信の API の検出の結果。null か未設定なら、検出していない (確認のモード、期限切れ、検出の失敗)。
  network?: NetworkScan | null;
  // 有効な ruleset。未設定か readable が false なら、読めなかった。
  rulesets?: ({ readable: true } & RulesetSnapshot) | { readable: false };
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
  return snapshot.readmePath ? snapshot.files.find((entry) => entry.path === snapshot.readmePath) : undefined;
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
  if (snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
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
    return finding(
      id,
      'unclear',
      'Checked by rules: the workflows that were read meet the rules, but some workflows were not read.',
    );
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
  if (snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
  return finding(id, 'met', 'Checked by rules: no committed binaries and no unpinned downloads were found.');
}

function buildHardening(snapshot: RepositorySnapshot): Finding {
  const id = 'build-hardening';
  const builds = buildFiles(snapshot);
  if (builds.length === 0) return finding(id, 'unclear', 'Checked by rules: no CMake build files were read.');
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
  if (builds.length === 0) return finding(id, 'unclear', 'Checked by rules: no CMake build files were read.');
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
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
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
  if (snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
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
      'Checked by rules: the workflows that were read fix runner versions, but some workflows were not read.',
    );
  return finding(id, 'met', 'Checked by rules: every workflow uses runner images with fixed versions.');
}

const RULE_TYPES = (rules: RulesetSnapshot['items'][number]['rules']) => new Set(rules.map((rule) => rule.type));

function repositoryProtection(snapshot: RepositorySnapshot): Finding {
  const id = 'repository-protection';
  const rulesets = snapshot.rulesets;
  if (!rulesets?.readable)
    return finding(id, 'unclear', 'Checked by rules: the repository rulesets could not be read.');
  // 既定のブランチの名前は入力に無いため、名前を直接指定した ruleset は数えない。
  const branch = rulesets.items.some((item) => {
    if (item.target !== 'branch') return false;
    if (!item.include.some((name) => name === '~DEFAULT_BRANCH' || name === '~ALL')) return false;
    const types = RULE_TYPES(item.rules);
    const review = item.rules.find((rule) => rule.type === 'pull_request')?.parameters.required_approving_review_count;
    return types.has('deletion') && types.has('non_fast_forward') && typeof review === 'number' && review >= 1;
  });
  const tag = rulesets.items.some((item) => {
    if (item.target !== 'tag' || item.include.length === 0) return false;
    const types = RULE_TYPES(item.rules);
    return types.has('creation') && types.has('update') && types.has('deletion');
  });
  const note = 'Bypass lists are not visible to the catalog and are not checked.';
  if (branch && tag)
    return finding(
      id,
      'met',
      `Checked by rules: a branch ruleset protects the default branch and requires a reviewed pull request, and a tag ruleset restricts creating, updating, and deleting tags. ${note}`,
    );
  if (rulesets.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository has more active rulesets than the catalog reads.');
  const missing = [
    branch
      ? ''
      : 'a branch ruleset for the default branch that blocks deletion and force pushes and requires a pull request with at least one approval',
    tag ? '' : 'a tag ruleset that restricts creating, updating, and deleting tags',
  ].filter(Boolean);
  return finding(id, 'not_met', `Checked by rules: the repository does not have ${missing.join(' or ')}. ${note}`);
}

// README・リリースノート・README 以外の文書の案内の型は、GitHub Actions と共有する guidance-patterns.mjs に置く。
export {
  type GuidanceRule,
  guidanceHits,
  matchesSecurityBypass,
  matchesTerminalPaste,
} from './guidance-patterns.mjs';

// リリースノートの根拠に使うファイルの名前。リポジトリのファイルではないため、括弧で区別する。
export const RELEASE_NOTES = '(release notes)';

// README とリリースノートの行に案内の型を当てる。当たれば重大の not_met とし、当たった行を根拠に返す。
function readmePattern(
  snapshot: RepositorySnapshot,
  id: GuidanceRule,
  matches: (text: string) => boolean,
  found: string,
  none: string,
): Finding {
  // リリースノートは同期の時点で照合し、当たった行だけを渡す (src/domain/release-notes.ts)。確認のモードでは照合しない。
  const notes = (snapshot.releaseNotesHits ?? [])
    .filter((hit) => hit.rule === id)
    .map((hit) => at(RELEASE_NOTES, hit.line));
  const scanned =
    snapshot.docScan && snapshot.docScan !== 'missing' && 'hits' in snapshot.docScan ? snapshot.docScan : null;
  // README 以外の文書の当たり。README と同じファイルの当たりは、README の照合と重なるため捨てる。
  const docs = scanned
    ? scanned.hits
        .filter((hit) => hit.rule === id && hit.file !== snapshot.readmePath)
        .map((hit) => at(hit.file, hit.line))
    : [];
  const sources = [
    'the README',
    ...(snapshot.releaseNotesHits ? ['the release notes'] : []),
    ...(scanned ? ['the other documents'] : []),
  ];
  const note = scanned?.note ? ` ${scanned.note}` : '';
  // 文書を照合できなかった版を、照合した版と同じに扱わない。
  // リポジトリを大きくして取得を時間切れにすることで、照合を逃れられないようにするため。確認のモードでも、作者が公開の前に知れるよう重大にする。
  if (snapshot.docScan && !scanned) {
    return {
      ...finding(
        id,
        'not_met',
        snapshot.docScan === 'missing'
          ? 'Checked by rules: the documents other than the README could not be checked because the source could not be fetched and scanned in time.'
          : (snapshot.docScan as { missing: string }).missing,
        notes,
      ),
      serious: true,
    };
  }
  const doc = readme(snapshot);
  // 読めなかった README を、無い README と同じに扱わない。大きな README で照合を逃れられないようにするため。
  if (!doc && snapshot.readmeUnread) {
    return {
      ...finding(
        id,
        'not_met',
        'Checked by rules: the README is larger than 128 KB or could not be read, so the rules could not check it.',
        notes,
      ),
      serious: true,
    };
  }
  const hits = [
    ...(doc
      ? doc.content
          .split('\n')
          .map((text, index) => ({ text, line: index + 1 }))
          .filter(({ text }) => matches(text))
          .map(({ line }) => at(doc.path, line))
      : []),
    ...notes,
    ...docs,
  ];
  if (hits.length > 0)
    return {
      ...finding(id, 'not_met', `Checked by rules: ${sources.join(' or ')} ${found}${note}`, hits),
      serious: true,
    };
  if (!doc && !snapshot.releaseNotesHits && !snapshot.docScan)
    return finding(id, 'met', 'Checked by rules: the repository has no README.');
  return finding(id, 'met', `Checked by rules: no ${none} was found in ${sources.join(' and ')}.${note}`);
}

function noSecurityBypass(snapshot: RepositorySnapshot): Finding {
  return readmePattern(
    snapshot,
    'no-security-bypass',
    matchesSecurityBypass,
    'contains an instruction that removes the quarantine attribute, disables Gatekeeper, uses Open Anyway, or turns off or excludes SmartScreen, Microsoft Defender, or Smart App Control.',
    'instruction that turns off a security feature',
  );
}

function noTerminalPaste(snapshot: RepositorySnapshot): Finding {
  return readmePattern(
    snapshot,
    'no-terminal-paste',
    matchesTerminalPaste,
    'contains a command that downloads content and runs it at once.',
    'command that downloads content and runs it at once',
  );
}

function crashReportPrivacy(snapshot: RepositorySnapshot): Finding | null {
  // テンプレートがあれば、中身を LLM が判定する。
  if (issueTemplates(snapshot).length > 0 || snapshot.truncated) return null;
  return finding('crash-report-privacy', 'not_met', 'Checked by rules: the repository has no issue templates.');
}

export function judgeByRules(snapshot: RepositorySnapshot): Finding[] {
  const findings = [
    noSecurityBypass(snapshot),
    noTerminalPaste(snapshot),
    ciHardening(snapshot),
    dependencyPinning(snapshot),
    buildHardening(snapshot),
    cpuCompatibility(snapshot),
    userVerificationGuide(snapshot),
    installLocation(snapshot),
    contributionCompliance(snapshot),
    hermeticBuild(snapshot),
    repositoryProtection(snapshot),
    ciScenarioTests(snapshot),
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
// README は規則が全文を照合するために大きな上限で読むため、LLM には先頭の MAX_LLM_README_CHARS 文字だけを渡す。
export function llmFiles(snapshot: RepositorySnapshot): RepositorySnapshot['files'] {
  const doc = readme(snapshot);
  return snapshot.files
    .filter((entry) => entry === doc || WORKFLOW.test(entry.path) || TEMPLATE.test(entry.path))
    .map((entry) =>
      entry === doc && entry.content.length > MAX_LLM_README_CHARS
        ? {
            path: entry.path,
            content: `${entry.content.slice(0, MAX_LLM_README_CHARS)}\n[The rest of the README is not provided because of the size limits.]`,
          }
        : entry,
    );
}

export const MAX_LLM_README_CHARS = 32 * 1024;

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
  lines.push(networkFact(snapshot.network));
  lines.push(`Results of the rule-based items: ${ruled.map((entry) => `${entry.id}=${entry.result}`).join(', ')}`);
  return lines.join('\n');
}

// ci-scenario-tests の判定。ビルドが通るだけで動作しないプラグインを見分けるため、CI のワークフローが OBS Studio を
// 起動するか、ワークフローがテストを実行し、かつテストのソースが libobs を初期化してモジュールを読み込むことを求める。
// xvfb-run は画面の無い実行を示すだけで、OBS Studio の起動を示さない。テストが機能の結果を確かめているかは見ない。
// ワークフローから呼ぶスクリプト (.github/scripts など) の中の起動は読まない (2026-11-15 依頼者の判断。外部呼び出しの予算のため)。
const TEST_SOURCE = /\.(c|cc|cpp|cxx|h|hpp|py)$/i;
const TEST_DIR = /(^|\/)[^/]*(test|integration|scenario|e2e)[^/]*(\/|$)/i;
const THIRD_PARTY = /(^|\/)(\.deps|build[^/]*|vendor|third[_-]?party|external|deps)\//i;
const LIBOBS_INIT = /\b(obs_startup|obs_load_module|obs_init_module|obs_reset_video)\s*\(/;
// テストの実行ファイルは変数で起動されることが多い (例: "${integration}")。そのため、テストに関わる語を含む行も実行の行に数える。
const TEST_RUN = /\b(ctest|pytest|npm (run )?test|cargo test|make test)\b|integration|scenario|e2e/i;
// OBS Studio を起動する形だけに当てる。OBS を起動すれば、それ自体がプラグインを読み込む実行になるため、
// テストを実行する行を別に求めない。そのかわり、OBS.app のコピーや署名の確認、obs --version、
// flatpak install、apt-get install obs-studio のような起動ではない言及は当てない。
const OBS_LAUNCH: RegExp[] = [
  /\bobs64\.exe\b/i,
  /\bOBS\.app\/Contents\/MacOS\/OBS\b/,
  /\bflatpak\s+run\s+(?:\S+\s+)*com\.obsproject\.Studio\b/i,
  // Linux の obs をオプション付きで起動する行。短い形式は -m (--multi) と -p (--portable) だけを数える。
  // OBS Studio の短い形式は -m・-p・-h・-V の 4 つで (frontend/obs-main.cpp)、-h と -V は表示だけのため。
  /(?:^|[\s;&|("'/])obs\s+--[a-z]/i,
  /(?:^|[\s;&|("'/])obs\s+-[mp]\b/,
];
// 同じ行にあれば起動とみなさない語。ファイルの操作、署名や情報の確認、版と使い方の表示。
const OBS_NOT_LAUNCH =
  /\b(?:copy|cp|mv|move|xcopy|robocopy|copy-item|move-item|remove-item|rm|test-path|get-item|ls|dir|codesign|spctl|plutil|defaults|ditto)\b|--version\b|--help\b/i;
const LOCAL_INCLUDE = /^\s*#\s*include\s*"([^"]+)"/gm;

// テストのソースの候補。パスに integration か e2e を含むものを先にする。
export function testSources(paths: string[]): string[] {
  const priority = (path: string) => Number(!/integration|e2e/i.test(path));
  return paths
    .filter((path) => TEST_SOURCE.test(path) && TEST_DIR.test(path) && !THIRD_PARTY.test(path))
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
}

// ソースの #include "..." のうち、一覧にあるファイル。libobs の初期化は補助のヘッダーに置かれることが多いため、たどって読む。
export function localIncludes(path: string, content: string, paths: string[]): string[] {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const known = new Set(paths);
  const result: string[] = [];
  for (const match of content.matchAll(LOCAL_INCLUDE)) {
    const parts: string[] = [];
    for (const part of `${dir}${match[1]}`.split('/')) {
      if (part === '..') parts.pop();
      else if (part !== '.' && part !== '') parts.push(part);
    }
    const resolved = parts.join('/');
    if (known.has(resolved) && !result.includes(resolved)) result.push(resolved);
  }
  return result;
}

function ciScenarioTests(snapshot: RepositorySnapshot): Finding {
  const id = 'ci-scenario-tests';
  const flowHits = (pattern: RegExp) =>
    workflows(snapshot).flatMap((flow) => matchingLines(flow.content, pattern).map(({ line }) => at(flow.path, line)));
  const candidates = new Set(testSources(snapshot.paths));
  const sources = snapshot.files.filter((entry) => candidates.has(entry.path));
  const runs = flowHits(TEST_RUN);
  const obs = workflows(snapshot).flatMap((flow) =>
    flow.content
      .split('\n')
      .map((text, index) => ({ text, line: index + 1 }))
      .filter(({ text }) => OBS_LAUNCH.some((pattern) => pattern.test(text)) && !OBS_NOT_LAUNCH.test(text))
      .map(({ line }) => at(flow.path, line)),
  );
  const init = sources.flatMap((entry) =>
    matchingLines(entry.content, LIBOBS_INIT).map(({ line }) => at(entry.path, line)),
  );
  if (obs.length > 0) {
    return finding(id, 'met', 'Checked by rules: a workflow starts the OBS Studio executable.', obs.slice(0, 2));
  }
  if (runs.length > 0 && init.length > 0) {
    return finding(
      id,
      'met',
      'Checked by rules: a workflow runs tests, and a test source starts libobs or loads a module.',
      [runs[0] as Evidence, ...init.slice(0, 2)],
    );
  }
  if (snapshot.truncated || unreadWorkflows(snapshot)) {
    return finding(
      id,
      'unclear',
      'Checked by rules: the repository file list or some workflows could not be read in full.',
    );
  }
  const read = sources.map((entry) => entry.path).join(', ') || 'none';
  return finding(
    id,
    'not_met',
    runs.length === 0
      ? 'Checked by rules: no workflow line runs tests.'
      : `Checked by rules: a workflow runs tests, but the test sources read (${read}) do not start libobs or load a module, and no workflow starts the OBS Studio executable.`,
    runs.slice(0, 2),
  );
}

// 通信の API の検出の結果の事実。行の文字列はリポジトリのコードから取ったデータで、1 行に収める。
function networkFact(network: NetworkScan | null | undefined): string {
  const label = 'Network API use found in the source by the catalog';
  if (!network) return `${label}: not scanned`;
  if (network.hits.length === 0) return `${label}: none found`;
  const hits = network.hits.map((hit) => `${clean(hit.file)}:${hit.line} (${hit.api}): ${clean(hit.text)}`);
  return `${label}${network.truncated ? ' (first 50 only)' : ''}: ${hits.join(' | ')}`;
}

// 根拠として認める、検出で当たったソースのファイル。
export function networkFiles(snapshot: RepositorySnapshot): string[] {
  return [...new Set((snapshot.network?.hits ?? []).map((hit) => hit.file))];
}

// 同じ項目が規則と LLM の両方にあれば、規則の結果を使う。
export function mergeFindings(ruled: Finding[], llm: Finding[]): Finding[] {
  const ids = new Set(ruled.map((entry) => entry.id));
  return [...ruled, ...llm.filter((entry) => !ids.has(entry.id))];
}
