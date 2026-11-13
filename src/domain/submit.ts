// submit_plugin の処理。検証を通ったリポジトリを検査待ちで登録し、検査は Cron で進める。
import { Budget } from '../budget';
import type { Env } from '../env';
import { type GitHubAsset, GitHubClient, GitHubError, type GitHubRelease, type GitHubRepo } from '../github';
import { CRITERIA_BY_ID, referenceOf } from '../review/criteria';
import type { Finding } from '../review/llm';
import { type ReviewSummary, reviewView } from './author';
import { resetAttestationStatement, resetScanStatements } from './cron';
import {
  type Category,
  cmakeReferencesLibobs,
  hasNativeSource,
  inferCategory,
  inferOs,
  summarizeReadme,
} from './metadata';
import { collectReviewFiles, reviewRepository } from './release-checks';

export const SUBMITS_PER_DAY = 10;

export type SubmitErrorCode =
  | 'invalid_url'
  | 'rate_limited'
  | 'not_found'
  | 'not_admin'
  | 'private_repository'
  | 'archived_repository'
  | 'no_license'
  | 'not_obs_plugin'
  | 'no_release'
  | 'no_verifiable_asset'
  | 'unsupported_tag'
  | 'not_immutable'
  | 'installer_not_allowed'
  | 'no_attestation'
  | 'duplicate'
  | 'github_unavailable';

export type SubmitResult =
  | { ok: true; pluginId: string; status: 'pending'; detailUrl: string; assetsToScan: number }
  | { ok: false; code: SubmitErrorCode; message: string; fix: string };

export interface Submitter {
  githubUserId: number;
  githubToken: string;
}

const REPO_URL = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})\/?$/;
const TAG = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepositoryUrl(input: string): { owner: string; repo: string } | null {
  const match = REPO_URL.exec(input.trim());
  if (!match) return null;
  const owner = match[1] as string;
  const repo = (match[2] as string).replace(/\.git$/, '');
  if (repo === '.' || repo === '..' || repo.length === 0) return null;
  return { owner, repo };
}

const fail = (code: SubmitErrorCode, message: string, fix: string): SubmitResult => ({ ok: false, code, message, fix });

function now(): string {
  return new Date().toISOString();
}

async function logAttempt(env: Env, userId: number, outcome: string): Promise<void> {
  await env.DB.prepare('INSERT INTO submit_log (github_user_id, created_at, outcome) VALUES (?, ?, ?)')
    .bind(userId, now(), outcome)
    .run();
}

// category は作者が選んだカテゴリ。選ばなかった場合は、リポジトリ名と概要から推定する。
export async function submitPlugin(
  env: Env,
  submitter: Submitter,
  repositoryUrl: string,
  category?: Category,
): Promise<SubmitResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await env.DB.prepare('SELECT count(*) AS n FROM submit_log WHERE github_user_id = ? AND created_at > ?')
    .bind(submitter.githubUserId, since)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= SUBMITS_PER_DAY) {
    return fail(
      'rate_limited',
      `You can submit up to ${SUBMITS_PER_DAY} repositories per 24 hours.`,
      'Wait and try again later.',
    );
  }

  const result = await validateAndStore(env, submitter, repositoryUrl, category);
  await logAttempt(env, submitter.githubUserId, result.ok ? 'accepted' : result.code);
  return result;
}

export type ConditionCode =
  | 'not_admin'
  | 'private_repository'
  | 'archived_repository'
  | 'no_license'
  | 'not_obs_plugin'
  | 'no_release'
  | 'no_verifiable_asset'
  | 'unsupported_tag'
  | 'not_immutable'
  | 'installer_not_allowed'
  | 'no_attestation';

export interface Condition {
  code: ConditionCode;
  result: 'passed' | 'failed' | 'unchecked';
  message?: string;
  fix?: string;
}

