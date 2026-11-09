// サービスのロゴ (docs/design/ui.md の「サービスのロゴ」)。上部の帯とファビコンに使う。
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="配信プラグイン倉庫くん">
  <circle cx="32" cy="32" r="31" fill="#250213" stroke="#721d46" stroke-width="1"/>
  <circle cx="32" cy="32" r="27.5" fill="none" stroke="#e2c69c" stroke-width="1.5"/>
  <path d="M32 11.5 V15.5" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 18.5 H48" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M19 18.5 V34 Q19 40.5 16 43" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="rotate(-30 13.5 45)">
    <rect x="10" y="41.5" width="7.5" height="7" rx="2" fill="#e2c69c"/>
    <rect x="7" y="42.8" width="3.6" height="1.7" rx=".6" fill="#e2c69c"/>
    <rect x="7" y="45.5" width="3.6" height="1.7" rx=".6" fill="#e2c69c"/>
  </g>
  <path d="M25 24 H45 M27.5 28.5 H42.5 V40 H27.5 Z M27.5 34.25 H42.5 M24 45 H46" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M35 21 V52" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

// URL のクエリに付け、ロゴが変わったときに閲覧者のキャッシュを使わせない。
export const LOGO_VERSION = '350ab44a';
