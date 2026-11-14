// 新しい版の検査 (docs/design/scanning.md の「新しい版の検査」)。Cron の定期処理から 1 回の起動で 1 件ずつ行う。
// 宣言ファイルの判定、乗っ取りの兆候のルールの検査、規則と LLM による開発の実践のレビューを行い、release_checks に書く。
import type { Budget } from '../budget';
import type { Env } from '../env';
import { GitHubClient, GitHubError } from '../github';
import { checkDiff } from '../review/diff-rules';
import { type Finding, runReview } from '../review/llm';
import { NETWORK_WAIT_MS, NETWORK_WAITING, readNetworkScan } from '../review/network';
import {
  computeFacts,
  judgeByRules,
  llmCriteriaFor,
  llmFiles,
  mergeFindings,
  networkFiles,
  type RepositorySnapshot,
} from '../review/rules';
import { getPluginViewByInternalId } from './catalog';
import { OS_VALUES } from './metadata';
import { MAX_REVIEW_ATTEMPTS } from './status';

// レビューのファイルの収集の外部呼び出しの上限。ファイルの一覧 1、ワークフロー 6、README 1、CMakeLists.txt 1、
// ビルドの設定の cmake 2、vcpkg.json 1、CONTRIBUTING 1、PR テンプレート 1、Issue テンプレート 2 の合計。
export const REVIEW_FILES_COST = 16;
// 1 件の検査の外部呼び出しの上限。宣言ファイル 1、差分 1、レビューのファイルの収集、LLM 1 の合計。
export const RELEASE_CHECK_COST = 3 + REVIEW_FILES_COST;
const MAX_DIFF_CHARS = 24_000;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_CHARS = 60_000;
const MAX_WORKFLOWS = 6;
const MAX_COMPILER_FILES = 2;
const MAX_ISSUE_TEMPLATES = 2;
const MAX_CONFIG_BYTES = 16 * 1024;

interface PendingRow {
  github_release_id: number;
  plugin_id: string;
  owner: string;
  repo: string;
  tag: string;
  diff_state: string;
  config_state: string;
  review_state: string;
  review_attempts: number;
  network_state: string;
  network_hits: string | null;
  network_ready: number;
}

// 通信の検出の結果が届いたか、待つ期限を過ぎた。プレースホルダーには期限の時刻を 1 つ渡す。
const NETWORK_READY = `(NOT ${NETWORK_WAITING} OR r.published_at <= ?)`;

export type ConfigResult =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'no_declared_assets' }
  | { state: 'ok'; name: string | null; os: string[] | null };

// .soko-kun/config.json の判定。assetOs は、その版の配布物の OS (ソースの配布物は null)。
export function parseConfig(text: string | 'too_large' | null, assetOs: Array<string | null>): ConfigResult {
  if (text === null) return { state: 'missing' };
  if (text === 'too_large') return { state: 'invalid' };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { state: 'invalid' };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { state: 'invalid' };
  const { name, os } = body as { name?: unknown; os?: unknown };
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 60)) {
    return { state: 'invalid' };
  }
  if (os !== undefined) {
    const values = OS_VALUES as readonly string[];
    if (
      !Array.isArray(os) ||
      os.length === 0 ||
      !os.every((value) => typeof value === 'string' && values.includes(value))
    ) {
      return { state: 'invalid' };
    }
    if (!assetOs.some((value) => value !== null && os.includes(value))) return { state: 'no_declared_assets' };
  }
  return {
    state: 'ok',
    name: typeof name === 'string' ? name.trim() : null,
    os: Array.isArray(os) ? [...new Set(os as string[])].sort() : null,
  };
}

