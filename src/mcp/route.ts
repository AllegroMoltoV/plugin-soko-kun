// /mcp への要求を、認証なしの処理と認証必須の処理へ振り分ける。
import { createMcpHandler } from '@modelcontextprotocol/server';
import { type AuthProps, protectedResource } from '../auth';
import type { Env } from '../env';
import { buildMcpServer } from './server';

const AUTH_REQUIRED_TOOLS = new Set(['submit_plugin', 'list_my_plugins']);

type Classification = 'public' | 'auth' | 'mismatch';

async function calledToolNames(request: Request): Promise<string[]> {
  if (request.method !== 'POST') return [];
  try {
    const body = (await request.clone().json()) as unknown;
    const messages = Array.isArray(body) ? body : [body];
    return messages
      .filter(
        (m): m is { method: string; params?: { name?: unknown } } =>
          typeof m === 'object' && m !== null && (m as { method?: unknown }).method === 'tools/call',
      )
      .map((m) => String(m.params?.name ?? ''));
  } catch {
    return [];
  }
}

export async function classify(request: Request): Promise<Classification> {
  const headerName = request.headers.get('Mcp-Name');
  const names = await calledToolNames(request);
  // ヘッダーと本文の呼び出し名が食い違う要求は拒否する。ヘッダーだけを見て認証を外させないため。
  if (headerName && names.length > 0 && names.some((name) => name !== headerName)) return 'mismatch';
  if (request.headers.has('Authorization')) return 'auth';
  if ((headerName && AUTH_REQUIRED_TOOLS.has(headerName)) || names.some((name) => AUTH_REQUIRED_TOOLS.has(name))) {
    return 'auth';
  }
  return 'public';
}

export async function handleMcp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const kind = await classify(request);
  if (kind === 'mismatch') {
    return Response.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Mcp-Name header does not match the request body.' },
      },
      { status: 400 },
    );
  }
  if (kind === 'public') {
    return createMcpHandler(() => buildMcpServer(env)).fetch(request);
  }
  return protectedResource(env, async (authedRequest: Request, props: AuthProps) =>
    createMcpHandler(() =>
      buildMcpServer(env, {
        githubUserId: props.githubUserId,
        githubLogin: props.githubLogin,
        githubToken: props.githubToken,
      }),
    ).fetch(authedRequest),
  ).fetch(request, env, ctx);
}
