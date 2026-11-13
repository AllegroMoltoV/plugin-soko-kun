// 証明の検証の受け口 (docs/design/scanning.md の「証明の検証の受け口」)。
// GitHub Actions の verify.yaml に検証待ちの配布物を渡し、検証の結果を受け取る。どちらも OIDC のトークンを求める。
import type { Env } from '../env';
import { verifyActionsToken } from './oidc';

const MAX_PENDING = 50;
const MAX_RESULTS = 100;
const MAX_ATTEMPTS = 5;
const WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9._-]{1,100}\.ya?ml$/;
const REASON = /^[a-z_]{1,40}$/;

interface PendingAsset {
  github_asset_id: number;
  download_url: string;
  digest: string;
  owner: string;
  repo: string;
  tag: string;
  commit_sha: string;
  release_workflow: string | null;
}

interface ResultInput {
  assetId: number;
  result: 'passed' | 'failed' | 'error';
  reason: string | null;
  signerWorkflow: string | null;
}

function parseResults(body: unknown): ResultInput[] | null {
  const raw = (body as { results?: unknown })?.results;
  if (!Array.isArray(raw) || raw.length > MAX_RESULTS) return null;
  const results: ResultInput[] = [];
  for (const item of raw) {
    const entry = item as Record<string, unknown>;
    if (typeof entry?.assetId !== 'number' || !Number.isSafeInteger(entry.assetId)) return null;
    if (entry.result !== 'passed' && entry.result !== 'failed' && entry.result !== 'error') return null;
    const reason = typeof entry.reason === 'string' && REASON.test(entry.reason) ? entry.reason : null;
    const signerWorkflow =
      typeof entry.signerWorkflow === 'string' && WORKFLOW_PATH.test(entry.signerWorkflow)
        ? entry.signerWorkflow
        : null;
    results.push({ assetId: entry.assetId, result: entry.result, reason, signerWorkflow });
  }
  return results;
}

export async function handleAttestations(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyActionsToken(token))) return new Response('unauthorized', { status: 401 });

  if (url.pathname === '/internal/attestations/pending' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT t.github_asset_id, a.download_url, a.digest, p.owner, p.repo, r.tag, r.commit_sha, p.release_workflow
       FROM attestation_checks t JOIN assets a ON a.github_asset_id = t.github_asset_id
       JOIN releases r ON r.github_release_id = a.release_id JOIN plugins p ON p.id = r.plugin_id
       WHERE p.removed = 0 AND (t.result = 'pending' OR (t.result = 'error' AND t.attempts < ?))
       ORDER BY t.checked_at IS NOT NULL, t.checked_at LIMIT ?`,
    )
      .bind(MAX_ATTEMPTS, MAX_PENDING)
      .all<PendingAsset>();
    return Response.json({
      assets: results.map((row) => ({
        assetId: row.github_asset_id,
        downloadUrl: row.download_url,
        digest: row.digest,
        repository: `${row.owner}/${row.repo}`,
        tag: row.tag,
        commitSha: row.commit_sha,
        signerWorkflow: row.release_workflow,
      })),
    });
  }

  if (url.pathname === '/internal/attestations/results' && request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('bad request', { status: 400 });
    }
    const results = parseResults(body);
    if (!results) return new Response('bad request', { status: 400 });
    if (results.length === 0) return Response.json({ updated: 0 });

    const ids = results.map((result) => result.assetId);
    const { results: rows } = await env.DB.prepare(
      `SELECT t.github_asset_id, p.id AS plugin_id, p.release_workflow
       FROM attestation_checks t JOIN assets a ON a.github_asset_id = t.github_asset_id
       JOIN releases r ON r.github_release_id = a.release_id JOIN plugins p ON p.id = r.plugin_id
       WHERE t.result IN ('pending', 'error') AND t.github_asset_id IN (${ids.map(() => '?').join(', ')})`,
    )
      .bind(...ids)
      .all<{ github_asset_id: number; plugin_id: string; release_workflow: string | null }>();
    const known = new Map(rows.map((row) => [row.github_asset_id, row]));
    const timestamp = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    // 同じ呼び出しの中で初めて記録するワークフローも、以降の配布物の照合に使う。
    const workflows = new Map<string, string | null>();
    for (const input of results) {
      const row = known.get(input.assetId);
      if (!row) continue;
      const expected = workflows.has(row.plugin_id) ? workflows.get(row.plugin_id) : row.release_workflow;
      let result = input.result;
      let reason = input.reason;
      // 記録したリリースのワークフローと違うワークフローが署名した証明は、検証が通っても受け付けない。
      if (result === 'passed' && (!input.signerWorkflow || (expected && expected !== input.signerWorkflow))) {
        result = 'failed';
        reason = input.signerWorkflow ? 'signer_workflow_mismatch' : 'signer_workflow_missing';
      }
      statements.push(
        env.DB.prepare(
          `UPDATE attestation_checks SET result = ?, reason = ?, signer_workflow = ?, attempts = attempts + 1, checked_at = ?
           WHERE github_asset_id = ? AND result IN ('pending', 'error')`,
        ).bind(result, reason, input.signerWorkflow, timestamp, input.assetId),
      );
      if (result === 'passed' && !expected) {
        workflows.set(row.plugin_id, input.signerWorkflow);
        statements.push(
          env.DB.prepare('UPDATE plugins SET release_workflow = ? WHERE id = ? AND release_workflow IS NULL').bind(
            input.signerWorkflow,
            row.plugin_id,
          ),
        );
      }
    }
    if (statements.length > 0) await env.DB.batch(statements);
    return Response.json({ updated: statements.length });
  }

  return new Response('not found', { status: 404 });
}
