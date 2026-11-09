// Web カタログの 7 言語の辞書。英語版が正で、ほかの言語は参考訳。
import type { Category, Os } from '../domain/metadata';
import type { PluginStatus } from '../domain/status';

export const LANGS = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'pt-BR', 'es-419'] as const;
export type Lang = (typeof LANGS)[number];
export const FALLBACK_LANG: Lang = 'ja';

export const LANG_NAMES: Record<Lang, string> = {
  ja: '日本語',
  en: 'English',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ko: '한국어',
  'pt-BR': 'Português (Brasil)',
  'es-419': 'Español (Latinoamérica)',
};

// Accept-Language の言語タグを、対応する 7 言語へ対応づける。
export function matchLang(tag: string): Lang | null {
  const t = tag.trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith('ja')) return 'ja';
  if (t.startsWith('en')) return 'en';
  if (t.startsWith('ko')) return 'ko';
  if (t.startsWith('zh')) {
    if (t.includes('hant') || /^zh-(tw|hk|mo)/.test(t)) return 'zh-Hant';
    return 'zh-Hans';
  }
  if (t.startsWith('pt')) return 'pt-BR';
  if (t.startsWith('es')) return 'es-419';
  return null;
}

export function negotiate(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return FALLBACK_LANG;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? '1');
      return { tag: tag ?? '', q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag, q } of ranked) {
    if (q <= 0) continue;
    const lang = matchLang(tag);
    if (lang) return lang;
  }
  return FALLBACK_LANG;
}

export interface Dict {
  tagline: string;
  notice: string;
  noticeShort: string;
  searchHeading: string;
  searchPlaceholder: string;
  searchButton: string;
  osLabel: string;
  osAll: string;
  categoryLabel: string;
  categoryAll: string;
  latest: string;
  resultsFor: (q: string, n: number) => string;
  results: (n: number) => string;
  noResults: string;
  prev: string;
  next: string;
  summaryOriginal: string;
  updated: string;
  status: Record<PluginStatus, string>;
  categories: Record<Category, string>;
  os: Record<Os, string>;
  library: string;
  author: string;
  license: string;
  supportedOs: string;
  supportedObs: string;
  unknown: string;
  version: string;
  commit: string;
  source: string;
  releases: string;
  repository: string;
  releaseList: string;
  download: string;
  filesAndChecks: string;
  file: string;
  size: string;
  checks: string;
  check: Record<'clean' | 'suspicious' | 'malicious' | 'not_found' | 'pending' | 'error', string>;
  malwarebazaarNotFound: string;
  noDetectionNotSafe: string;
  newerUnderCheck: (newer: string, listed: string) => string;
  cautions: string;
  cautionItems: string[];
  reportPlugin: string;
  pendingDetail: string;
  suspendedDetail: string;
  removedDetail: string;
  reasonLabel: string;
  sideAgentTitle: string;
  sideAgentBody: string;
  sideAgentExample: string;
  sideAgentLink: string;
  sideListingTitle: string;
  sideListingItems: string[];
  sidePolicy: string;
  sideReport: string;
  sideStatsTitle: string;
  sideStatsListed: (n: number) => string;
  sideStatsSynced: string;
  sameAuthor: string;
  sameCategory: string;
  nav: { about: string; security: string; report: string; privacy: string; source: string };
  translationNote: string;
  englishVersion: string;
  languageLabel: string;
  notFound: string;
}

