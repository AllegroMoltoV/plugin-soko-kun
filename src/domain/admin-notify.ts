// 管理者の確認待ちと、運営者以外の作者のプラグインの登録を、管理者だけが見られる Discord の非公開チャンネルへ知らせる。
// 確認待ちの理由ごとに 1 回だけ送り、送ったキーを admin_notifications に記録する。理由が解けたら記録を消し、
// 同じ理由で確認待ちに戻ったときに知らせ直す。公開の Issue には第三者のプラグインが止まっていることが出るため使わない。
import { type Budget, budgetedFetch } from '../budget';
import type { Env } from '../env';
import { type AdminWait, loadAdminWaits } from './catalog';

// 通知に取り分ける外部呼び出しと D1 のクエリ (確認待ちの読み込み・運営者以外の作者の読み込み・記録の読み込み・記録の書き込み)。
export const NOTIFY_RESERVE = 1;
export const NOTIFY_QUERIES = 4;

// 運営者 (AllegroMoltoV) の GitHub のユーザー ID。運営者以外の作者が登録したプラグインを 1 件ずつ知らせる。
// ADR 0019 の原則に照らした改善のうち、運営者以外の作者が来てから影響するもの (同期の失敗の試行の数え方など) に着手する時点を、管理者が知るため。
export const OPERATOR_GITHUB_ID = 77569633;
// 運営者以外の作者の登録を知らせた記録のキーの接頭辞。確認待ちと違い解けることが無いため、記録を消さない。
const AUTHOR_KEY_PREFIX = 'a:';

export type ThirdPartyPlugin = { key: string; plugin: string; url: string };

const WEBHOOK_PREFIX = 'https://discord.com/api/webhooks/';
// Discord のメッセージの本文の上限。超えると 400 が返り、記録を足さないため、同じ本文を送り続けて失敗し続ける。
const MAX_CONTENT = 2000;
// 節の末尾の「ほか N 件」の行に残す文字数。
const TAIL_RESERVE = 20;

export type AdminNotify = 'sent' | 'skipped_no_url' | 'skipped_none' | 'skipped_budget' | `failed_${string}`;

// プラグインの名前とタグは GitHub 由来のため、Discord の書式の記号を無効にする。
const escapeMarkdown = (text: string) => text.replace(/[\\`*_~|>[\]()#-]/g, '\\$&');

// URL は <> で囲み、埋め込みの表示を止める。
const entry = (subject: string, detail: string, url: string) =>
  `\n- ${escapeMarkdown(subject)}${detail ? `: ${detail}` : ''}${url ? ` <${url}>` : ''}`;

export function message(waits: AdminWait[], authors: ThirdPartyPlugin[]): string {
  const sections: { header: string; lines: string[] }[] = [];
  if (waits.length > 0) {
    sections.push({
      header: `倉庫くん: 管理者の確認待ちが ${waits.length} 件増えました。\`npm run admin -- pending --remote\` で確かめてください。`,
      lines: waits.map((wait) => entry(wait.tag ? `${wait.plugin} ${wait.tag}` : wait.plugin, wait.code, wait.url)),
    });
  }
  if (authors.length > 0) {
    sections.push({
      header: `倉庫くん: 運営者以外の作者がプラグインを ${authors.length} 件登録しました。ADR 0019 の原則に照らした改善のうち、運営者以外の作者が来てから影響するものに着手してください。`,
      lines: authors.map((author) => entry(author.plugin, '', author.url)),
    });
  }
  let content = '';
  sections.forEach((section, index) => {
    content += `${content ? '\n' : ''}${section.header}`;
    // 自分の節の件数の行と、後ろの節の見出しと件数の行の分を残す。見出しは切り詰めずに必ず載せるため。
    const reserve = sections
      .slice(index + 1)
      .reduce((sum, later) => sum + 1 + later.header.length + TAIL_RESERVE, TAIL_RESERVE);
    let shown = 0;
    for (const line of section.lines) {
      if (content.length + line.length + reserve > MAX_CONTENT) break;
      content += line;
      shown += 1;
    }
    if (shown < section.lines.length) content += `\n- ほか ${section.lines.length - shown} 件`;
  });
  return content;
}

export async function notifyAdmin(env: Env, budget: Budget): Promise<AdminNotify> {
  const webhook = env.DISCORD_WEBHOOK_URL;
  if (!webhook?.startsWith(WEBHOOK_PREFIX)) return 'skipped_no_url';
  if (!budget.canQuery(NOTIFY_QUERIES) || !budget.canFetch(NOTIFY_RESERVE)) return 'skipped_budget';
  try {
    budget.takeD1Query();
    const waits = await loadAdminWaits(env);
    budget.takeD1Query();
    const { results: plugins } = await env.DB.prepare(
      'SELECT id, owner, repo FROM plugins WHERE submitter_github_id != ? ORDER BY created_at',
    )
      .bind(OPERATOR_GITHUB_ID)
      .all<{ id: string; owner: string; repo: string }>();
    const authors: ThirdPartyPlugin[] = plugins.map((row) => ({
      key: `${AUTHOR_KEY_PREFIX}${row.id}`,
      plugin: `${row.owner}/${row.repo}`,
      url: `https://github.com/${row.owner}/${row.repo}`,
    }));
    budget.takeD1Query();
    const { results } = await env.DB.prepare('SELECT key FROM admin_notifications').all<{ key: string }>();
    const notified = new Set(results.map((row) => row.key));
    const current = new Set(waits.map((wait) => wait.key));
    const fresh = waits.filter((wait) => !notified.has(wait.key));
    const freshAuthors = authors.filter((author) => !notified.has(author.key));
    const statements = [...notified]
      .filter((key) => !key.startsWith(AUTHOR_KEY_PREFIX) && !current.has(key))
      .map((key) => env.DB.prepare('DELETE FROM admin_notifications WHERE key = ?').bind(key));
    let result: AdminNotify = 'skipped_none';
    if (fresh.length > 0 || freshAuthors.length > 0) {
      const url = new URL(webhook);
      // wait を付けないと、保存されなかったメッセージでも成功の応答が返る。
      url.searchParams.set('wait', 'true');
      const response = await budgetedFetch(budget, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // タグやリポジトリの名前に書かれた @everyone などで通知が飛ばないようにする。
        body: JSON.stringify({ content: message(fresh, freshAuthors), allowed_mentions: { parse: [] } }),
      });
      await response.body?.cancel();
      if (response.ok) {
        result = 'sent';
        const timestamp = new Date().toISOString();
        // 本文に収まらず件数だけを書いた分も記録する。詳細は pending で確かめる。
        for (const { key } of [...fresh, ...freshAuthors]) {
          statements.push(
            env.DB.prepare('INSERT OR IGNORE INTO admin_notifications (key, notified_at) VALUES (?, ?)').bind(
              key,
              timestamp,
            ),
          );
        }
      } else {
        result = `failed_${response.status}`;
      }
    }
    if (statements.length > 0) {
      budget.takeD1Query();
      await env.DB.batch(statements);
    }
    if (result.startsWith('failed_')) console.error(`admin notification failed: ${result}`);
    return result;
  } catch (error) {
    // 例外のメッセージに URL が入る場合があるため、種類だけを出す。
    console.error(`admin notification failed: ${error instanceof Error ? error.name : 'unknown'}`);
    return 'failed_error';
  }
}
