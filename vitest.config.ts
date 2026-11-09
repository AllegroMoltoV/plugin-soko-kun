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
          VIRUSTOTAL_API_KEY: 'test-virustotal-key',
          MALWAREBAZAAR_AUTH_KEY: 'test-malwarebazaar-key',
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
