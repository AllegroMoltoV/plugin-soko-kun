import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc', environment: 'test' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations('./migrations'),
          GITHUB_CLIENT_ID: 'test-client-id',
          GITHUB_CLIENT_SECRET: 'test-client-secret',
          MALWAREBAZAAR_AUTH_KEY: 'test-malwarebazaar-key',
          CONTACT_EMAIL: 'allegromoltov@soko-kun.example',
          // .dev.vars の本物の URL がテストに入らないよう、空にしておく。通知のテストは env を上書きする。
          DISCORD_WEBHOOK_URL: '',
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
