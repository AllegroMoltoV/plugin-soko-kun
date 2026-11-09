// submit_plugin の処理。検証を通ったリポジトリを検査待ちで登録し、検査は Cron で進める。
import { Budget } from '../budget';
import type { Env } from '../env';
import { GitHubClient, GitHubError, type GitHubRelease } from '../github';
import { resetScanStatements } from './cron';
import {
  type Category,
  cmakeReferencesLibobs,
  hasNativeSource,
  inferCategory,
  inferOs,
  summarizeReadme,
} from './metadata';

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

async function validateAndStore(
  env: Env,
  submitter: Submitter,
  repositoryUrl: string,
  category?: Category,
): Promise<SubmitResult> {
  const parsed = parseRepositoryUrl(repositoryUrl);
  if (!parsed) {
    return fail(
      'invalid_url',
      'The repository URL is not a GitHub repository URL.',
      'Use the form https://github.com/<owner>/<repository>.',
    );
  }

  const budget = new Budget();
  const asUser = new GitHubClient(budget, { kind: 'user', token: submitter.githubToken });
  const asApp = new GitHubClient(budget, {
    kind: 'app',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });

  try {
    // 管理権限は利用者のトークンで確かめる。permissions は認証した利用者から見た権限を表す。
    const repo = await asUser.getRepo(parsed.owner, parsed.repo);
    if (repo.permissions?.admin !== true) {
      return fail(
        'not_admin',
        'You do not have admin permission on this repository.',
        'Ask an administrator of the repository to submit it.',
      );
    }
    if (repo.private) {
      return fail('private_repository', 'The repository is private.', 'Make the repository public, then submit again.');
    }
    if (repo.archived) {
      return fail('archived_repository', 'The repository is archived.', 'Unarchive the repository, then submit again.');
    }
    const license = repo.license?.spdx_id;
    if (!license || license === 'NOASSERTION') {
      return fail(
        'no_license',
        'GitHub does not detect a license for the repository.',
        'Add a LICENSE file that GitHub can detect.',
      );
    }

    const duplicate = await env.DB.prepare('SELECT id FROM plugins WHERE github_repo_id = ?')
      .bind(repo.id)
      .first<{ id: string }>();
    if (duplicate) {
      return fail('duplicate', 'The repository is already registered.', `See the existing entry: ${duplicate.id}`);
    }

    const owner = repo.owner.login;
    const name = repo.name;
    const [languages, cmake] = [
      await asApp.getLanguages(owner, name),
      await asApp.getRootFile(owner, name, 'CMakeLists.txt'),
    ];
    if (!hasNativeSource(languages) || !cmake || !cmakeReferencesLibobs(cmake)) {
      return fail(
        'not_obs_plugin',
        'The repository does not look like an OBS Studio plugin.',
        'The root CMakeLists.txt must reference libobs (for example find_package(libobs)), and the repository must contain C or C++ sources.',
      );
    }

    const latest = await asApp.getLatestRelease(owner, name);
    const release: GitHubRelease | null | undefined = latest?.release;
    if (!release || release.draft || !release.published_at) {
      return fail(
        'no_release',
        'The repository has no published release.',
        'Publish a release on GitHub with the plugin files attached.',
      );
    }
    const assets = release.assets.filter((asset) => asset.digest?.startsWith('sha256:'));
    if (assets.length === 0) {
      return fail(
        'no_verifiable_asset',
        'The latest release has no files with a SHA-256 digest from GitHub.',
        'Attach the plugin files to the release. GitHub records a digest for uploaded files.',
      );
    }
    if (!TAG.test(release.tag_name)) {
      return fail(
        'unsupported_tag',
        'The release tag contains unsupported characters.',
        'Use a tag made of letters, digits, dot, hyphen, and underscore.',
      );
    }
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
        latest?.etag ?? null,
        timestamp,
        timestamp,
        timestamp,
      ),
      env.DB.prepare(
        'INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(release.id, pluginId, release.tag_name, release.name, commitSha, release.published_at, release.html_url),
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
}