interface Evaluated {
  conditions: Condition[];
  repo: GitHubRepo;
  release: GitHubRelease | null;
  assets: GitHubAsset[];
  etag: string | null;
}

// 1 回の登録で証明の有無を確かめる配布物の上限。外部呼び出しの予算に収めるため。
export const MAX_SUBMIT_ASSETS = 30;
const INSTALLER = /\.(exe|msi)$/i;

const MESSAGES: Record<ConditionCode, { message: string; fix: string }> = {
  not_admin: {
    message: 'You do not have admin permission on this repository.',
    fix: 'Ask an administrator of the repository to submit it.',
  },
  private_repository: { message: 'The repository is private.', fix: 'Make the repository public, then submit again.' },
  archived_repository: { message: 'The repository is archived.', fix: 'Unarchive the repository, then submit again.' },
  no_license: {
    message: 'GitHub does not detect a license for the repository.',
    fix: 'Add a LICENSE file that GitHub can detect.',
  },
  not_obs_plugin: {
    message: 'The repository does not look like an OBS Studio plugin.',
    fix: 'The root CMakeLists.txt must reference libobs (for example find_package(libobs)), and the repository must contain C or C++ sources.',
  },
  no_release: {
    message: 'The repository has no published release.',
    fix: 'Publish a release on GitHub with the plugin files attached.',
  },
  no_verifiable_asset: {
    message: `The latest release has no files with a SHA-256 digest from GitHub, or more than ${MAX_SUBMIT_ASSETS} files.`,
    fix: `Attach the plugin files (up to ${MAX_SUBMIT_ASSETS}) to the release. GitHub records a digest for uploaded files.`,
  },
  unsupported_tag: {
    message: 'The release tag contains unsupported characters.',
    fix: 'Use a tag made of letters, digits, dot, hyphen, and underscore.',
  },
  not_immutable: {
    message: 'The latest release is not immutable.',
    fix: `${criterionFix('immutable-release')} See ${referenceOf('immutable-release')}`,
  },
  installer_not_allowed: {
    message: 'The latest release includes an exe or msi installer.',
    fix: `${criterionFix('distribution-format')} See ${referenceOf('distribution-format')}`,
  },
  no_attestation: {
    message: 'Some release files have no build provenance attestation.',
    fix: `${criterionFix('attestation')} See ${referenceOf('attestation')}`,
  },
};

function criterionFix(id: string): string {
  return CRITERIA_BY_ID.get(id)?.fix ?? '';
}

function condition(code: ConditionCode, passed: boolean): Condition {
  return passed ? { code, result: 'passed' } : { code, result: 'failed', ...MESSAGES[code] };
}