const en: Dict = {
  tagline: 'A warehouse of plugins for OBS Studio',
  notice:
    'This platform is an unofficial, free service not affiliated with the OBS Project, and it does not guarantee the safety of any plugin, so use plugins carefully and at your own risk. Files are downloaded directly from GitHub.',
  noticeShort: 'This platform is unofficial and does not guarantee the safety of any plugin, so use plugins carefully.',
  searchHeading: 'Find plugins for OBS Studio',
  searchPlaceholder: 'Keyword (e.g. pitch shift)',
  searchButton: 'Search',
  osLabel: 'OS',
  osAll: 'All',
  categoryLabel: 'Category',
  categoryAll: 'All',
  latest: 'New and updated',
  resultsFor: (q, n) => `Results for "${q}": ${n}`,
  results: (n) => `${n} plugins`,
  noResults: 'No plugins match. Try a different keyword.',
  prev: 'Previous',
  next: 'Next',
  summaryOriginal: 'This summary is the author’s original text on GitHub.',
  updated: 'Updated',
  status: { listed: 'Listed', pending: 'Under check', suspended: 'Suspended', removed: 'Removed' },
  categories: {
    'audio-filter': 'Audio filters',
    'video-filter': 'Video filters',
    source: 'Sources',
    transition: 'Transitions',
    'dock-ui': 'Docks and UI',
    output: 'Streaming and output',
    utility: 'Utilities',
    other: 'Other',
  },
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  library: 'Library',
  author: 'Author',
  license: 'License',
  supportedOs: 'Supported OS',
  supportedObs: 'Supported OBS',
  unknown: 'Not confirmed',
  version: 'Version',
  commit: 'Commit',
  source: 'Source',
  releases: 'Releases',
  repository: 'GitHub repository',
  releaseList: 'GitHub releases',
  download: 'Download from GitHub',
  filesAndChecks: 'Files and checks',
  file: 'File',
  size: 'Size',
  checks: 'Checks',
  check: {
    clean: 'No detection',
    suspicious: 'Needs review',
    malicious: 'Detected',
    not_found: 'Not in database',
    pending: 'Waiting',
    error: 'Check failed',
  },
  malwarebazaarNotFound: 'Not a known malware sample',
  noDetectionNotSafe: 'A file with no detections is not necessarily safe, so use it carefully.',
  newerUnderCheck: (newer, listed) =>
    `Version ${newer} is under check, so ${listed} stays listed until the checks finish.`,
  cautions: 'Notes',
  cautionItems: [
    'The author published these files on GitHub, so read the author’s instructions before installing.',
    'Compare the SHA-256 of the downloaded file with the value shown here.',
  ],
  reportPlugin: 'Report this plugin',
  pendingDetail: 'This plugin is waiting for automated checks, so download it after the checks finish.',
  suspendedDetail: 'This platform has suspended this plugin, so it does not show download links.',
  removedDetail: 'This plugin is no longer public on GitHub, so it cannot be downloaded.',
  reasonLabel: 'Reason',
  sideAgentTitle: 'Use from AI agents',
  sideAgentBody:
    'Connect Claude Code or Codex over MCP to search for plugins in conversation. Authors can also submit their plugins in conversation.',
  sideAgentExample: 'Example: "Find a pitch shift plugin that works on Windows"',
  sideAgentLink: 'How to connect',
  sideListingTitle: 'About listings and checks',
  sideListingItems: [
    'Authors submit their own public GitHub repositories.',
    'This platform checks files against known malware databases.',
    'A file with no detections is not necessarily safe, so use it carefully.',
  ],
  sidePolicy: 'Listing policy',
  sideReport: 'Report',
  sideStatsTitle: 'Warehouse status',
  sideStatsListed: (n) => `${n} plugins listed`,
  sideStatsSynced: 'Last synced',
  sameAuthor: 'More from this author',
  sameCategory: 'New in this category',
  nav: {
    about: 'About and listing policy',
    security: 'Security and disclaimer',
    report: 'Report',
    privacy: 'Privacy',
    source: 'Source code on GitHub',
  },
  translationNote: 'This page is the authoritative version.',
  englishVersion: 'English version',
  languageLabel: 'Language',
  notFound: 'The page you are looking for was not found.',
};

