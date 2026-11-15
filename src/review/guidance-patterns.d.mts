// guidance-patterns.mjs の型。実装は .mjs にあり、GitHub Actions の node からも読む。
export type GuidanceRule = 'no-security-bypass' | 'no-terminal-paste';

export function matchesSecurityBypass(text: string): boolean;
export function matchesTerminalPaste(text: string): boolean;
export function guidanceHits(text: string): Array<{ line: number; rule: GuidanceRule }>;
