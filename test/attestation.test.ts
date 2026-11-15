// 証明の検証の受け口のアクセス権限。本サービスのリポジトリの main の verify.yaml 以外のトークンを 401 で拒否することと、
// 検証の結果で掲載の条件をすり抜けられないことを確かめる (software-test スキル: 拒否の側を表で書く)。
import { env, SELF } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIONS_JWKS_URL, clearJwksCache, EXPECTED_REPOSITORY, EXPECTED_WORKFLOW_REF } from '../src/attestation/oidc';
import { authorReport } from '../src/domain/author';
import { submitPlugin } from '../src/domain/submit';
import { githubHandlers, OWNER, REPO, REPO_ID, USER_TOKEN } from './fixtures/github';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';
const PENDING = `${ORIGIN}/internal/attestations/pending`;
const RESULTS = `${ORIGIN}/internal/attestations/results`;

const encode = (value: unknown) =>
  btoa(typeof value === 'string' ? value : JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

let keyPair: CryptoKeyPair;
let otherKeyPair: CryptoKeyPair;

async function sign(claims: Record<string, unknown>, keys = keyPair, kid = 'test-key'): Promise<string> {
  const head = encode({ alg: 'RS256', typ: 'JWT', kid });
  const body = encode(claims);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keys.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  const bytes = String.fromCharCode(...new Uint8Array(signature));
  return `${head}.${body}.${encode(bytes)}`;
}

const valid = () => ({
  iss: 'https://token.actions.githubusercontent.com',
  aud: 'soko-kun',
  repository: EXPECTED_REPOSITORY,
  job_workflow_ref: EXPECTED_WORKFLOW_REF,
  ref: 'refs/heads/main',
  exp: Math.floor(Date.now() / 1000) + 300,
});

async function generate(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

beforeEach(async () => {
  clearJwksCache();
  keyPair ??= await generate();
  otherKeyPair ??= await generate();
  const jwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
  network.use(
    http.get(ACTIONS_JWKS_URL, () => HttpResponse.json({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256' }] })),
  );
});

describe('証明の検証の受け口のアクセス権限', () => {
  const rejected: Array<[string, () => Promise<string>]> = [
    ['トークンが無い', async () => ''],
    ['別のリポジトリのワークフロー', async () => sign({ ...valid(), repository: 'attacker/plugin-soko-kun' })],
    [
      '同じリポジトリの別のワークフロー',
      async () =>
        sign({ ...valid(), job_workflow_ref: `${EXPECTED_REPOSITORY}/.github/workflows/ci.yml@refs/heads/main` }),
    ],
    [
      'main 以外のブランチで動いた verify.yaml',
      async () =>
        sign({ ...valid(), job_workflow_ref: `${EXPECTED_REPOSITORY}/.github/workflows/verify.yaml@refs/heads/evil` }),
    ],
    ['期限切れ', async () => sign({ ...valid(), exp: Math.floor(Date.now() / 1000) - 10 })],
    ['宛先 (aud) が違う', async () => sign({ ...valid(), aud: 'sigstore' })],
    ['発行者が違う', async () => sign({ ...valid(), iss: 'https://example.com' })],
    ['公開されていない鍵で署名', async () => sign(valid(), otherKeyPair)],
    [
      '署名のあとでクレームを書き換えた',
      async () => {
        const [head, , signature] = (await sign(valid())).split('.');
        return `${head}.${encode({ ...valid(), repository: 'attacker/x' })}.${signature}`;
      },
    ],
  ];

  for (const [label, token] of rejected) {
    it(`${label}: 一覧の取得と結果の送信を 401 で拒否する`, async () => {
      const authorization = `Bearer ${await token()}`;
      expect((await SELF.fetch(PENDING, { headers: { Authorization: authorization } })).status).toBe(401);
      const post = await SELF.fetch(RESULTS, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: [] }),
      });
      expect(post.status).toBe(401);
    });
  }

  it('main の verify.yaml のトークンは受け付ける', async () => {
    const response = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
    expect(response.status).toBe(200);
  });
});

describe('証明の検証の結果', () => {
  async function register(): Promise<number[]> {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
    const { results } = await env.DB.prepare(
      'SELECT github_asset_id FROM attestation_checks ORDER BY github_asset_id',
    ).all<{
      github_asset_id: number;
    }>();
    return results.map((row) => row.github_asset_id);
  }

  async function post(results: unknown[]): Promise<void> {
    const response = await SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await sign(valid())}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
    expect(response.status).toBe(200);
  }

  const resultOf = (id: number) =>
    env.DB.prepare('SELECT result, reason FROM attestation_checks WHERE github_asset_id = ?').bind(id).first();

  // 名前を変える前に作られた証明は、作られたときの名前 (大文字と小文字を含む) でしか検証に通らない (ADR 0015)。
  it('検証待ちの一覧に、リポジトリ ID と、大文字と小文字を保った旧い名前を新しい順に含める', async () => {
    await register();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at, name) VALUES ('allegromoltov/older', (SELECT id FROM plugins), '2026-11-01T00:00:00Z', 'AllegroMoltoV/Older')",
    ).run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at, name) VALUES ('allegromoltov/newer', (SELECT id FROM plugins), '2026-11-10T00:00:00Z', 'AllegroMoltoV/Newer')",
    ).run();
    const response = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
    const body = (await response.json()) as { assets: Array<{ repositoryId: number; previousRepositories: string[] }> };
    expect(body.assets.length).toBeGreaterThan(0);
    expect(body.assets[0]?.repositoryId).toBe(REPO_ID);
    expect(body.assets[0]?.previousRepositories).toEqual(['AllegroMoltoV/Newer', 'AllegroMoltoV/Older']);
  });

  it('初めて検証できたワークフローを記録し、別のワークフローが署名した証明は通さない', async () => {
    const [first = 0, second = 0] = await register();
    await post([
      { assetId: first, result: 'passed', signerWorkflow: '.github/workflows/push.yaml' },
      { assetId: second, result: 'passed', signerWorkflow: '.github/workflows/evil.yaml' },
    ]);
    expect(await resultOf(first)).toMatchObject({ result: 'passed' });
    expect(await resultOf(second)).toMatchObject({ result: 'failed', reason: 'signer_workflow_mismatch' });
    expect(await env.DB.prepare('SELECT release_workflow FROM plugins').first('release_workflow')).toBe(
      '.github/workflows/push.yaml',
    );
  });

  // 同じ配布物の結果が 2 つあると、記録される結果が送った順番で決まってしまう。
  it('同じ配布物の結果を 2 つ含む要求は、全体を 400 で拒否し、何も書き換えない', async () => {
    const [first = 0] = await register();
    const response = await SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await sign(valid())}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [
          { assetId: first, result: 'failed', reason: 'no_attestation' },
          { assetId: first, result: 'passed', signerWorkflow: '.github/workflows/push.yaml' },
        ],
      }),
    });
    expect(response.status).toBe(400);
    expect(await resultOf(first)).toMatchObject({ result: 'pending' });
  });

  // 試行を使い切った配布物は検証待ちから外れる。作者に「対応不要」と返し続けず、管理者の待ちとして返す。
  it('error で試行を使い切った証明は、検証待ちから外れ、作者には管理者の待ちとして返す', async () => {
    const [first = 0] = await register();
    for (let i = 0; i < 5; i += 1) await post([{ assetId: first, result: 'error', reason: 'download_failed' }]);
    const pending = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
    const body = (await pending.json()) as { assets: Array<{ assetId: number }> };
    expect(body.assets.map((asset) => asset.assetId)).not.toContain(first);
    const pluginId = await env.DB.prepare('SELECT id FROM plugins').first<string>('id');
    const report = await authorReport(env, pluginId ?? '', true);
    const codes = report?.versions[0]?.blockers.map((blocker) => blocker.code);
    expect(codes).toContain('attestation_retries_exhausted');
    expect(codes).not.toContain('attestation_pending');
  });

  it('一度失敗した証明は、あとから成功を送っても書き換えない', async () => {
    const [first = 0] = await register();
    await post([{ assetId: first, result: 'failed', reason: 'no_attestation' }]);
    await post([{ assetId: first, result: 'passed', signerWorkflow: '.github/workflows/push.yaml' }]);
    expect(await resultOf(first)).toMatchObject({ result: 'failed' });
  });
});