export async function runReleaseChecks(env: Env, budget: Budget): Promise<number> {
  if (!budget.canFetch(RELEASE_CHECK_COST) || !budget.canQuery(4)) return 0;
  const now = new Date();
  // 通信の検出の結果を、版の公開から NETWORK_WAIT_MS まで待つ。過ぎたら検出の結果なしでレビューする。
  const networkDeadline = new Date(now.getTime() - NETWORK_WAIT_MS).toISOString();
  budget.takeD1Query();
  const row = await env.DB.prepare(
    `SELECT c.github_release_id, r.plugin_id, p.owner, p.repo, r.tag, c.diff_state, c.config_state, c.review_state,
       c.review_attempts, c.network_state, c.network_hits, ${NETWORK_READY} AS network_ready
     FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id JOIN plugins p ON p.id = r.plugin_id
     WHERE c.legacy = 0 AND p.removed = 0 AND c.review_attempts < ? AND (c.diff_state = 'pending'
       OR c.config_state = 'pending'
       OR (c.review_state IN ('pending', 'failed') AND (c.review_wait_until IS NULL OR c.review_wait_until <= ?)
         AND ${NETWORK_READY}))
     ORDER BY r.published_at LIMIT 1`,
  )
    .bind(networkDeadline, MAX_REVIEW_ATTEMPTS, now.toISOString(), networkDeadline)
    .first<PendingRow>();
  if (!row) return 0;

  const github = new GitHubClient(budget, {
    kind: 'app',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });
  try {
    await checkOne(env, budget, github, row);
  } catch (error) {
    if (error instanceof GitHubError && (error.kind === 'rate_limited' || error.kind === 'unavailable')) throw error;
    if (!(error instanceof GitHubError)) throw error;
    // そのリポジトリに固有の失敗 (403 など) は、試行の回数だけ進める。上限に達した版は選ばれなくなり、管理者の一覧に残る。
    budget.takeD1Query();
    await env.DB.prepare(
      "UPDATE release_checks SET review_state = 'failed', review_attempts = review_attempts + 1 WHERE github_release_id = ?",
    )
      .bind(row.github_release_id)
      .run();
  }
  return 1;
}

async function checkOne(env: Env, budget: Budget, github: GitHubClient, row: PendingRow): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  const update = (sql: string, ...values: unknown[]) =>
    statements.push(
      env.DB.prepare(`UPDATE release_checks SET ${sql} WHERE github_release_id = ?`).bind(
        ...values,
        row.github_release_id,
      ),
    );

  // 宣言ファイル
  if (row.config_state === 'pending') {
    budget.takeD1Query();
    const assets = await env.DB.prepare('SELECT os FROM assets WHERE release_id = ?')
      .bind(row.github_release_id)
      .all<{ os: string | null }>();
    const text = await github.getTextFile(row.owner, row.repo, '.soko-kun', 'config.json', row.tag, MAX_CONFIG_BYTES);
    const config = parseConfig(
      text,
      assets.results.map((asset) => asset.os),
    );
    update('config_state = ?', config.state);
    if (config.state === 'ok') {
      statements.push(
        env.DB.prepare('UPDATE plugins SET display_name = ?, declared_os = ? WHERE id = ?').bind(
          config.name,
          config.os ? JSON.stringify(config.os) : null,
          row.plugin_id,
        ),
      );
    }
  }

  // 差分の起点は、その時点の掲載対象のリリース。掲載中の版が無ければ、差分の検査を当てない。
  let diff: string | null = null;
  if (row.diff_state === 'pending' || row.review_state !== 'done') {
    budget.takeD1Query();
    const view = await getPluginViewByInternalId(env, row.plugin_id);
    const base = view?.listedRelease ?? null;
    if (base && base.tag !== row.tag) {
      try {
        const compared = await github.getCompareDiff(row.owner, row.repo, base.tag, row.tag, MAX_DIFF_CHARS);
        diff = compared.text;
        if (row.diff_state === 'pending') {
          const hits = checkDiff(compared.text, compared.truncated, row.owner, row.repo);
          update('diff_state = ?, diff_hits = ?', hits.length > 0 ? 'held' : 'passed', JSON.stringify(hits));
        }
      } catch (error) {
        if (error instanceof GitHubError && (error.kind === 'rate_limited' || error.kind === 'unavailable'))
          throw error;
        if (row.diff_state === 'pending') update('diff_state = ?', 'error');
      }
    } else if (row.diff_state === 'pending') {
      update('diff_state = ?', 'skipped');
    }
  }

  // LLM のレビュー
  // 通信の検出の結果を待つ間は、宣言ファイルと差分の検査だけを進める。
  if (row.review_state !== 'done' && row.network_ready === 1) {
    const input = await collectReviewFiles(github, row.owner, row.repo, row.tag);
    input.network = row.network_state === 'done' ? readNetworkScan(row.network_hits) : null;
    const outcome = await reviewRepository(env, budget, `${row.owner}/${row.repo}`, input, diff);
    if (outcome.kind === 'done') {
      const findings = outcome.findings;
      const serious = findings.filter((finding) => finding.serious).length;
      update(
        "review_state = 'done', review_attempts = review_attempts + 1, review_json = ?, review_serious = ?, reviewed_at = ?",
        JSON.stringify({ findings, unreadFiles: input.unreadFiles }),
        serious,
        new Date().toISOString(),
      );
    } else if (outcome.kind === 'quota') {
      update('review_wait_until = ?', quotaRetryAt());
    } else if (outcome.kind === 'failed') {
      update("review_state = 'failed', review_attempts = review_attempts + 1");
    }
  }

  if (statements.length > 0) {
    budget.takeD1Query();
    await env.DB.batch(statements);
  }
}

