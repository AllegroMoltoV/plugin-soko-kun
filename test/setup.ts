import { applyD1Migrations, env, reset } from 'cloudflare:test';
import { setupNetwork } from '@msw/cloudflare';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

export const network = setupNetwork();

beforeAll(() => {
  // 未定義の外部呼び出しはテストの失敗にする。モックの漏れで実ネットワークへ出ないようにするため。
  network.configure({ onUnhandledFrame: 'error' });
  network.enable();
});

beforeEach(async () => {
  // D1 と KV はテスト間で共有されるため、各テストの前に消してからマイグレーションを当て直す。
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

afterEach(() => {
  network.resetHandlers();
});

afterAll(() => {
  network.disable();
});