// 掲載の条件を順に判定する。リポジトリを取得できない、または管理者でないときは、そこで止める。
// stopOnFailure のときは、最初に満たさなかった条件で止める (登録)。そうでなければ、判定できる条件をすべて判定する (確認のモード)。
async function evaluateConditions(
  asUser: GitHubClient,
  asApp: GitHubClient,
  parsed: { owner: string; repo: string },
  stopOnFailure: boolean,
): Promise<Evaluated> {
  const conditions: Condition[] = [];
  const done = () => stopOnFailure && conditions.some((item) => item.result === 'failed');
  // 管理権限は利用者のトークンで確かめる。permissions は認証した利用者から見た権限を表す。
  const repo = await asUser.getRepo(parsed.owner, parsed.repo);
  const evaluated: Evaluated = { conditions, repo, release: null, assets: [], etag: null };
  conditions.push(condition('not_admin', repo.permissions?.admin === true));
  if (done() || repo.permissions?.admin !== true) return evaluated;
  conditions.push(condition('private_repository', !repo.private));
  if (done()) return evaluated;
  conditions.push(condition('archived_repository', !repo.archived));
  if (done()) return evaluated;
  const license = repo.license?.spdx_id;
  conditions.push(condition('no_license', Boolean(license) && license !== 'NOASSERTION'));
  if (done()) return evaluated;

  const owner = repo.owner.login;
  const name = repo.name;
  const languages = await asApp.getLanguages(owner, name);
  const cmake = await asApp.getRootFile(owner, name, 'CMakeLists.txt');
  conditions.push(
    condition('not_obs_plugin', hasNativeSource(languages) && cmake !== null && cmakeReferencesLibobs(cmake)),
  );
  if (done()) return evaluated;

  const latest = await asApp.getLatestRelease(owner, name);
  const release = latest?.release ?? null;
  const published = release !== null && !release.draft && Boolean(release.published_at);
  conditions.push(condition('no_release', published));
  if (!published || !release) return evaluated;
  evaluated.release = release;
  evaluated.etag = latest?.etag ?? null;
  const assets = release.assets.filter((asset) => asset.digest?.startsWith('sha256:'));
  evaluated.assets = assets;
  conditions.push(condition('no_verifiable_asset', assets.length > 0 && assets.length <= MAX_SUBMIT_ASSETS));
  if (done()) return evaluated;
  conditions.push(condition('unsupported_tag', TAG.test(release.tag_name)));
  if (done()) return evaluated;
  conditions.push(condition('not_immutable', release.immutable === true));
  if (done()) return evaluated;
  conditions.push(condition('installer_not_allowed', !release.assets.some((asset) => INSTALLER.test(asset.name))));
  if (done()) return evaluated;
  if (assets.length === 0 || assets.length > MAX_SUBMIT_ASSETS) {
    conditions.push({ code: 'no_attestation', result: 'unchecked' });
    return evaluated;
  }
  let attested = true;
  for (const asset of assets) {
    if (!(await asApp.hasAttestation(owner, name, asset.digest as string))) {
      attested = false;
      break;
    }
  }
  conditions.push(condition('no_attestation', attested));
  return evaluated;
}

function githubFailure(error: unknown): SubmitResult {
  if (error instanceof GitHubError) {
    if (error.kind === 'not_found') {
      return fail(
        'not_found',
        'The repository was not found on GitHub.',
        'Check the URL and that the repository is public.',
      );
    }
    return fail('github_unavailable', 'GitHub is not available right now.', 'Try again in a few minutes.');
  }
  throw error;
}

function clients(env: Env, submitter: Submitter, budget: Budget) {
  return {
    asUser: new GitHubClient(budget, { kind: 'user', token: submitter.githubToken }),
    asApp: new GitHubClient(budget, {
      kind: 'app',
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
  };
}

const INVALID_URL = (): SubmitResult =>
  fail(
    'invalid_url',
    'The repository URL is not a GitHub repository URL.',
    'Use the form https://github.com/<owner>/<repository>.',
  );

async function validateAndStore(
  env: Env,
  submitter: Submitter,
  repositoryUrl: string,
  category?: Category,
): Promise<SubmitResult> {
  const parsed = parseRepositoryUrl(repositoryUrl);
  if (!parsed) return INVALID_URL();
  const budget = new Budget();
  const { asUser, asApp } = clients(env, submitter, budget);
  try {
    const evaluated = await evaluateConditions(asUser, asApp, parsed, true);
    const failed = evaluated.conditions.find((item) => item.result === 'failed');
    if (failed) return fail(failed.code, failed.message ?? '', failed.fix ?? '');
    const { repo, release, assets } = evaluated;
    if (!release) return fail('no_release', MESSAGES.no_release.message, MESSAGES.no_release.fix);

    const duplicate = await env.DB.prepare('SELECT id FROM plugins WHERE github_repo_id = ?')
      .bind(repo.id)
      .first<{ id: string }>();
    if (duplicate) {
      return fail('duplicate', 'The repository is already registered.', `See the existing entry: ${duplicate.id}`);
    }

    const owner = repo.owner.login;
    const name = repo.name;
    const license = repo.license?.spdx_id as string;
    const commitSha = await asApp.getCommitSha(owner, name, release.tag_name);
    const summary = repo.description?.trim() || summarizeReadme((await asApp.getReadme(owner, name)) ?? '');

    const pluginId = `${owner}/${name}`.toLowerCase();
    const timestamp = now();
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, summary, license_spdx, category, submitter_github_id,
           releases_etag, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        pluginId,
        repo.id,
        owner,
        name,
        summary,
        license,
        category ?? inferCategory(name, summary),
        submitter.githubUserId,
        evaluated.etag,
        timestamp,
        timestamp,
        timestamp,
      ),
      env.DB.prepare(
        'INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(release.id, pluginId, release.tag_name, release.name, commitSha, release.published_at, release.html_url),
      env.DB.prepare('INSERT INTO release_checks (github_release_id, immutable) VALUES (?, ?)').bind(
        release.id,
        release.immutable === true ? 1 : 0,
      ),
    ];
    for (const asset of assets) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO assets (github_asset_id, release_id, name, size, digest, download_url, os) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          asset.id,
          release.id,
          asset.name,
          asset.size,
          asset.digest,
          asset.browser_download_url,
          inferOs(asset.name),
        ),
      );
      statements.push(...resetScanStatements(env, asset.digest as string));
      statements.push(resetAttestationStatement(env, asset.id));
    }
    // 1 回の batch は D1 のクエリ 1 件として数えられ、途中で失敗しても部分的な書き込みが残らない。
    await env.DB.batch(statements);

    return {
      ok: true,
      pluginId,
      status: 'pending',
      detailUrl: `${env.ORIGIN}/plugins/${pluginId}`,
      assetsToScan: assets.length,
    };
  } catch (error) {
    return githubFailure(error);
  }
}

