// 管理者の確認待ちを、管理者だけが見られる Discord の非公開チャンネルへ知らせる。
// 確認待ちの理由ごとに 1 回だけ送り、送ったキーを admin_notifications に記録する。理由が解けたら記録を消し、
// 同じ理由で確認待ちに戻ったときに知らせ直す。公開の Issue には第三者のプラグインが止まっていることが出るため使わない。
import { type Budget, budgetedFetch } from '../budget';
import type { Env } from '../env';
import { type AdminWait, loadAdminWaits } from './catalog';

// 通知に取り分ける外部呼び出しと D1 のクエリ (確認待ちの読み込み・記録の読み込み・記録の書き込み)。
export const NOTIFY_RESERVE = 1;
export const NOTIFY_QUERIES = 3;

const WEBHOOK_PREFIX = 'https://discord.com/api/webhooks/';
// Discord のメッセージの本文の上限は 2,000 文字。末尾の件数の行の分を残す。
const MAX_CONTENT = 1900;

export type AdminNotify = 'sent' | 'skipped_no_url' | 'skipped_none' | 'skipped_budget' | `failed_${string}`;

// プラグインの名前とタグは GitHub 由来のため、Discord の書式の記号を無効にする。
const escapeMarkdown = (text: string) => text.replace(/[\\`*_~|>[\]()#-]/g, '\\$&');

function message(waits: AdminWait[]): string {
  let content = `倉庫くん: 管理者の確認待ちが ${waits.length} 件増えました。\`npm run admin -- pending --remote\` で確かめてください。`;
  let shown = 0;
  for (const wait of waits) {
    const subject = wait.tag ? `${wait.plugin} ${wait.tag}` : wait.plugin;
    // URL は <> で囲み、埋め込みの表示を止める。
    const line = `\n- ${escapeMarkdown(subject)}: ${wait.code}${wait.url ? ` <${wait.url}>` : ''}`;
    if (content.length + line.length > MAX_CONTENT) break;
    content += line;
    shown += 1;
  }
  if (shown < waits.length) content += `\n- ほか ${waits.length - shown} 件`;
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
    const { results } = await env.DB.prepare('SELECT key FROM admin_notifications').all<{ key: string }>();
    const notified = new Set(results.map((row) => row.key));
    const current = new Set(waits.map((wait) => wait.key));
    const fresh = waits.filter((wait) => !notified.has(wait.key));
    const statements = [...notified]
      .filter((key) => !current.has(key))
      .map((key) => env.DB.prepare('DELETE FROM admin_notifications WHERE key = ?').bind(key));
    let result: AdminNotify = 'skipped_none';
    if (fresh.length > 0) {
      const url = new URL(webhook);
      // wait を付けないと、保存されなかったメッセージでも成功の応答が返る。
      url.searchParams.set('wait', 'true');
      const response = await budgetedFetch(budget, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // タグやリポジトリの名前に書かれた @everyone などで通知が飛ばないようにする。
        body: JSON.stringify({ content: message(fresh), allowed_mentions: { parse: [] } }),
      });
      await response.body?.cancel();
      if (response.ok) {
        result = 'sent';
        const timestamp = new Date().toISOString();
        // 本文に収まらず件数だけを書いた分も記録する。詳細は pending で確かめる。
        for (const wait of fresh) {
          statements.push(
            env.DB.prepare('INSERT OR IGNORE INTO admin_notifications (key, notified_at) VALUES (?, ?)').bind(
              wait.key,
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