const ja: Dict = {
  tagline: 'OBS Studio 向けプラグインの倉庫',
  notice:
    'このプラットフォームは OBS Project と無関係の非公式で無料のサービスで、各プラグインの安全性を保証しないので、個人の責任にもとづき注意して利用してください。配布物は GitHub から直接ダウンロードします。',
  noticeShort: 'このプラットフォームは非公式で、各プラグインの安全性を保証しないので、注意して利用してください。',
  searchHeading: 'OBS Studio 向けのプラグインを探す',
  searchPlaceholder: 'キーワード (例: pitch shift)',
  searchButton: '探す',
  osLabel: 'OS',
  osAll: 'すべて',
  categoryLabel: 'カテゴリ',
  categoryAll: 'すべて',
  latest: '新着・更新',
  resultsFor: (q, n) => `「${q}」の検索結果 ${n} 件`,
  results: (n) => `${n} 件`,
  noResults: '条件に合うプラグインはありません。キーワードを変えて探してください。',
  prev: '前へ',
  next: '次へ',
  summaryOriginal: 'この概要は作者が GitHub に書いた原文です。',
  updated: '更新',
  status: { listed: '掲載中', pending: '検査中', suspended: '掲載停止', removed: '掲載終了' },
  categories: {
    'audio-filter': '音声フィルター',
    'video-filter': '映像フィルター',
    source: 'ソース',
    transition: 'トランジション',
    'dock-ui': 'ドック・UI',
    output: '配信・出力',
    utility: 'ユーティリティ',
    other: 'その他',
  },
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  library: 'ライブラリ',
  author: '作者',
  license: 'ライセンス',
  supportedOs: '対応 OS',
  supportedObs: '対応 OBS',
  unknown: '確認できません',
  version: 'バージョン',
  commit: 'コミット',
  source: 'ソース',
  releases: 'リリース',
  repository: 'GitHub リポジトリ',
  releaseList: 'GitHub リリース一覧',
  download: 'GitHub からダウンロード',
  filesAndChecks: '配布物と検査',
  file: 'ファイル',
  size: 'サイズ',
  checks: '検査',
  check: {
    clean: '検出なし',
    suspicious: '要確認',
    malicious: '検出あり',
    not_found: '未登録',
    pending: '検査待ち',
    error: '検査失敗',
  },
  malwarebazaarNotFound: '既知のマルウェアに該当なし',
  noDetectionNotSafe: '検査で何も検出されなくても安全とは限らないので、注意して利用してください。',
  newerUnderCheck: (newer, listed) =>
    `新しいバージョン ${newer} は検査中なので、検査が終わるまで ${listed} を掲載します。`,
  cautions: '注意事項',
  cautionItems: [
    '配布物は作者が GitHub で公開したものなので、作者の説明を読んでから導入してください。',
    'ダウンロードしたファイルの SHA-256 をここに示した値と照合してください。',
  ],
  reportPlugin: 'このプラグインを通報する',
  pendingDetail: 'このプラグインは自動検査を待っているので、検査が終わってからダウンロードしてください。',
  suspendedDetail: 'このプラットフォームはこのプラグインの掲載を停止しているので、ダウンロードの案内を表示しません。',
  removedDetail: 'このプラグインは GitHub で公開されなくなったので、ダウンロードできません。',
  reasonLabel: '理由',
  sideAgentTitle: 'AI エージェントから使う',
  sideAgentBody:
    'Claude Code や Codex を MCP で接続すると、会話でプラグインを探せます。作者は会話でプラグインを登録することもできます。',
  sideAgentExample: '例:「Windows で動くピッチシフトのプラグインを探して」',
  sideAgentLink: '接続方法を見る',
  sideListingTitle: '掲載と検査について',
  sideListingItems: [
    '作者本人が GitHub の公開リポジトリを登録します。',
    'このプラットフォームは配布物を既知のマルウェアのデータベースと照合します。',
    '検査で何も検出されなくても安全とは限らないので、注意して利用してください。',
  ],
  sidePolicy: '掲載ポリシー',
  sideReport: '通報する',
  sideStatsTitle: '倉庫の状況',
  sideStatsListed: (n) => `掲載中 ${n} 件`,
  sideStatsSynced: '最終同期',
  sameAuthor: 'この作者のプラグイン',
  sameCategory: '同じカテゴリの新着',
  nav: {
    about: '概要と掲載ポリシー',
    security: 'セキュリティと免責',
    report: '通報',
    privacy: 'プライバシー',
    source: 'GitHub のソースコード',
  },
  translationNote: 'この翻訳は参考訳なので、正確な内容は英語版で確認してください。',
  englishVersion: '英語版',
  languageLabel: '言語',
  notFound: 'お探しのページは見つかりません。',
};

