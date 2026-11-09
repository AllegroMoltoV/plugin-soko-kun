// GitHub REST API の呼び出し。利用者のトークンは管理権限の確認だけに使い、
// それ以外は OAuth App の認証情報で呼ぶ。認証ヘッダーはログにもレスポンスにも出さない。
import { type Budget, budgetedFetch } from './budget';

const API = 'https://api.github.com';

export type GitHubAuth = { kind: 'user'; token: string } | { kind: 'app'; clientId: string; clientSecret: string };

export class GitHubError extends Error {
  constructor(
    readonly kind: 'not_found' | 'rate_limited' | 'forbidden' | 'unavailable',
    readonly status: number,
  ) {
    super(`GitHub API ${kind} (${status})`);
    this.name = 'GitHubError';
  }
}

export interface GitHubRepo {
  id: number;
  name: string;
  owner: { login: string };
  private: boolean;
  archived: boolean;
  description: string | null;
  default_branch: string;
  license: { spdx_id: string | null } | null;
  permissions?: { admin?: boolean };
}

export interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  digest: string | null;
  browser_download_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  assets: GitHubAsset[];
}

function authHeader(auth: GitHubAuth): string {
  if (auth.kind === 'user') return `Bearer ${auth.token}`;
  return `Basic ${btoa(`${auth.clientId}:${auth.clientSecret}`)}`;
}

function classify(response: Response): GitHubError {
  const status = response.status;
  if (status === 404) return new GitHubError('not_found', status);
  if (status === 429 || (status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    return new GitHubError('rate_limited', status);
  }
  if (status === 403 || status === 401) return new GitHubError('forbidden', status);
  return new GitHubError('unavailable', status);
}

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

function path(...segments: string[]): string {
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment === '.' || segment === '..') throw new Error('invalid path segment');
  }
  return segments.map(encodeURIComponent).join('/');
}

export class GitHubClient {
  constructor(
    private readonly budget: Budget,
    private readonly auth: GitHubAuth,
  ) {}

  private async request(url: string, accept = 'application/vnd.github+json', etag?: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: accept,
      Authorization: authHeader(this.auth),
      'User-Agent': 'plugin-soko-kun',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (etag) headers['If-None-Match'] = etag;
    const response = await budgetedFetch(this.budget, url, { headers });
    if (response.status === 304) return response;
    if (!response.ok) {
      await response.body?.cancel();
      throw classify(response);
    }
    return response;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return (await this.request(`${API}/repos/${path(owner, repo)}`)).json();
  }

  async getRepoById(id: number): Promise<GitHubRepo> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('invalid repository id');
    return (await this.request(`${API}/repositories/${id}`)).json();
  }

  async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    return (await this.request(`${API}/repos/${path(owner, repo)}/languages`)).json();
  }

  async getRootFile(owner: string, repo: string, file: string): Promise<string | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/contents/${path(file)}`,
        'application/vnd.github.raw+json',
      );
      return await response.text();
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  async getReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/readme`,
        'application/vnd.github.raw+json',
      );
      return await response.text();
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  // ETag が一致すれば null を返す。条件付き要求の 304 は GitHub のレート制限を消費しない。
  async getLatestRelease(
    owner: string,
    repo: string,
    etag?: string,
  ): Promise<{ release: GitHubRelease | null; etag: string | null } | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/releases/latest`,
        'application/vnd.github+json',
        etag,
      );
      if (response.status === 304) return null;
      return { release: await response.json(), etag: response.headers.get('ETag') };
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return { release: null, etag: null };
      throw error;
    }
  }

  async getCommitSha(owner: string, repo: string, ref: string): Promise<string> {
    const response = await this.request(`${API}/repos/${path(owner, repo)}/commits/${path(ref)}`);
    const body = (await response.json()) as { sha: string };
    return body.sha;
  }
}
