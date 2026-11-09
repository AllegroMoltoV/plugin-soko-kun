// 手順 1 の前提確認: 外部 fetch のモックと D1 のマイグレーションが、この環境の Workers ランタイム上で動く。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { expect, it } from 'vitest';
import { network } from './setup';

it('外部 fetch をモックできる', async () => {
  network.use(http.get('https://api.github.com/zen', () => HttpResponse.text('mocked')));
  const response = await fetch('https://api.github.com/zen');
  expect(await response.text()).toBe('mocked');
});

it('未定義の外部 fetch は失敗する', async () => {
  await expect(fetch('https://example.com/unhandled')).rejects.toThrow();
});

it('D1 のマイグレーションが適用される', async () => {
  const row = await env.DB.prepare(
    "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'plugins'",
  ).first<{ n: number }>();
  expect(row?.n).toBe(1);
});
