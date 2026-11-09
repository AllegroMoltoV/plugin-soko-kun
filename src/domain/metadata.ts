// GitHub の情報から、表示と検索に使う値を推定する。対応 OS は推定できなければ null、カテゴリは other にする。
export const CATEGORIES = [
  'audio-filter',
  'video-filter',
  'source',
  'transition',
  'dock-ui',
  'output',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const OS_VALUES = ['windows', 'macos', 'linux'] as const;
export type Os = (typeof OS_VALUES)[number];

export function inferOs(assetName: string): Os | null {
  const name = assetName.toLowerCase();
  if (/(^|[^a-z])(source|src)([^a-z]|$)/.test(name)) return null;
  if (/windows|win64|win32|(^|[^a-z])win([^a-z]|$)|\.exe$|\.msi$/.test(name)) return 'windows';
  if (/macos|darwin|(^|[^a-z])mac([^a-z]|$)|\.pkg$|\.dmg$/.test(name)) return 'macos';
  if (/linux|ubuntu|debian|fedora|\.deb$|\.rpm$|\.appimage$|\.flatpak$/.test(name)) return 'linux';
  return null;
}

// 先に並べた区分ほど優先する。監視や計測のように専用の画面を足すものはドック・パネルを先に判定する。
const CATEGORY_KEYWORDS: Array<[Category, RegExp]> = [
  ['transition', /transition/],
  ['dock-ui', /dock|panel|(^|[^a-z])ui([^a-z]|$)|monitor|meter|hotkey|overlay editor/],
  ['audio-filter', /audio|pitch|loudness|sound|voice|vocal|mic|compressor|limiter|reverb|equali[sz]er|noise|volume/],
  ['video-filter', /shadow|blur|shader|chroma|mask|color|colour|lut|sharpen|crop|video filter|effect/],
  ['output', /stream|output|record|rtmp|srt|ndi|multistream|encoder/],
  ['source', /source|capture|browser|camera|text|timer|clock/],
];

export function inferCategory(...texts: Array<string | null | undefined>): Category {
  const haystack = texts.filter(Boolean).join(' ').toLowerCase().replace(/[-_]/g, ' ');
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return 'other';
}

const SUMMARY_MAX = 300;

// README の最初の段落を、マークアップを除いた平文で取り出す。外部データとして扱い、表示時にエスケープする。
export function summarizeReadme(readme: string): string | null {
  const blocks = readme.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  for (const block of blocks) {
    const text = block.trim();
    if (!text) continue;
    if (/^(#|<|!\[|\[!\[|```|\||>|-{3,}|={3,})/.test(text)) continue;
    const plain = text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      // 入れ子のタグ (<scr<script>ipt>) は 1 回の置換で <script が残るため、残った山かっこも除く。
      .replace(/[<>]/g, '')
      .replace(/[`*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain.length < 10) continue;
    return plain.length > SUMMARY_MAX ? `${plain.slice(0, SUMMARY_MAX - 1)}…` : plain;
  }
  return null;
}

// libobs を参照する CMake の書き方。find_package、pkg-config のモジュールの指定、リンク先の指定を受け付ける。
export function cmakeReferencesLibobs(cmake: string): boolean {
  const text = cmake.replace(/#.*$/gm, '');
  return (
    /find_package\s*\(\s*libobs\b/i.test(text) ||
    /pkg_(check_modules|search_module)\s*\([^)]*\blibobs\b/i.test(text) ||
    /target_link_libraries\s*\([^)]*\b(OBS::libobs|libobs)\b/i.test(text)
  );
}

export function hasNativeSource(languages: Record<string, number>): boolean {
  return (languages.C ?? 0) > 0 || (languages['C++'] ?? 0) > 0;
}
