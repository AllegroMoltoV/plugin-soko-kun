// セキュリティの機能を切らせる案内と、取得した内容をその場で実行させるコマンドの型。
// Worker (src/review/rules.ts) と、GitHub Actions の README 以外の文書の照合 (.github/scripts/scan-docs.mjs) の両方が読む。
// 型を 2 か所に書かないため、TypeScript ではなく JavaScript の ES モジュールにし、型は guidance-patterns.d.mts に置く。
// 姉妹版 (音のプラグイン倉庫くん) と同じ実装に保つ。
// 否定の文脈 (「〜しないでください」) も当たるが、重大の指摘は管理者が根拠の行を見て判断する。

const SECURITY_BYPASS = [
  // xattr -d com.apple.quarantine、xattr -rd、xattr -c、xattr -cr による隔離属性の除去。-l や -p の表示は当たらない。
  /\bxattr\s+(?:-[a-z]+\s+)*-[a-z]*[cd][a-z]*\b/i,
  /\bspctl\s+--(?:master|global)-disable\b/i,
  /open anyway|このまま開く/i,
  /\b(?:Add|Set)-MpPreference\b[^\n]*-(?:Exclusion|Disable)/i,
];
const WINDOWS_PROTECTION = /smartscreen|defender|smart app control/i;
const TURN_OFF = /disabl|turn(?:ing)? off|switch(?:ing)? off|deactivat|exclu|whitelist|allowlist|無効|オフ|除外/i;

const TERMINAL_PASTE = [
  // 取得した内容をシェルや osascript へパイプで渡す。
  /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:(?:ba|z|da|k)?sh|osascript|python3?|perl|ruby)\b/i,
  // シェルにコマンド置換やプロセス置換で渡す。
  /\b(?:ba|z)?sh\s+(?:-c\s+["']?\$\(|<\()\s*(?:curl|wget)\b/i,
  // PowerShell の irm | iex と、iex (New-Object Net.WebClient).DownloadString(...)。
  /\b(?:irm|iwr|invoke-restmethod|invoke-webrequest)\b[^\n]*\|\s*(?:iex|invoke-expression)\b/i,
  /\b(?:iex|invoke-expression)\b[^\n]*(?:\birm\b|\biwr\b|invoke-restmethod|invoke-webrequest|downloadstring|net\.webclient)/i,
  // base64 で埋め込んだ文字列を復号して実行する。
  /\bbase64\s+(?:-d|-D|--decode)\b[^\n]*\|\s*(?:sudo\s+)?(?:(?:ba|z)?sh|osascript)\b/i,
  /\bpowershell(?:\.exe)?\b[^\n]*\s-(?:e|ec|enc|encodedcommand)\s+[A-Za-z0-9+/=]{16,}/i,
  /frombase64string[^\n]*(?:iex|invoke-expression)|(?:iex|invoke-expression)[^\n]*frombase64string/i,
  /\bosascript\b[^\n]*(?:curl|wget|https?:\/\/)/i,
];

// セキュリティの機能を切らせる案内の型に当たる行。
export function matchesSecurityBypass(text) {
  return (
    SECURITY_BYPASS.some((pattern) => pattern.test(text)) || (WINDOWS_PROTECTION.test(text) && TURN_OFF.test(text))
  );
}

// 取得した内容をその場で実行させるコマンドの型に当たる行。
export function matchesTerminalPaste(text) {
  return TERMINAL_PASTE.some((pattern) => pattern.test(text));
}

// 文章の行ごとに 2 つの型を当て、当たった行の番号と項目を返す。
export function guidanceHits(text) {
  const hits = [];
  text.split('\n').forEach((line, index) => {
    if (matchesSecurityBypass(line)) hits.push({ line: index + 1, rule: 'no-security-bypass' });
    if (matchesTerminalPaste(line)) hits.push({ line: index + 1, rule: 'no-terminal-paste' });
  });
  return hits;
}
