// 新しい版の検査 (docs/design/scanning.md の「新しい版の検査」)。Cron の定期処理から 1 回の起動で 1 件ずつ行う。
// 宣言ファイルの判定、乗っ取りの兆候のルールの検査、LLM による開発の実践のレビューを行い、release_checks に書く。
import type { Budget } from '../budget';
import type { Env } from '../env';
import { GitHubClient, GitHubError } from '../github';
import { checkDiff } from '../review/diff-rules';
import { type Finding, runReview } from '../review/llm';
import { getPluginViewByInternalId } from './catalog';
import { OS_VALUES } from './metadata';
import { MAX_REVIEW_ATTEMPTS } from './status';

// 1 件の検査の外部呼び出しの上限。宣言ファイル 1、差分 1、ワークフローの一覧 1、ワークフロー 6、直下のファイル 4、LLM 1 の合計。
export const RELEASE_CHECK_COST = 14;
const MAX_DIFF_CHARS = 24_000;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_CHARS = 60_000;
const MAX_WORKFLOWS = 6;
const MAX_CONFIG_BYTES = 16 * 1024;
const ROOT_FILES = ['CMakeLists.txt', 'buildspec.json', 'vcpkg.json', 'README.md'];

interface PendingRow {
  github_release_id: number;
  plugin_id: string;
  owner: string;
  repo: string;
  license_spdx: string | null;
  tag: string;
  diff_state: string;
  config_state: string;
  review_state: string;
  review_attempts: number;
}

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
  budget.takeD1Query();
  const row = await env.DB.prepare(
    `SELECT c.github_release_id, r.plugin_id, p.owner, p.repo, p.license_spdx, r.tag, c.diff_state, c.config_state, c.review_state,
       c.review_attempts
     FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id JOIN plugins p ON p.id = r.plugin_id
     WHERE c.legacy = 0 AND p.removed = 0 AND c.review_attempts < ? AND (c.diff_state = 'pending'
       OR c.config_state = 'pending'
       OR (c.review_state IN ('pending', 'failed') AND (c.review_wait_until IS NULL OR c.review_wait_until <= ?)))
     ORDER BY r.published_at LIMIT 1`,
  )
    .bind(MAX_REVIEW_ATTEMPTS, new Date().toISOString())
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
  if (row.review_state !== 'done') {
    const input = await collectReviewFiles(github, row.owner, row.repo, row.tag);
    const outcome = await reviewRepository(env, budget, `${row.owner}/${row.repo}`, row.license_spdx, input, diff);
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
      update('review_wait_until = ?', nextQuotaReset());
    } else if (outcome.kind === 'failed') {
      update("review_state = 'failed', review_attempts = review_attempts + 1");
    }
  }

  if (statements.length > 0) {
    budget.takeD1Query();
    await env.DB.batch(statements);
  }
}

export interface CollectedFiles {
  files: Array<{ path: string; content: string }>;
  unreadFiles: string[];
}

export async function collectReviewFiles(
  github: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
): Promise<CollectedFiles> {
  const files: CollectedFiles['files'] = [];
  const unreadFiles: string[] = [];
  let total = 0;
  const add = (path: string, text: string | 'too_large' | null) => {
    if (text === null) return;
    if (text === 'too_large' || total + text.length > MAX_TOTAL_CHARS) {
      unreadFiles.push(path);
      return;
    }
    total += text.length;
    files.push({ path, content: text });
  };
  const workflows = (await github.listDirectory(owner, repo, '.github/workflows', ref)) ?? [];
  const yaml = workflows.filter((entry) => entry.type === 'file' && /\.ya?ml$/i.test(entry.name));
  for (const entry of yaml.slice(0, MAX_WORKFLOWS)) {
    add(
      `.github/workflows/${entry.name}`,
      await github.getTextFile(owner, repo, '.github/workflows', entry.name, ref, MAX_FILE_BYTES),
    );
  }
  for (const entry of yaml.slice(MAX_WORKFLOWS)) unreadFiles.push(`.github/workflows/${entry.name}`);
  for (const file of ROOT_FILES) add(file, await github.getTextFile(owner, repo, '', file, ref, MAX_FILE_BYTES));
  return { files, unreadFiles };
}

export async function reviewRepository(
  env: Env,
  budget: Budget,
  repository: string,
  license: string | null,
  collected: CollectedFiles,
  diff: string | null,
): Promise<ReviewOutcome> {
  // テストの環境には Workers AI が無い。レビューできない版は失敗として記録し、管理者の判断に回る。
  if (!env.AI) return { kind: 'failed' };
  budget.takeSubrequest();
  try {
    const review = await runReview(env.AI, { repository, license, ...collected, diff });
    return review ? { kind: 'done', findings: review.findings } : { kind: 'failed' };
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
  // 無料枠の不足 (4006 か 3036)。試行に数えず、枠が戻る 00:00 UTC まで待つ。
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

// 次の 00:00 UTC。Workers AI の無料枠が戻る時刻。
export function nextQuotaReset(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}