export type CollectedFiles = RepositorySnapshot;

// ファイルの一覧から、規則と LLM が読むファイルを決めて取得する。一覧に無いファイルは取得しない。
export async function collectReviewFiles(
  github: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
): Promise<CollectedFiles> {
  const tree = await github.getTree(owner, repo, ref);
  // 一覧を得られないときは、ファイルの有無を判定できないものとして扱う。
  const paths = tree?.paths ?? [];
  const truncated = tree === null || tree.truncated;
  const files: CollectedFiles['files'] = [];
  const unreadFiles: string[] = [];
  let total = 0;
  const fetch = async (path: string) => {
    const slash = path.lastIndexOf('/');
    let text: string | 'too_large' | null;
    try {
      text = await github.getTextFile(
        owner,
        repo,
        slash < 0 ? '' : path.slice(0, slash),
        path.slice(slash + 1),
        ref,
        MAX_FILE_BYTES,
      );
    } catch (error) {
      // 取得の関数が受け付けない文字を含むパスは、読まずに未読として記録する。
      if (error instanceof GitHubError) throw error;
      unreadFiles.push(path);
      return;
    }
    if (text === null) return;
    if (text === 'too_large' || total + text.length > MAX_TOTAL_CHARS) {
      unreadFiles.push(path);
      return;
    }
    total += text.length;
    files.push({ path, content: text });
  };
  const plan = reviewFilePlan(paths);
  for (const path of plan.fetch) await fetch(path);
  unreadFiles.push(...plan.skipped);
  return { paths, truncated, files, unreadFiles };
}

// 取得するファイルの順番と、上限で読まないファイル。上限は REVIEW_FILES_COST の内訳に合わせる。
export function reviewFilePlan(paths: string[]): { fetch: string[]; skipped: string[] } {
  const sorted = [...paths].sort();
  const workflows = sorted.filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path));
  // テンプレートの config.yml はテンプレートの選び方の設定で、中身ではないため読まない。
  const templates = sorted.filter(
    (path) => /^\.github\/ISSUE_TEMPLATE\/[^/]+\.(md|ya?ml)$/i.test(path) && !/\/config\.ya?ml$/i.test(path),
  );
  // ビルドの設定は、パスに compiler を含む cmake のファイルを windows から順に読む。
  const compiler = sorted
    .filter((path) => /^cmake\/.*compiler[^/]*\.cmake$/i.test(path))
    .sort((a, b) => Number(!a.includes('windows')) - Number(!b.includes('windows')));
  const first = (candidates: string[]) => candidates.filter((path) => paths.includes(path)).slice(0, 1);
  const fetch = [
    ...workflows.slice(0, MAX_WORKFLOWS),
    ...first(['README.md']),
    ...first(['CMakeLists.txt']),
    ...compiler.slice(0, MAX_COMPILER_FILES),
    ...first(['vcpkg.json']),
    ...first(['CONTRIBUTING.md', '.github/CONTRIBUTING.md']),
    ...first(['.github/PULL_REQUEST_TEMPLATE.md', '.github/pull_request_template.md']),
    ...templates.slice(0, MAX_ISSUE_TEMPLATES),
  ];
  const skipped = [
    ...workflows.slice(MAX_WORKFLOWS),
    ...compiler.slice(MAX_COMPILER_FILES),
    ...templates.slice(MAX_ISSUE_TEMPLATES),
  ];
  return { fetch, skipped };
}

