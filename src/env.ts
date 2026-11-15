export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  // Workers AI。説明文の機械翻訳に使う。無い環境では翻訳せずに原文を表示する。
  AI?: Ai;
  // Workers AI の呼び出しを通す AI Gateway の ID。本番だけに置き、その支出の上限で費用を止める。無い環境ではゲートウェイを通さない。
  AI_GATEWAY_ID?: string;
  ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  MALWAREBAZAAR_AUTH_KEY?: string;
  // 証明の検証のワークフロー verify.yaml を起動する fine-grained PAT。無い環境では起動しない。
  GITHUB_DISPATCH_TOKEN?: string;
  // 開発者の連絡先。収集を防ぐためソースに書かず、「連絡先を表示」ボタンを押したときだけ返す。
  CONTACT_EMAIL?: string;
}