const zhHans: Dict = {
  ...en,
  tagline: 'OBS Studio 插件仓库',
  notice:
    '本平台是与 OBS Project 无关的非官方免费服务，不保证各插件的安全性，请自行承担责任并谨慎使用。文件直接从 GitHub 下载。',
  noticeShort: '本平台为非官方服务，不保证各插件的安全性，请谨慎使用。',
  searchHeading: '查找 OBS Studio 插件',
  searchPlaceholder: '关键词（例：pitch shift）',
  searchButton: '搜索',
  osAll: '全部',
  categoryLabel: '分类',
  categoryAll: '全部',
  latest: '最新与更新',
  resultsFor: (q, n) => `“${q}”的搜索结果：${n} 个`,
  results: (n) => `${n} 个插件`,
  noResults: '没有符合条件的插件。请换个关键词搜索。',
  prev: '上一页',
  next: '下一页',
  summaryOriginal: '此简介是作者在 GitHub 上撰写的原文。',
  updated: '更新',
  status: { listed: '已收录', pending: '检查中', suspended: '已暂停', removed: '已下架' },
  categories: {
    'audio-filter': '音频滤镜',
    'video-filter': '视频滤镜',
    source: '来源',
    transition: '转场',
    'dock-ui': '停靠窗口与界面',
    output: '直播与输出',
    utility: '实用工具',
    other: '其他',
  },
  library: '插件库',
  author: '作者',
  license: '许可证',
  supportedOs: '支持的系统',
  supportedObs: '支持的 OBS',
  unknown: '未确认',
  version: '版本',
  commit: '提交',
  source: '源代码',
  releases: '发布',
  repository: 'GitHub 仓库',
  releaseList: 'GitHub 发布列表',
  download: '从 GitHub 下载',
  filesAndChecks: '文件与检查',
  file: '文件',
  size: '大小',
  checks: '检查',
  check: {
    clean: '未检出',
    suspicious: '需确认',
    malicious: '已检出',
    not_found: '未收录',
    pending: '等待检查',
    error: '检查失败',
  },
  malwarebazaarNotFound: '不属于已知恶意软件',
  noDetectionNotSafe: '即使检查未检出任何问题，文件也不一定安全，请谨慎使用。',
  newerUnderCheck: (newer, listed) => `新版本 ${newer} 正在检查中，检查完成前将继续收录 ${listed}。`,
  cautions: '注意事项',
  cautionItems: [
    '文件由作者在 GitHub 上发布，请阅读作者的说明后再安装。',
    '请将下载文件的 SHA-256 与此处显示的值进行比对。',
  ],
  reportPlugin: '举报此插件',
  pendingDetail: '此插件正在等待自动检查，请在检查完成后再下载。',
  suspendedDetail: '本平台已暂停收录此插件，因此不显示下载链接。',
  removedDetail: '此插件已不在 GitHub 上公开，因此无法下载。',
  reasonLabel: '原因',
  sideAgentTitle: '通过 AI 代理使用',
  sideAgentBody: '通过 MCP 连接 Claude Code 或 Codex，即可在对话中查找插件。作者也可以在对话中提交插件。',
  sideAgentExample: '例：“帮我找一个能在 Windows 上使用的变调插件”',
  sideAgentLink: '查看连接方法',
  sideListingTitle: '关于收录与检查',
  sideListingItems: [
    '由作者本人提交 GitHub 公开仓库。',
    '本平台会将文件与已知恶意软件数据库进行比对。',
    '即使检查未检出任何问题，文件也不一定安全，请谨慎使用。',
  ],
  sidePolicy: '收录政策',
  sideReport: '举报',
  sideStatsTitle: '仓库状态',
  sideStatsListed: (n) => `已收录 ${n} 个`,
  sideStatsSynced: '最后同步',
  sameAuthor: '该作者的其他插件',
  sameCategory: '同分类的新插件',
  nav: {
    about: '简介与收录政策',
    security: '安全与免责声明',
    report: '举报',
    privacy: '隐私',
    source: 'GitHub 上的源代码',
  },
  translationNote: '本翻译仅供参考，准确内容请以英文版为准。',
  englishVersion: '英文版',
  languageLabel: '语言',
  notFound: '找不到您要查找的页面。',
};

