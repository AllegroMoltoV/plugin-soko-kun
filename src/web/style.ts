// 画面のスタイル。CSP で style-src 'self' に限るため、インラインにせず /style.css から配信する。
// 2000 年代前半のソフトウェア紹介サイトの雰囲気を目指す: 中央寄せの固定幅、小さめの文字、
// グラデーションの見出し帯、下線付きのリンク、立体的なボタン、細い灰色の罫線。
export const STYLE_CSS = `
/*
  配色の規則: テーマカラーの緑 (--theme 系) と無彩色だけを使う。例外は次の 2 つで、どちらも安全に関わる表示に限る。
  - 赤 (--danger): 掲載停止と掲載終了。危険の表示を見落とさせないため。
  - 黄 (--caution): 検査中と注意書き。安全に関わる注意を、通常の情報と区別するため。
  暗い配色はブラウザの設定 (prefers-color-scheme) に従い、同じ規則を暗い背景の上で保つ。
*/
:root {
  color-scheme: light dark;
  --theme: #2f7a14;
  --theme-dark: #1f5a0a;
  --theme-light: #5a9e3a;
  --theme-pale: #eef5e8;
  --theme-line: #a9c991;
  --ink: #222;
  --muted: #666;
  --line: #b5b5b5;
  --paper: #fff;
  --page: #ebebeb;
  --danger: #b00000;
  --danger-pale: #fff0f0;
  --caution: #6b5500;
  --caution-pale: #fffbe0;
  --caution-line: #d8c46a;
  --surface: #f6f6f6;
  --surface-2: #fafafa;
  --footer: #dcdcdc;
  --button-top: #ffffff;
  --button-bottom: #d9d9d9;
  --button-light: #cccccc;
  --button-dark: #777777;
  --link: #1f5a0a;
  --link-hover: #2f7a14;
  --heading: #1f5a0a;
  --control-height: 24px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --theme: #2f6b17;
    --theme-dark: #1c4a0b;
    --theme-light: #4a8a2c;
    --theme-pale: #1f2a1a;
    --theme-line: #3f6a2c;
    --ink: #e2e2e2;
    --muted: #a8a8a8;
    --line: #4a4a4a;
    --paper: #1e1e1e;
    --page: #141414;
    --danger: #ff8a80;
    --danger-pale: #3a1c1a;
    --caution: #f0d675;
    --caution-pale: #2e2a14;
    --caution-line: #7a6a2a;
    --surface: #262626;
    --surface-2: #232323;
    --footer: #1a1a1a;
    --button-top: #4a4a4a;
    --button-bottom: #333333;
    --button-light: #666666;
    --button-dark: #222222;
    --link: #9ad27a;
    --link-hover: #b8e49c;
    --heading: #b8e49c;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: Verdana, Arial, "Hiragino Kaku Gothic ProN", "MS PGothic", "Malgun Gothic", "Microsoft YaHei", "Microsoft JhengHei", sans-serif;
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
a { color: var(--link); text-decoration: underline; }
a:visited { color: var(--link); }
a:hover { color: var(--link-hover); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 2px dotted var(--ink);
  outline-offset: 1px;
}
.skip { position: absolute; left: -999px; }
.skip:focus { left: 8px; top: 8px; background: var(--paper); padding: 4px 8px; z-index: 10; }
.wrap { max-width: 860px; margin: 0 auto; padding: 0 8px; }

header.site { background: var(--theme) linear-gradient(var(--theme-light), var(--theme)); border-bottom: 2px solid var(--theme-dark); color: #fff; }
header.site .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding-top: 8px; padding-bottom: 8px; }
/* 検索欄、検索ボタン、言語のボタンを同じ高さにし、縦の中央でそろえる。 */
header.site form { align-items: center; }
header.site input[type=search], header.site button, details.lang summary { height: var(--control-height); }
details.lang summary { display: flex; align-items: center; }
.brand { color: #fff; text-decoration: none; display: flex; flex-direction: column; margin-right: auto; min-width: 0; }
.brand:visited, .brand:hover { color: #fff; }
.brand b { font-size: 22px; letter-spacing: 1px; text-shadow: 1px 1px 0 var(--theme-dark); }
.brand small { font-size: 11px; }
header.site search { display: block; min-width: 0; max-width: 100%; }
header.site form { display: flex; flex-wrap: nowrap; gap: 3px; min-width: 0; }
header.site input[type=search] { width: 14rem; min-width: 0; flex: 0 1 14rem; padding: 0 4px; border: 1px solid var(--theme-dark); font-size: 12px; background: var(--paper); color: var(--ink); }
button {
  flex: none;
  font-family: inherit;
  font-size: 12px;
  padding: 2px 10px;
  color: var(--ink);
  background: var(--button-bottom) linear-gradient(var(--button-top), var(--button-bottom));
  border: 1px solid;
  border-color: var(--button-light) var(--button-dark) var(--button-dark) var(--button-light);
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.icon-button { display: inline-flex; align-items: center; justify-content: center; padding: 2px 8px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
button:active { border-color: var(--button-dark) var(--button-light) var(--button-light) var(--button-dark); background: var(--button-bottom); }
details.lang { position: relative; flex: none; }
details.lang summary { cursor: pointer; list-style: none; padding: 0 8px; font-size: 12px; color: #fff; border: 1px solid var(--theme-line); background: var(--theme-dark); }
details.lang summary::-webkit-details-marker { display: none; }
details.lang ul { position: absolute; right: 0; top: 1.9rem; margin: 0; padding: 2px 0; list-style: none; background: var(--paper); border: 1px solid var(--line); min-width: 13rem; z-index: 5; }
details.lang li a { display: block; padding: 3px 10px; }
details.lang li a[aria-current] { font-weight: bold; background: var(--theme-pale); }

nav.cats { background: var(--paper); border-bottom: 1px solid var(--line); }
nav.cats ul { display: flex; flex-wrap: wrap; margin: 0 auto; padding: 0 8px; list-style: none; max-width: 860px; }
nav.cats li { display: flex; align-items: center; }
nav.cats li + li::before { content: "|"; color: var(--line); padding: 0 2px; }
nav.cats a { display: block; padding: 4px 6px; white-space: nowrap; font-size: 12px; font-weight: bold; text-decoration: none; }
nav.cats a:hover { text-decoration: underline; }
nav.cats a[aria-current] { color: var(--ink); background: var(--theme-pale); }

.notice { background: var(--caution-pale); border-bottom: 1px solid var(--caution-line); }
.notice p { margin: 0 auto; padding: 4px 8px; font-size: 11px; color: var(--caution); }
.notice .short { display: none; }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 10px; padding-top: 10px; padding-bottom: 20px; }
main { min-width: 0; background: var(--paper); border: 1px solid var(--line); padding: 10px 12px; }
.side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.side section { background: var(--paper); border: 1px solid var(--line); }
.side h2 { margin: 0; padding: 3px 8px; font-size: 12px; color: #fff; background: var(--theme) linear-gradient(var(--theme-light), var(--theme)); }
.side section > *:not(h2) { margin: 6px 8px; }
.side ul { padding-left: 1.3em; }
.side li { margin: 2px 0; }
.side .example { color: var(--muted); font-size: 12px; }

h1 { font-size: 17px; margin: 0 0 6px; line-height: 1.35; color: var(--heading); }
h2.bar { font-size: 13px; margin: 14px 0 6px; padding: 3px 8px; color: var(--heading); background: var(--theme-pale); border: 1px solid var(--theme-line); border-left: 5px solid var(--theme); }
.tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 0; margin: 4px 0; list-style: none; }
.tag { display: inline-block; padding: 0 6px; font-size: 11px; text-decoration: none; color: #fff; background: var(--theme); border: 1px solid var(--theme-dark); }
.tag:visited, .tag:hover { color: #fff; }
.pill { display: inline-block; padding: 0 5px; border: 1px solid var(--line); background: var(--surface); font-size: 11px; color: var(--ink); }
.status { display: inline-block; padding: 0 5px; font-size: 11px; font-weight: bold; border: 1px solid; }
.status.listed { color: var(--heading); border-color: var(--theme-line); background: var(--theme-pale); }
.status.pending { color: var(--caution); border-color: var(--caution-line); background: var(--caution-pale); }
.status.suspended, .status.removed { color: var(--danger); border-color: var(--danger); background: var(--danger-pale); }

form.search { margin: 6px 0; padding: 8px; background: var(--surface); border: 1px solid var(--line); }
form.search .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 3px 0; }
form.search .row:first-of-type { flex-wrap: nowrap; }
form.search input[type=search] { flex: 1 1 auto; width: 0; min-width: 0; height: var(--control-height); padding: 0 4px; font-size: 13px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); }
form.search button { height: var(--control-height); }
form.search select { font-size: 12px; max-width: 100%; background: var(--paper); color: var(--ink); border: 1px solid var(--line); }

ol.cards { list-style: none; margin: 0; padding: 0; }
ol.cards li { border-bottom: 1px dotted var(--line); padding: 8px 2px; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
.card-head a { font-size: 14px; font-weight: bold; min-width: 0; }
.card-head .ver { margin-left: auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
.summary { margin: 3px 0; }
.meta { color: var(--muted); font-size: 11px; margin: 2px 0; }
.pager { display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; }

.download { margin: 12px 0; padding: 10px; text-align: center; background: var(--theme-pale); border: 1px solid var(--theme-line); }
.download a.button { display: inline-block; padding: 6px 22px; font-size: 14px; font-weight: bold; color: #fff; text-decoration: none; background: var(--theme) linear-gradient(var(--theme-light), var(--theme)); border: 1px solid var(--theme-dark); border-radius: 3px; }
.download a.button:visited, .download a.button:hover { color: #fff; }
.download p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
table.info { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
table.info th, table.info td { border: 1px solid var(--line); padding: 3px 6px; text-align: left; vertical-align: top; }
table.info th { width: 8.5rem; background: var(--theme-pale); font-weight: normal; }
.files { list-style: none; padding: 0; margin: 0; }
.files > li { border: 1px solid var(--line); background: var(--surface-2); padding: 6px 8px; margin-bottom: 6px; }
.files .name { font-weight: bold; }
.hash { font-family: "Courier New", monospace; font-size: 11px; color: var(--muted); }
.checks { margin: 4px 0 0; padding-left: 1.3em; font-size: 12px; }
.callout { border: 1px solid var(--caution-line); background: var(--caution-pale); color: var(--caution); padding: 6px 8px; margin: 8px 0; font-size: 12px; }
.untrusted-note { color: var(--muted); font-size: 11px; margin: 0 0 6px; }
.breadcrumb { font-size: 11px; color: var(--muted); margin: 0 0 4px; }

footer.site { background: var(--footer); border-top: 1px solid var(--line); }
footer.site ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 14px; list-style: none; margin: 0; padding: 8px 0 4px; font-size: 12px; }
footer.site p { margin: 0; padding: 0 8px 10px; color: var(--muted); font-size: 11px; text-align: center; }
footer.site p.copyright { padding-bottom: 12px; }
.side ul.latest { list-style: none; padding-left: 0; }
.side ul.latest li { margin: 4px 0; }
.side ul.latest .meta { display: block; margin: 0; }

@media (max-width: 760px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .notice .long { display: none; }
  .notice .short { display: inline; }
  header.site search { flex: 1 1 100%; }
  header.site input[type=search] { flex: 1 1 auto; width: 0; }
  details.lang[open] { flex: 1 1 100%; }
  details.lang ul { position: static; min-width: 0; margin-top: 4px; }
  table.info th { width: 6.5rem; }
}
`;

// CSS を更新したときにブラウザのキャッシュを使い続けないよう、内容から作った版を URL に付ける。
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export const STYLE_VERSION = fnv1a(STYLE_CSS);
