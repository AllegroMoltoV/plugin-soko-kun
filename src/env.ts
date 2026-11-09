export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  // Workers AI。説明文の機械翻訳に使う。無い環境では翻訳せずに原文を表示する。
  AI?: Ai;
  ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  VIRUSTOTAL_API_KEY?: string;
  MALWAREBAZAAR_AUTH_KEY?: string;
}