const zhHant: Dict = {
  ...zhHans,
  tagline: 'OBS Studio 外掛倉庫',
  notice:
    '本平台是與 OBS Project 無關的非官方免費服務，不保證各外掛的安全性，請自行承擔責任並謹慎使用。檔案直接從 GitHub 下載。',
  noticeShort: '本平台為非官方服務，不保證各外掛的安全性，請謹慎使用。',
  searchHeading: '尋找 OBS Studio 外掛',
  searchPlaceholder: '關鍵字（例：pitch shift）',
  searchButton: '搜尋',
  categoryLabel: '分類',
  latest: '最新與更新',
  resultsFor: (q, n) => `「${q}」的搜尋結果：${n} 個`,
  results: (n) => `${n} 個外掛`,
  noResults: '沒有符合條件的外掛。請換個關鍵字搜尋。',
  prev: '上一頁',
  next: '下一頁',
  summaryOriginal: '此簡介是作者在 GitHub 上撰寫的原文。',
  status: { listed: '已收錄', pending: '檢查中', suspended: '已暫停', removed: '已下架' },
  categories: {
    'audio-filter': '音訊濾鏡',
    'video-filter': '視訊濾鏡',
    source: '來源',
    transition: '轉場',
    'dock-ui': '停駐視窗與介面',
    output: '直播與輸出',
    utility: '實用工具',
    other: '其他',
  },
  library: '外掛庫',
  license: '授權',
  supportedOs: '支援的系統',
  supportedObs: '支援的 OBS',
  unknown: '未確認',
  version: '版本',
  commit: '提交',
  source: '原始碼',
  releases: '發行',
  repository: 'GitHub 儲存庫',
  releaseList: 'GitHub 發行列表',
  download: '從 GitHub 下載',
  filesAndChecks: '檔案與檢查',
  file: '檔案',
  checks: '檢查',
  check: {
    clean: '未檢出',
    suspicious: '需確認',
    malicious: '已檢出',
    not_found: '未收錄',
    pending: '等待檢查',
    error: '檢查失敗',
  },
  malwarebazaarNotFound: '不屬於已知惡意軟體',
  noDetectionNotSafe: '即使檢查未檢出任何問題，檔案也不一定安全，請謹慎使用。',
  newerUnderCheck: (newer, listed) => `新版本 ${newer} 正在檢查中，檢查完成前將繼續收錄 ${listed}。`,
  cautions: '注意事項',
  cautionItems: [
    '檔案由作者在 GitHub 上發布，請閱讀作者的說明後再安裝。',
    '請將下載檔案的 SHA-256 與此處顯示的值進行比對。',
  ],
  reportPlugin: '檢舉此外掛',
  pendingDetail: '此外掛正在等待自動檢查，請在檢查完成後再下載。',
  suspendedDetail: '本平台已暫停收錄此外掛，因此不顯示下載連結。',
  removedDetail: '此外掛已不在 GitHub 上公開，因此無法下載。',
  reasonLabel: '原因',
  sideAgentTitle: '透過 AI 代理使用',
  sideAgentBody: '透過 MCP 連接 Claude Code 或 Codex，即可在對話中尋找外掛。作者也可以在對話中提交外掛。',
  sideAgentExample: '例：「幫我找一個能在 Windows 上使用的變調外掛」',
  sideAgentLink: '查看連接方法',
  sideListingTitle: '關於收錄與檢查',
  sideListingItems: [
    '由作者本人提交 GitHub 公開儲存庫。',
    '本平台會將檔案與已知惡意軟體資料庫進行比對。',
    '即使檢查未檢出任何問題，檔案也不一定安全，請謹慎使用。',
  ],
  sidePolicy: '收錄政策',
  sideReport: '檢舉',
  sideStatsTitle: '倉庫狀態',
  sideStatsListed: (n) => `已收錄 ${n} 個`,
  sideStatsSynced: '最後同步',
  sameAuthor: '此作者的其他外掛',
  sameCategory: '同分類的新外掛',
  nav: {
    about: '簡介與收錄政策',
    security: '安全與免責聲明',
    report: '檢舉',
    privacy: '隱私',
    source: 'GitHub 上的原始碼',
  },
  translationNote: '本翻譯僅供參考，正確內容請以英文版為準。',
  englishVersion: '英文版',
  languageLabel: '語言',
  notFound: '找不到您要尋找的頁面。',
};

