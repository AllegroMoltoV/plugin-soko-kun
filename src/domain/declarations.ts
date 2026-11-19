// 宣言ファイル (.soko-kun/config.json) の申告の4項目 (ADR 0018)。音のプラグイン倉庫くんと同じ形にする。
// 申告は作者によるもので、運営者は確かめない。値は版ごとに release_checks.declarations に保存し、掲載中の版の値を表示する。

export interface Declarations {
  // 作者への支払いで解放する機能がある。
  paidFeatures: boolean | null;
  // 利用者が別に契約する有料サービスの名前。[] は「無い」と申告した値。
  paidServices: string[] | null;
  // 同梱の素材に、商用不可などの利用の制限がある。
  restrictedAssets: boolean | null;
  // 作者の支援・購入のページ。
  supportUrl: string | null;
}

// 項目の誤り。誤った項目は申告なし (null) として扱い、掲載は止めない。作者の文字列は含めない。
export type DeclarationNotice =
  | 'paid_features_invalid'
  | 'paid_services_invalid'
  | 'restricted_assets_invalid'
  | 'support_url_invalid';

export interface StoredDeclarations extends Declarations {
  notices: DeclarationNotice[];
}

// 宣言ファイルの書き方。確認のモードと list_my_plugins の直し方で同じ文を返す。
export const CONFIG_FIX =
  'Write {"name": "<display name, 1-60 characters>", "os": ["windows" | "macos" | "linux"], "paidFeatures": <true if some features are unlocked by paying you>, "paidServices": ["<paid service the user must subscribe to, up to 5>"], "restrictedAssets": <true if bundled models, sounds, fonts, or images restrict commercial use>, "supportUrl": "<https URL of your support or store page on booth.pm, gumroad.com, itch.io, patreon.com, ko-fi.com, or github.com/sponsors>"}. All fields are optional. An invalid name or os stops the listing. An invalid value of the other fields is ignored and reported as a notice. Commit the file before you tag the release, because the catalog reads it at the release tag. Adding supportUrl or other external links after the plugin is listed holds the new version for an administrator review, so write them in the first release.';

// 注意の文。固定の文言だけを返し、作者の文字列を含めない。
export const NOTICE_TEXT: Record<DeclarationNotice | 'declarations_missing', string> = {
  paid_features_invalid: 'paidFeatures in .soko-kun/config.json is not true or false, so it was ignored.',
  paid_services_invalid:
    'paidServices in .soko-kun/config.json is not a list of up to 5 names of 1-60 characters, so it was ignored.',
  restricted_assets_invalid: 'restrictedAssets in .soko-kun/config.json is not true or false, so it was ignored.',
  support_url_invalid: 'supportUrl in .soko-kun/config.json is not an https URL on an allowed host, so it was ignored.',
  declarations_missing:
    'The listed version declares none of paidFeatures, paidServices, restrictedAssets, and supportUrl, so users see "not declared by the author". Declare them in .soko-kun/config.json and publish a new version. Adding supportUrl after listing holds the new version for an administrator review.',
};

export function noticeView(code: DeclarationNotice | 'declarations_missing') {
  return { code, message: NOTICE_TEXT[code], fix: CONFIG_FIX };
}

const MAX_SERVICES = 5;
const MAX_SERVICE_CHARS = 60;
const MAX_URL_CHARS = 300;

// supportUrl で受け付ける宛先。ホストの完全一致か、「.宛先」で終わるサブドメイン。
const SUPPORT_HOSTS = ['booth.pm', 'gumroad.com', 'itch.io', 'patreon.com', 'ko-fi.com'];

export const EMPTY_DECLARATIONS: StoredDeclarations = {
  paidFeatures: null,
  paidServices: null,
  restrictedAssets: null,
  supportUrl: null,
  notices: [],
};

export function isAllowedSupportUrl(value: string): boolean {
  if (value.length > MAX_URL_CHARS) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return false;
  const host = url.hostname.toLowerCase();
  if (SUPPORT_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return true;
  // github.com は GitHub Sponsors のページだけを受け付け、サブドメインと別のパスは受け付けない。
  return host === 'github.com' && /^\/sponsors\/[A-Za-z0-9-]+\/?$/.test(url.pathname);
}

// 宣言ファイルの本体 (JSON のオブジェクト) から4項目を読む。項目が無ければ null、誤りなら null と注意にする。
export function parseDeclarations(body: Record<string, unknown>): StoredDeclarations {
  const result: StoredDeclarations = { ...EMPTY_DECLARATIONS, notices: [] };
  const { paidFeatures, paidServices, restrictedAssets, supportUrl } = body;
  if (paidFeatures !== undefined) {
    if (typeof paidFeatures === 'boolean') result.paidFeatures = paidFeatures;
    else result.notices.push('paid_features_invalid');
  }
  if (paidServices !== undefined) {
    const valid =
      Array.isArray(paidServices) &&
      paidServices.length <= MAX_SERVICES &&
      paidServices.every(
        (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_SERVICE_CHARS,
      );
    if (valid) result.paidServices = [...new Set((paidServices as string[]).map((value) => value.trim()))];
    else result.notices.push('paid_services_invalid');
  }
  if (restrictedAssets !== undefined) {
    if (typeof restrictedAssets === 'boolean') result.restrictedAssets = restrictedAssets;
    else result.notices.push('restricted_assets_invalid');
  }
  if (supportUrl !== undefined) {
    if (typeof supportUrl === 'string' && isAllowedSupportUrl(supportUrl)) result.supportUrl = supportUrl;
    else result.notices.push('support_url_invalid');
  }
  return result;
}

// 保存した JSON を読む。この仕組みより前の版や、宣言ファイルの無い版は null。
export function readDeclarations(json: string | null): StoredDeclarations | null {
  if (!json) return null;
  try {
    const body = JSON.parse(json) as Partial<StoredDeclarations>;
    return {
      paidFeatures: typeof body.paidFeatures === 'boolean' ? body.paidFeatures : null,
      paidServices: Array.isArray(body.paidServices) ? body.paidServices.filter((v) => typeof v === 'string') : null,
      restrictedAssets: typeof body.restrictedAssets === 'boolean' ? body.restrictedAssets : null,
      supportUrl: typeof body.supportUrl === 'string' && isAllowedSupportUrl(body.supportUrl) ? body.supportUrl : null,
      notices: Array.isArray(body.notices) ? (body.notices as DeclarationNotice[]) : [],
    };
  } catch {
    return null;
  }
}

export function hasAnyDeclaration(declarations: Declarations | null): boolean {
  if (!declarations) return false;
  return (
    declarations.paidFeatures !== null ||
    declarations.paidServices !== null ||
    declarations.restrictedAssets !== null ||
    declarations.supportUrl !== null
  );
}

// 絞り込み excludePaid と excludeRestrictedAssets の判定。申告なし (null) のものは除かない。
export function isPaid(declarations: Declarations | null): boolean {
  if (!declarations) return false;
  return declarations.paidFeatures === true || (declarations.paidServices?.length ?? 0) > 0;
}

export function hasRestrictedAssets(declarations: Declarations | null): boolean {
  return declarations?.restrictedAssets === true;
}