describe('通信の API の検出の結果', () => {
  const releaseId = () =>
    env.DB.prepare('SELECT github_release_id FROM release_checks').first<number>('github_release_id');

  async function register(): Promise<void> {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
  }

  it('検出を待つ版を一覧に載せ、結果を保存したら一覧から外す', async () => {
    await register();
    const pending = async () => {
      const response = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
      return ((await response.json()) as { releases: Array<{ releaseId: number; repository: string }> }).releases;
    };
    const id = await releaseId();
    expect((await pending()).map((entry) => entry.releaseId)).toEqual([id]);
    const response = await SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await sign(valid())}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [],
        networkScans: [
          {
            releaseId: id,
            result: 'done',
            truncated: false,
            hits: [
              { file: 'src/client.cpp', line: 37, api: 'libcurl', text: 'curl_easy_init();' },
              { file: 'src/evil.cpp', line: 1, api: 'made-up', text: 'x' },
              { file: 'src/bad.cpp', line: 'one', api: 'libcurl', text: 'x' },
            ],
            docHits: [{ file: 'docs/INSTALL.md', line: 3, rule: 'no-terminal-paste', text: 'curl x | sh' }],
            docTruncated: false,
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    const row = await env.DB.prepare('SELECT network_state, network_hits, doc_hits FROM release_checks').first<{
      network_state: string;
      network_hits: string;
      doc_hits: string;
    }>();
    // 同じ取り出しで照合した文書の当たりも、同じ結果で保存する。
    expect(JSON.parse(row?.doc_hits ?? '{}')).toEqual({
      hits: [{ file: 'docs/INSTALL.md', line: 3, rule: 'no-terminal-paste', text: 'curl x | sh' }],
      truncated: false,
    });
    expect(row?.network_state).toBe('done');
    expect(JSON.parse(row?.network_hits ?? '{}')).toEqual({
      hits: [{ file: 'src/client.cpp', line: 37, api: 'libcurl', text: 'curl_easy_init();' }],
      truncated: false,
    });
    expect(await pending()).toEqual([]);
  });

  it('トークンの無い要求では、検出の結果を書き換えない', async () => {
    await register();
    const response = await SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [], networkScans: [{ releaseId: await releaseId(), result: 'done', hits: [] }] }),
    });
    expect(response.status).toBe(401);
    expect(await env.DB.prepare('SELECT network_state FROM release_checks').first('network_state')).toBe('pending');
  });
});
