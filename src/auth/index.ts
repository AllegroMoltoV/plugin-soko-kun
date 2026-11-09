// 認可サーバーと MCP リソースを 1 つの Worker に同居させる。利用者の認証は GitHub の OAuth App へ委譲する。
import {
  type ConsentDescription,
  OAuthAuthorizationServer,
  OAuthError,
  OAuthResourceServer,
} from '@cloudflare/workers-oauth-provider';
import type { Env } from '../env';

export interface AuthProps {
  githubUserId: number;
  githubLogin: string;
  githubToken: string;
  githubRefreshToken: string | null;
}

export const resourceFor = (env: Env) => `${env.ORIGIN}/mcp`;

const servers = new Map<string, OAuthAuthorizationServer<Env>>();

export function authorizationServer(env: Env): OAuthAuthorizationServer<Env> {
  const existing = servers.get(env.ORIGIN);
  if (existing) return existing;
  const server = new OAuthAuthorizationServer<Env>({
    issuer: env.ORIGIN,
    resources: [resourceFor(env)],
    clientIdMetadataDocumentEnabled: true,
    clientRegistrationEndpoint: '/oauth/register',
    tokenExchangeCallback: async ({ grantType, props }) => {
      if (grantType !== 'refresh_token') return;
      const current = props as AuthProps;
      if (!current.githubRefreshToken) return;
      const refreshed = await exchangeGithubToken(env, {
        grant_type: 'refresh_token',
        refresh_token: current.githubRefreshToken,
      });
      if (refreshed.error === 'bad_refresh_token') {
        throw new OAuthError('invalid_grant', { description: 'GitHub access was revoked' });
      }
      if (!refreshed.access_token) {
        throw new OAuthError('temporarily_unavailable', { description: 'GitHub is unavailable', statusCode: 503 });
      }
      return {
        newProps: {
          ...current,
          githubToken: refreshed.access_token,
          githubRefreshToken: refreshed.refresh_token ?? current.githubRefreshToken,
        } satisfies AuthProps,
      };
    },
    onError: ({ code, description }) => {
      // 内部の詳細や資格情報はログに出さない。
      console.log(JSON.stringify({ event: 'oauth_error', code, description }));
    },
  });
  servers.set(env.ORIGIN, server);
  return server;
}

interface GithubTokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
}

async function exchangeGithubToken(env: Env, params: Record<string, string>): Promise<GithubTokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'plugin-soko-kun' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, ...params }),
  });
  if (!response.ok) return { error: `http_${response.status}` };
  return response.json();
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function consentPage(details: ConsentDescription, handle: string): string {
  const name = escapeHtml(details.clientName);
  const origin = details.clientDomain
    ? `Published by <strong>${escapeHtml(details.clientDomain)}</strong>.`
    : 'This app registered itself; its name is not verified.';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize ${name} - Plugin Soko-kun</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;line-height:1.6}button{font-size:1rem;padding:.5rem 1rem;margin-right:.5rem}</style>
<h1>Allow ${name} to submit plugins with your GitHub account?</h1>
<p>${origin} Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${details.redirectIsLoopback ? '<p><strong>This sends access to an app on your computer.</strong> Continue only if you just started signing in from it.</p>' : ''}
<p>Plugin Soko-kun reads your GitHub username and checks whether you administer the repositories you submit. It does not request write access to your repositories.</p>
<form method="post"><input type="hidden" name="handle" value="${escapeHtml(handle)}">
<p><button name="decision" value="approve">Allow</button><button name="decision" value="deny">Deny</button></p></form></html>`;
}

function base64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const oauth = authorizationServer(env).getOAuthApi(env);
  if (request.method === 'GET') {
    const authRequest = await oauth.parseAuthRequest(request);
    const details = await oauth.describeConsent(authRequest);
    const consent = await oauth.beginConsent(authRequest);
    consent.headers.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(consentPage(details, consent.handle), { headers: consent.headers });
  }
  const form = await request.formData();
  const handle = String(form.get('handle'));
  if (form.get('decision') !== 'approve') {
    const denied = await oauth.denyConsent(request, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  const approved = await oauth.approveConsent(request, handle);
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const { state, headers } = await oauth.beginUpstream(approved.request, {
    data: { verifier },
    headers: approved.headers,
  });
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${env.ORIGIN}/callback`);
  url.searchParams.set('state', state);
  // スコープを求めない。公開リポジトリの管理権限は、スコープの無いトークンでも permissions で確認できる。
  url.searchParams.set('scope', '');
  url.searchParams.set(
    'code_challenge',
    base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('allow_signup', 'false');
  headers.set('Location', url.toString());
  return new Response(null, { status: 302, headers });
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const oauth = authorizationServer(env).getOAuthApi(env);
  const { request: original, data, headers } = await oauth.finishUpstream<{ verifier: string }>(request);
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return new Response('GitHub sign-in was not completed.', { status: 400 });
  const token = await exchangeGithubToken(env, {
    code,
    redirect_uri: `${env.ORIGIN}/callback`,
    code_verifier: data.verifier,
  });
  if (!token.access_token) return new Response('GitHub sign-in failed.', { status: 502 });
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': 'plugin-soko-kun',
    },
  });
  if (!userResponse.ok) return new Response('GitHub sign-in failed.', { status: 502 });
  const user = (await userResponse.json()) as { id: number; login: string };
  const { redirectTo } = await oauth.completeAuthorization({
    request: original,
    userId: String(user.id),
    metadata: {},
    scope: original.scope,
    props: {
      githubUserId: user.id,
      githubLogin: user.login,
      githubToken: token.access_token,
      githubRefreshToken: token.refresh_token ?? null,
    } satisfies AuthProps,
  });
  headers.set('Location', redirectTo);
  return new Response(null, { status: 302, headers });
}

export function protectedResource(
  env: Env,
  handler: (request: Request, props: AuthProps) => Promise<Response>,
): OAuthResourceServer<Env, AuthProps> {
  return new OAuthResourceServer<Env, AuthProps>({
    resourceMetadata: {
      resource: resourceFor(env),
      authorization_servers: [env.ORIGIN],
      bearer_methods_supported: ['header'],
      resource_name: 'Plugin Soko-kun',
    },
    validateToken: (e) => (resource, token) => authorizationServer(e).validateToken<AuthProps>(resource, token, e),
    handler: {
      fetch: (request, _env, ctx) => handler(request, ctx.props as AuthProps),
    },
  });
}
