export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  // Workers AI。説明文の機械翻訳に使う。無い環境では翻訳せずに原文を表示する。
  AI?: Ai;
  ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  MALWAREBAZAAR_AUTH_KEY?: string;
  // 証明の検証のワークフロー verify.yaml を起動する fine-grained PAT。無い環境では起動しない。
  GITHUB_DISPATCH_TOKEN?: string;
  // 開発者の連絡先。収集を防ぐためソースに書かず、「連絡先を表示」ボタンを押したときだけ返す。
  CONTACT_EMAIL?: string;
}