export const CHECKS_PER_DAY = 5;

export type CheckResult =
  | SubmitResult
  | {
      ok: boolean;
      mode: 'check';
      conditions: Condition[];
      review: { status: 'done' | 'failed' } & ReviewSummary;
    };

// 確認のモード。登録せず、掲載の条件と、既定のブランチの最新のコミットのレビューを返す (docs/design/author-feedback.md)。
export async function checkPlugin(env: Env, submitter: Submitter, repositoryUrl: string): Promise<CheckResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await env.DB.prepare('SELECT count(*) AS n FROM check_log WHERE github_user_id = ? AND created_at > ?')
    .bind(submitter.githubUserId, since)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= CHECKS_PER_DAY) {
    return fail(
      'rate_limited',
      `You can use the check mode up to ${CHECKS_PER_DAY} times per 24 hours.`,
      'Wait and try again later.',
    );
  }
  await env.DB.prepare('INSERT INTO check_log (github_user_id, created_at) VALUES (?, ?)')
    .bind(submitter.githubUserId, now())
    .run();
  const parsed = parseRepositoryUrl(repositoryUrl);
  if (!parsed) return INVALID_URL();
  const budget = new Budget();
  const { asUser, asApp } = clients(env, submitter, budget);
  try {
    const evaluated = await evaluateConditions(asUser, asApp, parsed, false);
    const { repo } = evaluated;
    const admin = evaluated.conditions.find((item) => item.code === 'not_admin')?.result === 'passed';
    let review: { findings: Finding[]; unreadFiles: string[] } | null = null;
    if (admin && budget.canFetch(12)) {
      const collected = await collectReviewFiles(asApp, repo.owner.login, repo.name, repo.default_branch);
      const findings = await reviewRepository(env, budget, `${repo.owner.login}/${repo.name}`, collected, null);
      review = findings ? { findings, unreadFiles: collected.unreadFiles } : null;
    }
    const view = reviewView(review);
    return {
      ok: evaluated.conditions.every((item) => item.result === 'passed'),
      mode: 'check',
      conditions: evaluated.conditions,
      review: { status: review ? 'done' : 'failed', ...view },
    };
  } catch (error) {
    return githubFailure(error);
  }
}
