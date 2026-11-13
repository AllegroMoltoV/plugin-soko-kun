// GitHub Actions の OIDC のトークンの検証 (docs/design/scanning.md の「証明の検証の受け口」、ADR 0014)。
// 本サービスのリポジトリの main で動く verify.yaml が発行したトークンだけを受け付ける。
export const ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com';
export const ACTIONS_JWKS_URL = `${ACTIONS_ISSUER}/.well-known/jwks`;
export const EXPECTED_AUDIENCE = 'soko-kun';
export const EXPECTED_REPOSITORY = 'AllegroMoltoV/plugin-soko-kun';
export const EXPECTED_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/.github/workflows/verify.yaml@refs/heads/main`;

// 鍵の一覧は isolate の中で 1 時間だけ使い回す。鍵の入れ替えに追従できるよう、知らない kid では取り直す。
const JWKS_TTL_MS = 60 * 60 * 1000;
let cachedKeys: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

export function clearJwksCache(): void {
  cachedKeys = null;
}

async function loadKeys(force: boolean): Promise<JsonWebKey[]> {
  if (!force && cachedKeys && Date.now() - cachedKeys.fetchedAt < JWKS_TTL_MS) return cachedKeys.keys;
  const response = await fetch(ACTIONS_JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`jwks ${response.status}`);
  const body = (await response.json()) as { keys?: JsonWebKey[] };
  cachedKeys = { keys: Array.isArray(body.keys) ? body.keys : [], fetchedAt: Date.now() };
  return cachedKeys.keys;
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
    return typeof value === 'object' && value !== null ? value : null;
  } catch {
    return null;
  }
}

// 受け付けてよいトークンなら true。署名・発行者・宛先・リポジトリ・ワークフロー・期限のどれかが合わなければ false。
export async function verifyActionsToken(token: string, nowSeconds = Date.now() / 1000): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerPart = '', payloadPart = '', signaturePart = ''] = parts;
  const header = decodeJson(headerPart);
  const claims = decodeJson(payloadPart);
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return false;

  let keys = await loadKeys(false);
  let jwk = keys.find((key) => (key as { kid?: string }).kid === header.kid);
  if (!jwk) {
    keys = await loadKeys(true);
    jwk = keys.find((key) => (key as { kid?: string }).kid === header.kid);
  }
  if (!jwk) return false;

  let valid = false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
      'verify',
    ]);
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlDecode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return false;
  }
  if (!valid) return false;

  const audience = claims.aud;
  const audienceOk = Array.isArray(audience) ? audience.includes(EXPECTED_AUDIENCE) : audience === EXPECTED_AUDIENCE;
  const skew = 60;
  return (
    claims.iss === ACTIONS_ISSUER &&
    audienceOk &&
    claims.repository === EXPECTED_REPOSITORY &&
    claims.job_workflow_ref === EXPECTED_WORKFLOW_REF &&
    typeof claims.exp === 'number' &&
    claims.exp > nowSeconds &&
    (typeof claims.nbf !== 'number' || claims.nbf <= nowSeconds + skew)
  );
}