const ko: Dict = {
  ...en,
  tagline: 'OBS Studio 플러그인 창고',
  notice:
    '이 플랫폼은 OBS Project와 관계없는 비공식 무료 서비스이며 각 플러그인의 안전성을 보장하지 않으므로, 본인의 책임하에 주의해서 이용해 주세요. 배포 파일은 GitHub에서 직접 다운로드합니다.',
  noticeShort: '이 플랫폼은 비공식이며 각 플러그인의 안전성을 보장하지 않으므로 주의해서 이용해 주세요.',
  searchHeading: 'OBS Studio 플러그인 찾기',
  searchPlaceholder: '키워드 (예: pitch shift)',
  searchButton: '검색',
  osAll: '전체',
  categoryLabel: '카테고리',
  categoryAll: '전체',
  latest: '신규·업데이트',
  resultsFor: (q, n) => `"${q}" 검색 결과 ${n}개`,
  results: (n) => `플러그인 ${n}개`,
  noResults: '조건에 맞는 플러그인이 없습니다. 다른 키워드로 찾아 주세요.',
  prev: '이전',
  next: '다음',
  summaryOriginal: '이 개요는 작성자가 GitHub에 쓴 원문입니다.',
  updated: '업데이트',
  status: { listed: '게재 중', pending: '검사 중', suspended: '게재 중지', removed: '게재 종료' },
  categories: {
    'audio-filter': '오디오 필터',
    'video-filter': '비디오 필터',
    source: '소스',
    transition: '전환 효과',
    'dock-ui': '도크·UI',
    output: '방송·출력',
    utility: '유틸리티',
    other: '기타',
  },
  library: '라이브러리',
  author: '작성자',
  license: '라이선스',
  supportedOs: '지원 OS',
  supportedObs: '지원 OBS',
  unknown: '확인할 수 없음',
  version: '버전',
  commit: '커밋',
  source: '소스 코드',
  releases: '릴리스',
  repository: 'GitHub 저장소',
  releaseList: 'GitHub 릴리스 목록',
  download: 'GitHub에서 다운로드',
  filesAndChecks: '배포 파일과 검사',
  file: '파일',
  size: '크기',
  checks: '검사',
  check: {
    clean: '검출 없음',
    suspicious: '확인 필요',
    malicious: '검출됨',
    not_found: '미등록',
    pending: '검사 대기',
    error: '검사 실패',
  },
  malwarebazaarNotFound: '알려진 악성코드에 해당 없음',
  noDetectionNotSafe: '검사에서 아무것도 검출되지 않아도 안전하다고 단정할 수 없으므로 주의해서 이용해 주세요.',
  newerUnderCheck: (newer, listed) =>
    `새 버전 ${newer}은(는) 검사 중이므로, 검사가 끝날 때까지 ${listed}을(를) 게재합니다.`,
  cautions: '주의 사항',
  cautionItems: [
    '배포 파일은 작성자가 GitHub에 공개한 것이므로, 작성자의 설명을 읽은 뒤에 설치해 주세요.',
    '다운로드한 파일의 SHA-256을 여기 표시된 값과 비교해 주세요.',
  ],
  reportPlugin: '이 플러그인 신고하기',
  pendingDetail: '이 플러그인은 자동 검사를 기다리고 있으므로, 검사가 끝난 뒤에 다운로드해 주세요.',
  suspendedDetail: '이 플랫폼은 이 플러그인의 게재를 중지했으므로 다운로드 안내를 표시하지 않습니다.',
  removedDetail: '이 플러그인은 더 이상 GitHub에 공개되어 있지 않으므로 다운로드할 수 없습니다.',
  reasonLabel: '이유',
  sideAgentTitle: 'AI 에이전트에서 사용하기',
  sideAgentBody:
    'Claude Code나 Codex를 MCP로 연결하면 대화로 플러그인을 찾을 수 있습니다. 작성자는 대화로 플러그인을 등록할 수도 있습니다.',
  sideAgentExample: '예: "Windows에서 동작하는 피치 시프트 플러그인을 찾아 줘"',
  sideAgentLink: '연결 방법 보기',
  sideListingTitle: '게재와 검사에 대하여',
  sideListingItems: [
    '작성자 본인이 GitHub 공개 저장소를 등록합니다.',
    '이 플랫폼은 배포 파일을 알려진 악성코드 데이터베이스와 대조합니다.',
    '검사에서 아무것도 검출되지 않아도 안전하다고 단정할 수 없으므로 주의해서 이용해 주세요.',
  ],
  sidePolicy: '게재 정책',
  sideReport: '신고하기',
  sideStatsTitle: '창고 현황',
  sideStatsListed: (n) => `게재 중 ${n}개`,
  sideStatsSynced: '마지막 동기화',
  sameAuthor: '이 작성자의 플러그인',
  sameCategory: '같은 카테고리의 신규',
  nav: {
    about: '개요와 게재 정책',
    security: '보안과 면책',
    report: '신고',
    privacy: '개인정보',
    source: 'GitHub의 소스 코드',
  },
  translationNote: '이 번역은 참고용이므로, 정확한 내용은 영어판에서 확인해 주세요.',
  englishVersion: '영어판',
  languageLabel: '언어',
  notFound: '찾으시는 페이지가 없습니다.',
};

