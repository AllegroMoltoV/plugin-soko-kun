import type { Env } from './env';

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response('Plugin Soko-kun', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
  async scheduled(_controller: ScheduledController, _env: Env, _ctx: ExecutionContext): Promise<void> {},
} satisfies ExportedHandler<Env>;
