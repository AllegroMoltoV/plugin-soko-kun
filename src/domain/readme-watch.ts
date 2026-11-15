// 掲載の後の既定のブランチの README の照合。新しい版のレビューはタグの時点の README を照合するため、掲載の後に
// 既定のブランチの README へ案内を足す経路は次の版まで残る。1 日 1 回のダウンロード数の記録で照合し、この経路を塞ぐ。
// README の本文は保存せず、当たった行の本文のハッシュの集合を基準として保存する。
import { guidanceHits } from '../review/rules';

// 管理者が確かめるために保存する、当たった行の本文の長さの上限。
const MAX_HIT_TEXT = 200;

export type ReadmeFetch = { content: string } | 'too_large' | null | { error: string };

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseState(state: string | null): Set<string> | 'too_large' | null {
  if (state === null) return null;
  if (state === 'too_large') return 'too_large';
  try {
    const value = JSON.parse(state) as unknown;
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

// plugins の行に照合の結果を書く文。README が無ければ何もしない (null)。
// 最初の照合は基準の記録だけにする。配備の直後に、正当な README の手順で承認済みのプラグインがまとめて止まらないようにするため。
// 2 回目からは、基準に無い当たった行が現れたとき、README が新たに上限を超えたとき、照合に失敗したときに確認待ちにする。
// 確認待ちは管理者が解くまで続く。基準は毎回書き換えるため、管理者が解いた時点の README が次の基準になる。
export async function readmeWatchStatement(
  db: D1Database,
  pluginId: string,
  previous: string | null,
  readme: ReadmeFetch,
): Promise<D1PreparedStatement | null> {
  if (readme === null) return null;
  if (typeof readme === 'object' && 'error' in readme) {
    return db
      .prepare('UPDATE plugins SET readme_held = 1, readme_hits = ? WHERE id = ?')
      .bind(JSON.stringify({ error: readme.error }), pluginId);
  }
  const before = parseState(previous);
  let state: string;
  let hits: Array<{ line: number; rule: string; text: string }> = [];
  let flagged: boolean;
  if (readme === 'too_large') {
    state = 'too_large';
    flagged = before !== null && before !== 'too_large';
  } else {
    const lines = readme.content.split('\n');
    hits = guidanceHits(readme.content).map((hit) => ({
      ...hit,
      text: (lines[hit.line - 1] ?? '').trim().slice(0, MAX_HIT_TEXT),
    }));
    const hashes = [
      ...new Set(await Promise.all(hits.map((hit) => sha256Hex((lines[hit.line - 1] ?? '').trim())))),
    ].sort();
    state = JSON.stringify(hashes);
    // 上限を超えていた README の中身は誰も確かめていないため、当たった行があれば確認待ちにする。
    flagged = before !== null && hashes.some((hash) => before === 'too_large' || !before.has(hash));
  }
  return db
    .prepare(
      'UPDATE plugins SET readme_held = CASE WHEN ?1 = 1 THEN 1 ELSE readme_held END, readme_state = ?2, readme_hits = ?3 WHERE id = ?4',
    )
    .bind(flagged ? 1 : 0, state, JSON.stringify(hits), pluginId);
}
