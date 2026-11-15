// リリースノート (GitHub のリリースの本文) の照合。本文は保存せず、案内の型に当たった行と本文のハッシュだけを保存する。
// 本文は同期と 1 日 1 回のダウンロード数の記録で受け取る releases の応答に含まれるため、外部呼び出しは増えない。
import { guidanceHits } from '../review/rules';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// release_checks の行に照合の結果を書く文。行が無いリリースには何もしない。
// 照合の済んだ本文が編集され、新しい本文が型に当たったときは、管理者の確認待ちにし、承認を取り消す。
// 承認済みの版の本文に、承認の後で案内を足す経路を止めるため。SQLite の SET の右辺は更新前の値で評価される。
export async function releaseNotesStatement(
  db: D1Database,
  releaseId: number,
  body: string | null | undefined,
): Promise<D1PreparedStatement> {
  const text = body ?? '';
  const hash = await sha256Hex(text);
  const hits = guidanceHits(text);
  const flagged = hits.length > 0 ? 1 : 0;
  return db
    .prepare(
      `UPDATE release_checks SET
         notes_held = CASE WHEN notes_hash IS NOT NULL AND notes_hash <> ?1 AND ?2 = 1 THEN 1 ELSE notes_held END,
         admin_approved_at = CASE WHEN notes_hash IS NOT NULL AND notes_hash <> ?1 AND ?2 = 1 THEN NULL ELSE admin_approved_at END,
         notes_hits = ?3,
         notes_hash = ?1
       WHERE github_release_id = ?4`,
    )
    .bind(hash, flagged, JSON.stringify(hits), releaseId);
}

// 保存した照合の結果を読む。形の合わないものは捨てる。
export function readReleaseNotesHits(
  text: string | null,
): Array<{ line: number; rule: 'no-security-bypass' | 'no-terminal-paste' }> | undefined {
  if (text === null) return undefined;
  try {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (hit): hit is { line: number; rule: 'no-security-bypass' | 'no-terminal-paste' } =>
        typeof hit === 'object' &&
        hit !== null &&
        Number.isSafeInteger((hit as { line?: unknown }).line) &&
        ((hit as { rule?: unknown }).rule === 'no-security-bypass' ||
          (hit as { rule?: unknown }).rule === 'no-terminal-paste'),
    );
  } catch {
    return [];
  }
}
