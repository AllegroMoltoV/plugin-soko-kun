// 説明の画像から、詳細ページで表示する軽い WebP の画像を作る。変換は Cloudflare の画像の変換に任せ、
// 表示のときに待たせないよう、定期処理で作って D1 に保存する。アニメーションの GIF は最初のコマの静止画にする。
import type { Budget } from './budget';
import type { Env } from './env';
import { sniffImage } from './images';

// 1 回の起動で作る件数の上限。変換の無料枠 (月 5,000 件) と外部呼び出しの予算を少しずつ使う。
export const PREVIEWS_PER_RUN = 2;
const MAX_BYTES = 1536 * 1024;

export const PREVIEW_OPTIONS = { anim: false, format: 'webp', quality: 80, width: 1280, fit: 'scale-down' } as const;

interface Candidate {
  id: string;
  sha: string;
}

export async function runPreviews(env: Env, budget: Budget): Promise<number> {
  budget.takeD1Query();
  const { results } = await env.DB.prepare(
    `SELECT i.plugin_id AS id, i.blob_sha AS sha FROM plugin_images i
     JOIN plugins p ON p.id = i.plugin_id
     LEFT JOIN plugin_image_previews v ON v.plugin_id = i.plugin_id
     WHERE i.kind = 'image' AND p.removed = 0 AND p.images_hidden = 0 AND (v.source_sha IS NULL OR v.source_sha != i.blob_sha)
     ORDER BY p.updated_at DESC LIMIT ?`,
  )
    .bind(PREVIEWS_PER_RUN)
    .all<Candidate>();

  const statements: D1PreparedStatement[] = [];
  for (const row of results) {
    if (!budget.canFetch()) break;
    budget.takeSubrequest();
    try {
      // 元の画像は自分の配信の URL から取らせる。変換の結果は WebP を受け付けると伝えたときだけ WebP になる。
      const response = await fetch(`${env.ORIGIN}/plugins/${row.id}/image?v=${row.sha}`, {
        headers: { Accept: 'image/webp' },
        cf: { image: PREVIEW_OPTIONS },
      } as RequestInit);
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const info = bytes.length <= MAX_BYTES ? sniffImage(bytes) : null;
      // 変換が効かず元の画像が返った場合も、WebP でなければ保存しない。
      if (info?.type !== 'image/webp') continue;
      statements.push(
        env.DB.prepare(
          `INSERT INTO plugin_image_previews (plugin_id, source_sha, width, height, bytes, made_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (plugin_id) DO UPDATE SET source_sha = excluded.source_sha, width = excluded.width,
             height = excluded.height, bytes = excluded.bytes, made_at = excluded.made_at`,
        ).bind(row.id, row.sha, info.width, info.height, bytes, new Date().toISOString()),
      );
    } catch {
      console.log(JSON.stringify({ event: 'preview_failed', plugin: row.id }));
    }
  }
  if (statements.length > 0) {
    budget.takeD1Query();
    await env.DB.batch(statements);
  }
  return statements.length;
}