const ptBR: Dict = {
  ...en,
  tagline: 'Um depósito de plugins para o OBS Studio',
  notice:
    'Esta plataforma é um serviço gratuito e não oficial, sem vínculo com o OBS Project, e não garante a segurança de nenhum plugin; por isso, use os plugins com cuidado e por sua conta e risco. Os arquivos são baixados diretamente do GitHub.',
  noticeShort: 'Esta plataforma não é oficial e não garante a segurança dos plugins; por isso, use-os com cuidado.',
  searchHeading: 'Encontre plugins para o OBS Studio',
  searchPlaceholder: 'Palavra-chave (ex.: pitch shift)',
  searchButton: 'Buscar',
  osAll: 'Todos',
  categoryLabel: 'Categoria',
  categoryAll: 'Todas',
  latest: 'Novos e atualizados',
  resultsFor: (q, n) => `Resultados para "${q}": ${n}`,
  results: (n) => `${n} plugins`,
  noResults: 'Nenhum plugin corresponde. Tente outra palavra-chave.',
  prev: 'Anterior',
  next: 'Próxima',
  summaryOriginal: 'Este resumo é o texto original do autor no GitHub.',
  updated: 'Atualizado',
  status: { listed: 'Listado', pending: 'Em verificação', suspended: 'Suspenso', removed: 'Removido' },
  categories: {
    'audio-filter': 'Filtros de áudio',
    'video-filter': 'Filtros de vídeo',
    source: 'Fontes',
    transition: 'Transições',
    'dock-ui': 'Docks e interface',
    output: 'Transmissão e saída',
    utility: 'Utilitários',
    other: 'Outros',
  },
  library: 'Biblioteca',
  author: 'Autor',
  license: 'Licença',
  supportedOs: 'Sistemas suportados',
  supportedObs: 'OBS suportado',
  unknown: 'Não confirmado',
  version: 'Versão',
  source: 'Código-fonte',
  releases: 'Versões',
  repository: 'Repositório no GitHub',
  releaseList: 'Versões no GitHub',
  download: 'Baixar do GitHub',
  filesAndChecks: 'Arquivos e verificações',
  file: 'Arquivo',
  size: 'Tamanho',
  checks: 'Verificações',
  check: {
    clean: 'Nada detectado',
    suspicious: 'Requer revisão',
    malicious: 'Detectado',
    not_found: 'Fora da base',
    pending: 'Aguardando',
    error: 'Falha na verificação',
  },
  malwarebazaarNotFound: 'Não é uma amostra de malware conhecida',
  noDetectionNotSafe: 'Um arquivo sem detecções não é necessariamente seguro; por isso, use-o com cuidado.',
  newerUnderCheck: (newer, listed) =>
    `A versão ${newer} está em verificação; por isso, ${listed} continua listada até a verificação terminar.`,
  cautions: 'Observações',
  cautionItems: [
    'O autor publicou estes arquivos no GitHub; por isso, leia as instruções do autor antes de instalar.',
    'Compare o SHA-256 do arquivo baixado com o valor mostrado aqui.',
  ],
  reportPlugin: 'Denunciar este plugin',
  pendingDetail: 'Este plugin aguarda as verificações automáticas; por isso, baixe-o depois que elas terminarem.',
  suspendedDetail: 'Esta plataforma suspendeu este plugin e, por isso, não mostra links de download.',
  removedDetail: 'Este plugin não está mais público no GitHub e, por isso, não pode ser baixado.',
  reasonLabel: 'Motivo',
  sideAgentTitle: 'Use com agentes de IA',
  sideAgentBody:
    'Conecte o Claude Code ou o Codex via MCP para buscar plugins conversando. Os autores também podem enviar seus plugins conversando.',
  sideAgentExample: 'Exemplo: "Encontre um plugin de pitch shift que funcione no Windows"',
  sideAgentLink: 'Como conectar',
  sideListingTitle: 'Sobre listagens e verificações',
  sideListingItems: [
    'Os próprios autores enviam seus repositórios públicos do GitHub.',
    'Esta plataforma compara os arquivos com bases de malware conhecidas.',
    'Um arquivo sem detecções não é necessariamente seguro; por isso, use-o com cuidado.',
  ],
  sidePolicy: 'Política de listagem',
  sideReport: 'Denunciar',
  sideStatsTitle: 'Status do depósito',
  sideStatsListed: (n) => `${n} plugins listados`,
  sideStatsSynced: 'Última sincronização',
  sameAuthor: 'Mais deste autor',
  sameCategory: 'Novos nesta categoria',
  nav: {
    about: 'Sobre e política de listagem',
    security: 'Segurança e isenção',
    report: 'Denunciar',
    privacy: 'Privacidade',
    source: 'Código-fonte no GitHub',
  },
  translationNote: 'Esta tradução é apenas uma referência; por isso, confira o conteúdo exato na versão em inglês.',
  englishVersion: 'Versão em inglês',
  languageLabel: 'Idioma',
  notFound: 'A página que você procura não foi encontrada.',
};

