// プラグインの概要の機械翻訳。翻訳は同期のときに行って D1 に保存し、画面の表示のときには翻訳しない。
// 翻訳専用のモデルを使い、概要に書かれた文を指示として解釈するモデルは使わない。
import { type Budget, BudgetExceededError } from './budget';
import type { Env } from './env';

export const TRANSLATION_MODEL = '@cf/meta/m2m100-1.2b';

// 保存する翻訳先の言語。m2m100 は中国語の繁体字に対応しないため、zh-Hant の画面は zh-Hans の翻訳を使う。
export const TRANSLATION_LANGS = ['ja', 'en', 'zh-Hans', 'ko', 'pt-BR', 'es-419'] as const;
export type TranslationLang = (typeof TRANSLATION_LANGS)[number];

const MODEL_CODE: Record<TranslationLang, string> = {
  ja: 'ja',
  en: 'en',
  'zh-Hans': 'zh',
  ko: 'ko',
  'pt-BR': 'pt',
  'es-419': 'es',
};

// 1 回の起動で行う翻訳の上限。Workers AI の無料枠 (1 日 10,000 Neurons) を少しずつ使う。
export const TRANSLATIONS_PER_RUN = 6;

// 原文の言語を文字の種類で判定する。かながあれば日本語、ハングルがあれば韓国語、漢字だけなら中国語、それ以外は英語。
export function detectLang(text: string): TranslationLang {
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[一-鿿]/.test(text)) return 'zh-Hans';
  return 'en';
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Candidate {
  id: string;
  summary: string;
  done: string | null;
}

export async function runTranslations(env: Env, budget: Budget): Promise<number> {
  if (!env.AI) return 0;
  budget.takeD1Query();
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.summary, group_concat(t.lang || ':' || t.source_hash) AS done
     FROM plugins p LEFT JOIN plugin_translations t ON t.plugin_id = p.id
     WHERE p.summary IS NOT NULL AND p.removed = 0
     GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 50`,
  ).all<Candidate>();

  const statements: D1PreparedStatement[] = [];
  let translated = 0;
  outer: for (const row of results) {
    const hash = await sha256(row.summary);
    const done = new Set((row.done ?? '').split(',').filter(Boolean));
    const from = detectLang(row.summary);
    for (const to of TRANSLATION_LANGS) {
      if (to === from || done.has(`${to}:${hash}`)) continue;
      if (translated >= TRANSLATIONS_PER_RUN || !budget.canFetch()) break outer;
      budget.takeSubrequest();
      try {
        const output = (await env.AI.run(TRANSLATION_MODEL, {
          text: row.summary,
          source_lang: MODEL_CODE[from],
          target_lang: MODEL_CODE[to],
        })) as { translated_text?: string };
        const text = output.translated_text?.trim();
        if (!text) continue;
        statements.push(
          env.DB.prepare(
            `INSERT INTO plugin_translations (plugin_id, lang, source_hash, text, translated_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (plugin_id, lang) DO UPDATE SET source_hash = excluded.source_hash, text = excluded.text,
               translated_at = excluded.translated_at`,
          ).bind(row.id, to, hash, text.slice(0, 1000), new Date().toISOString()),
        );
        translated += 1;
      } catch (error) {
        if (error instanceof BudgetExceededError) throw error;
        // 無料枠を使い切った日などは翻訳を止め、原文の表示のまま次回へ回す。
        console.log(JSON.stringify({ event: 'translation_failed', plugin: row.id, to }));
        break outer;
      }
    }
  }
  if (statements.length > 0) {
    budget.takeD1Query();
    await env.DB.batch(statements);
  }
  return translated;
}
