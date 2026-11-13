// 証明の検証の受け口のアクセス権限。本サービスのリポジトリの main の verify.yaml 以外のトークンを 401 で拒否することと、
// 検証の結果で掲載の条件をすり抜けられないことを確かめる (software-test スキル: 拒否の側を表で書く)。
import { env, SELF } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIONS_JWKS_URL, clearJwksCache, EXPECTED_REPOSITORY, EXPECTED_WORKFLOW_REF } from '../src/attestation/oidc';
import { submitPlugin } from '../src/domain/submit';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from './fixtures/github';
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

  it('一度失敗した証明は、あとから成功を送っても書き換えない', async () => {
    const [first = 0] = await register();
    await post([{ assetId: first, result: 'failed', reason: 'no_attestation' }]);
    await post([{ assetId: first, result: 'passed', signerWorkflow: '.github/workflows/push.yaml' }]);
    expect(await resultOf(first)).toMatchObject({ result: 'failed' });
  });
});