const es419: Dict = {
  ...en,
  tagline: 'Un depósito de plugins para OBS Studio',
  notice:
    'Esta plataforma es un servicio gratuito y no oficial, sin relación con OBS Project, y no garantiza la seguridad de ningún plugin; por eso, usa los plugins con cuidado y bajo tu propia responsabilidad. Los archivos se descargan directamente de GitHub.',
  noticeShort: 'Esta plataforma no es oficial y no garantiza la seguridad de los plugins; por eso, úsalos con cuidado.',
  searchHeading: 'Encuentra plugins para OBS Studio',
  searchPlaceholder: 'Palabra clave (p. ej., pitch shift)',
  searchButton: 'Buscar',
  osAll: 'Todos',
  categoryLabel: 'Categoría',
  categoryAll: 'Todas',
  latest: 'Nuevos y actualizados',
  resultsFor: (q, n) => `Resultados para "${q}": ${n}`,
  results: (n) => `${n} plugins`,
  noResults: 'Ningún plugin coincide. Prueba con otra palabra clave.',
  prev: 'Anterior',
  next: 'Siguiente',
  summaryOriginal: 'Este resumen es el texto original del autor en GitHub.',
  updated: 'Actualizado',
  status: { listed: 'En la lista', pending: 'En revisión', suspended: 'Suspendido', removed: 'Retirado' },
  categories: {
    'audio-filter': 'Filtros de audio',
    'video-filter': 'Filtros de video',
    source: 'Fuentes',
    transition: 'Transiciones',
    'dock-ui': 'Paneles e interfaz',
    output: 'Transmisión y salida',
    utility: 'Utilidades',
    other: 'Otros',
  },
  library: 'Biblioteca',
  author: 'Autor',
  license: 'Licencia',
  supportedOs: 'Sistemas compatibles',
  supportedObs: 'OBS compatible',
  unknown: 'Sin confirmar',
  version: 'Versión',
  source: 'Código fuente',
  releases: 'Versiones',
  repository: 'Repositorio en GitHub',
  releaseList: 'Versiones en GitHub',
  download: 'Descargar de GitHub',
  filesAndChecks: 'Archivos y revisiones',
  file: 'Archivo',
  size: 'Tamaño',
  checks: 'Revisiones',
  check: {
    clean: 'Sin detecciones',
    suspicious: 'Requiere revisión',
    malicious: 'Detectado',
    not_found: 'No registrado',
    pending: 'En espera',
    error: 'Falló la revisión',
  },
  malwarebazaarNotFound: 'No es una muestra de malware conocida',
  noDetectionNotSafe: 'Un archivo sin detecciones no es necesariamente seguro; por eso, úsalo con cuidado.',
  newerUnderCheck: (newer, listed) =>
    `La versión ${newer} está en revisión; por eso, ${listed} sigue en la lista hasta que termine la revisión.`,
  cautions: 'Notas',
  cautionItems: [
    'El autor publicó estos archivos en GitHub; por eso, lee sus instrucciones antes de instalar.',
    'Compara el SHA-256 del archivo descargado con el valor que se muestra aquí.',
  ],
  reportPlugin: 'Reportar este plugin',
  pendingDetail: 'Este plugin espera las revisiones automáticas; por eso, descárgalo cuando terminen.',
  suspendedDetail: 'Esta plataforma suspendió este plugin y, por eso, no muestra enlaces de descarga.',
  removedDetail: 'Este plugin ya no es público en GitHub y, por eso, no se puede descargar.',
  reasonLabel: 'Motivo',
  sideAgentTitle: 'Úsalo con agentes de IA',
  sideAgentBody:
    'Conecta Claude Code o Codex por MCP para buscar plugins conversando. Los autores también pueden enviar sus plugins conversando.',
  sideAgentExample: 'Ejemplo: "Busca un plugin de pitch shift que funcione en Windows"',
  sideAgentLink: 'Cómo conectar',
  sideListingTitle: 'Sobre la lista y las revisiones',
  sideListingItems: [
    'Los propios autores envían sus repositorios públicos de GitHub.',
    'Esta plataforma compara los archivos con bases de malware conocidas.',
    'Un archivo sin detecciones no es necesariamente seguro; por eso, úsalo con cuidado.',
  ],
  sidePolicy: 'Política de la lista',
  sideReport: 'Reportar',
  sideStatsTitle: 'Estado del depósito',
  sideStatsListed: (n) => `${n} plugins en la lista`,
  sideStatsSynced: 'Última sincronización',
  sameAuthor: 'Más de este autor',
  sameCategory: 'Nuevos en esta categoría',
  nav: {
    about: 'Acerca de y política de la lista',
    security: 'Seguridad y descargo',
    report: 'Reportar',
    privacy: 'Privacidad',
    source: 'Código fuente en GitHub',
  },
  translationNote:
    'Esta traducción es solo de referencia; por eso, consulta el contenido exacto en la versión en inglés.',
  englishVersion: 'Versión en inglés',
  languageLabel: 'Idioma',
  notFound: 'No se encontró la página que buscas.',
};

export const DICTS: Record<Lang, Dict> = {
  ja,
  en,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  'pt-BR': ptBR,
  'es-419': es419,
};