// 規則の判定、事実の計算、LLM の呼び出し、結果のまとめを行う。新しい版の検査、確認のモード、手元の確認が同じ関数を呼ぶ。
export async function reviewRepository(
  env: Env,
  budget: Budget,
  repository: string,
  collected: CollectedFiles,
  diff: string | null,
): Promise<ReviewOutcome> {
  // テストの環境には Workers AI が無い。レビューできない版は失敗として記録し、管理者の判断に回る。
  if (!env.AI) return { kind: 'failed' };
  const ruled = judgeByRules(collected);
  budget.takeSubrequest();
  try {
    const review = await runReview(env.AI, {
      repository,
      files: llmFiles(collected.files),
      unreadFiles: collected.unreadFiles,
      facts: computeFacts(collected, ruled),
      criteria: llmCriteriaFor(collected),
      sourceFiles: networkFiles(collected),
      diff,
    });
    return review ? { kind: 'done', findings: mergeFindings(ruled, review.findings) } : { kind: 'failed' };
  } catch (error) {
    const outcome = classifyAiError(error);
    // 例外の形は本番で確かめる (3036 を binding で受けた実例はまだ無い)。
    console.log(JSON.stringify({ event: 'review_error', outcome: outcome.kind, message: String(error).slice(0, 200) }));
    return outcome;
  }
}

export type ReviewOutcome =
  | { kind: 'done'; findings: Finding[] }
  | { kind: 'failed' }
  // 無料枠の不足 (4006 か 3036)。試行に数えず、quotaRetryAt の時刻まで待つ。
  | { kind: 'quota' }
  // 一時的な混雑 (3040)。試行に数えず、次の起動でやり直す。
  | { kind: 'busy' };

// Workers AI の例外のメッセージ (AiError: <コード>: <説明>) からコードを取り出して分ける。
// 無料枠の不足は、2026-11-13 に binding で実際に受けた例外が 4006 だった。公式の文書の表は 3036 と書くため、両方を見る。
// コードを取り出せない例外は、今までどおり失敗として数える。外れても前の版の掲載が続き、管理者の確認に回るだけで済むため。
const QUOTA_CODES = new Set(['4006', '3036']);

export function classifyAiError(error: unknown): ReviewOutcome {
  const code = /\b(\d{4}):/.exec(String(error))?.[1];
  if (code && QUOTA_CODES.has(code)) return { kind: 'quota' };
  if (code === '3040') return { kind: 'busy' };
  return { kind: 'failed' };
}

// 無料枠の不足のあと、次にレビューを試す時刻。
// 公式の文書は 00:00 UTC に戻ると書くが、2026-11-14 には 00:00 UTC を過ぎても不足と返り続けた
// (docs/design/scanning.md の順序 7)。戻る時刻を決め打ちせず、1 時間ごとにやり直す。失敗した呼び出しは Neurons を使わない。
const QUOTA_RETRY_MS = 60 * 60 * 1000;

export function quotaRetryAt(now = new Date()): string {
  return new Date(now.getTime() + QUOTA_RETRY_MS).toISOString();
}
