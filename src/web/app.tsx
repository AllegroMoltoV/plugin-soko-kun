import { Hono } from 'hono';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('Plugin Soko-kun'));

export function handleWeb(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
  return app.fetch(request, env, ctx);
}
