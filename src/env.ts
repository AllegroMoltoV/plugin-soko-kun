export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  VIRUSTOTAL_API_KEY?: string;
  MALWAREBAZAAR_AUTH_KEY?: string;
}
