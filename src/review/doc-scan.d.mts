// doc-scan.mjs の型。実装は .mjs にあり、GitHub Actions の node からも読む。
import type { GuidanceRule } from './guidance-patterns.mjs';

export const MAX_DOC_HITS: number;
export const MAX_DOC_FILE_BYTES: number;
export function isDoc(path: string): boolean;
export function scanDocFiles(files: Array<{ path: string; bytes: Uint8Array }>): {
  hits: Array<{ file: string; line: number; rule: GuidanceRule; text: string }>;
  truncated: boolean;
};
