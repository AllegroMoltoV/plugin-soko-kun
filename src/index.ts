import { handleAttestations } from './attestation/route';
import { authorizationServer, handleAuthorize, handleCallback, protectedResource } from './auth';
import { runCron } from './domain/cron';
import type { Env } from './env';
import { handleMcp } from './mcp/route';
import { isRateLimited, tooManyRequests } from './ratelimit';
import { handleWeb } from './web/app';

const OAUTH_PATHS = ['/authorize', '/callback', '/oauth/token', '/oauth/register'];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (OAUTH_PATHS.includes(path)) {
      // OAuth の経路は KV へ書き込むため、無料プランの 1 日 1,000 件の書き込みを使い切られないよう厳しく制限する。
      if (await isRateLimited(env, request, 'oauth')) return tooManyRequests();
      if (path === '/authorize') return handleAuthorize(request, env);
      if (path === '/callback') return handleCallback(request, env);
      return authorizationServer(env).fetch(request, env, ctx);
    }
    if (path.startsWith('/.well-known/oauth-authorization-server')) {
      return authorizationServer(env).fetch(request, env, ctx);
    }
    if (path.startsWith('/.well-known/oauth-protected-resource')) {
      return protectedResource(env, async () => new Response(null, { status: 404 })).fetch(request, env, ctx);
    }

    if (await isRateLimited(env, request, 'public')) return tooManyRequests();
    if (path === '/mcp' || path.startsWith('/mcp/')) return handleMcp(request, env, ctx);
    if (path.startsWith('/internal/attestations/')) return handleAttestations(request, env);
    return handleWeb(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const report = await runCron(env);
    console.log(JSON.stringify({ event: 'cron', ...report }));
    const cutoff = Math.floor(Date.now() / 60_000) - 60;
    ctx.waitUntil(
      Promise.all([
        env.DB.prepare('DELETE FROM rate_limit WHERE window_start < ?').bind(cutoff).run(),
        authorizationServer(env).purgeExpiredData(env),
      ]),
    );
  },
} satisfies ExportedHandler<Env>;
