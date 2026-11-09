// 画面のスタイル。CSP で style-src 'self' に限るため、インラインにせず /style.css から配信する。
// 2000 年代前半のソフトウェア紹介サイトの雰囲気を目指す: 中央寄せの固定幅、小さめの文字、
// グラデーションの見出し帯、下線付きのリンク、立体的なボタン、細い灰色の罫線。
export const STYLE_CSS = `
/*
  配色の規則 (docs/design/ui.md): テーマカラーは主の色 #250213 と副の色 #e2c69c の 2 つで、ほかは無彩色。
  注意の表示は副の色の淡い背景に太い枠線と「注意」の見出しで区別する。
  例外の色は赤 (--danger) だけで、掲載停止と掲載終了に使う。危険の表示を見落とさせないため。
  暗い配色はブラウザの設定 (prefers-color-scheme) に従い、テーマカラーを背景に使う場所を減らして文字を明るくする。
  文字と背景の組み合わせは、どちらの配色でもコントラスト比 4.5 以上を計算で確かめている。
*/
:root {
  color-scheme: light dark;
  --primary: #250213;
  --primary-light: #4e0428;
  --primary-dark: #13010a;
  --sub: #e2c69c;
  --sub-pale: #f7efe3;
  --sub-dark: #a2742f;
  --on-primary: #ffffff;
  --heading: #250213;
  --bar-bg: #e2c69c;
  --bar-text: #250213;
  --caution-text: #674a1e;
  --ink: #222222;
  --muted: #666666;
  --line: #b5b5b5;
  --paper: #ffffff;
  --page: #ebebeb;
  --surface: #f6f6f6;
  --surface-2: #fafafa;
  --footer: #dcdcdc;
  --danger: #b00000;
  --danger-pale: #fff0f0;
  --button-top: #ffffff;
  --button-bottom: #d9d9d9;
  --button-light: #cccccc;
  --button-dark: #777777;
  --link: #8b1850;
  --link-hover: #250213;
  --control-height: 24px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --primary-light: #721d46;
    --primary: #4e0e2d;
    --primary-dark: #2b0819;
    --sub-pale: #362e21;
    --sub-dark: #a2742f;
    --heading: #f2cadd;
    --bar-bg: #362e21;
    --bar-text: #e2c69c;
    --caution-text: #e2c69c;
    --ink: #e6e6e6;
    --muted: #a8a8a8;
    --line: #4a4a4a;
    --paper: #1c1c1f;
    --page: #121212;
    --surface: #26262a;
    --surface-2: #222226;
    --footer: #18181b;
    --danger: #ff8a80;
    --danger-pale: #3a1c1a;
    --button-top: #4a4a4a;
    --button-bottom: #333333;
    --button-light: #666666;
    --button-dark: #222222;
    --link: #ebadcb;
    --link-hover: #f2cadd;
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
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

header.site { background: var(--primary) linear-gradient(var(--primary-light), var(--primary)); border-bottom: 2px solid var(--primary-dark); color: var(--on-primary); }
header.site .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding-top: 8px; padding-bottom: 8px; }
.brand { color: var(--on-primary); text-decoration: none; display: flex; flex-direction: column; margin-right: auto; min-width: 0; }
.brand:visited, .brand:hover { color: var(--on-primary); }
.brand b { font-size: 22px; letter-spacing: 1px; text-shadow: 1px 1px 0 var(--primary-dark); }
.brand small { font-size: 11px; }
header.site search { display: block; min-width: 0; max-width: 100%; }
/* 検索欄、検索ボタン、言語のボタンを同じ高さにし、縦の中央でそろえる。 */
header.site form { display: flex; flex-wrap: nowrap; align-items: center; gap: 3px; min-width: 0; }
header.site input[type=search], header.site button, details.lang summary { height: var(--control-height); }
header.site input[type=search] { width: 14rem; min-width: 0; flex: 0 1 14rem; padding: 0 4px; border: 1px solid var(--primary-dark); font-size: 12px; background: var(--paper); color: var(--ink); }
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
button:active { border-color: var(--button-dark) var(--button-light) var(--button-light) var(--button-dark); background: var(--button-bottom); }
details.lang { position: relative; flex: none; }
details.lang summary { display: flex; align-items: center; cursor: pointer; list-style: none; padding: 0 8px; font-size: 12px; color: var(--on-primary); border: 1px solid var(--on-primary); background: var(--primary-dark); }
details.lang summary::-webkit-details-marker { display: none; }
details.lang ul { position: absolute; right: 0; top: 1.9rem; margin: 0; padding: 2px 0; list-style: none; background: var(--paper); border: 1px solid var(--line); min-width: 13rem; z-index: 5; }
details.lang li a { display: block; padding: 3px 10px; }
details.lang li a[aria-current] { font-weight: bold; background: var(--sub-pale); }

nav.cats { background: var(--paper); border-bottom: 1px solid var(--line); }
nav.cats ul { display: flex; flex-wrap: wrap; margin: 0 auto; padding: 0 8px; list-style: none; max-width: 860px; }
nav.cats li { display: flex; align-items: center; }
nav.cats li + li::before { content: "|"; color: var(--line); padding: 0 2px; }
nav.cats a { display: block; padding: 4px 6px; white-space: nowrap; font-size: 12px; font-weight: bold; text-decoration: none; }
nav.cats a:hover { text-decoration: underline; }
nav.cats a[aria-current] { color: var(--bar-text); background: var(--bar-bg); }

.notice { background: var(--sub-pale); border-bottom: 3px solid var(--sub-dark); }
.notice p { margin: 0 auto; padding: 4px 8px; font-size: 11px; color: var(--caution-text); }
.notice .label { font-weight: bold; margin-right: 4px; }
.notice .short { display: none; }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 10px; padding-top: 10px; padding-bottom: 20px; }
main { min-width: 0; background: var(--paper); border: 1px solid var(--line); padding: 10px 12px; }
.side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.side-narrow { display: none; }
.side-box { background: var(--paper); border: 1px solid var(--line); }
.side h2, .side summary { margin: 0; padding: 3px 8px; font-size: 12px; font-weight: bold; color: var(--on-primary); background: var(--primary) linear-gradient(var(--primary-light), var(--primary)); }
.side summary { cursor: pointer; }
.side section > *:not(h2), .side .side-body > * { margin: 6px 8px; }
.side ul { padding-left: 1.3em; }
.side li { margin: 2px 0; }
.side .example { color: var(--muted); font-size: 12px; }
.side ul.latest { list-style: none; padding-left: 0; }
.side ul.latest li { margin: 4px 0; }
.side ul.latest .meta { display: block; margin: 0; }

h1 { font-size: 17px; margin: 0 0 6px; line-height: 1.35; color: var(--heading); }
h2.bar { font-size: 13px; margin: 14px 0 6px; padding: 3px 8px; color: var(--bar-text); background: var(--bar-bg); border: 1px solid var(--sub-dark); border-left: 5px solid var(--primary); }
.tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 0; margin: 4px 0; list-style: none; }
.tag { display: inline-block; padding: 0 6px; font-size: 11px; text-decoration: none; color: var(--on-primary); background: var(--primary); border: 1px solid var(--primary-dark); }
.tag:visited, .tag:hover { color: var(--on-primary); }
.pill { display: inline-block; padding: 0 5px; border: 1px solid var(--line); background: var(--surface); font-size: 11px; color: var(--ink); }
.status { display: inline-block; padding: 0 5px; font-size: 11px; font-weight: bold; border: 1px solid; }
.status.pending { color: var(--caution-text); border: 2px solid var(--sub-dark); background: var(--sub-pale); }
.status.suspended, .status.removed { color: var(--danger); border-color: var(--danger); background: var(--danger-pale); }

form.search { margin: 6px 0; padding: 8px; background: var(--surface); border: 1px solid var(--line); }
form.search .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 3px 0; }
form.search .row:first-of-type { flex-wrap: nowrap; }
form.search input[type=search] { flex: 1 1 auto; width: 0; min-width: 0; height: var(--control-height); padding: 0 4px; font-size: 13px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); }
form.search button { height: var(--control-height); }
form.search select { font-size: 12px; max-width: 100%; background: var(--paper); color: var(--ink); border: 1px solid var(--line); }

ol.cards { list-style: none; margin: 0; padding: 0; }
ol.cards li { border-bottom: 1px dotted var(--line); padding: 8px 2px; }
.card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; }
.card-head a { font-size: 14px; font-weight: bold; min-width: 0; }
.card-head .ver { margin-left: auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
.card-head img.logo { width: 48px; height: 48px; object-fit: contain; flex: none; }
.title { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; }
.title img.logo { width: 64px; height: 64px; object-fit: contain; flex: none; }
.title h1 { margin: 0; min-width: 0; overflow-wrap: anywhere; }
p.shot { margin: 10px 0; }
p.shot img { display: block; max-width: 100%; height: auto; border: 1px solid var(--line); }
.summary { margin: 3px 0; }
.meta { color: var(--muted); font-size: 11px; margin: 2px 0; }
.pager { display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; }

.download { margin: 12px 0; padding: 10px; text-align: center; background: var(--sub-pale); border: 1px solid var(--sub-dark); }
.download a.button { display: inline-block; padding: 6px 22px; font-size: 14px; font-weight: bold; color: var(--on-primary); text-decoration: none; background: var(--primary) linear-gradient(var(--primary-light), var(--primary)); border: 1px solid var(--primary-dark); border-radius: 3px; }
.download a.button:visited, .download a.button:hover { color: var(--on-primary); }
.download p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
table.info { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
table.info th, table.info td { border: 1px solid var(--line); padding: 3px 6px; text-align: left; vertical-align: top; }
table.info th { width: 8.5rem; background: var(--surface); font-weight: normal; }
.files { list-style: none; padding: 0; margin: 0; }
.files > li { border: 1px solid var(--line); background: var(--surface-2); padding: 6px 8px; margin-bottom: 6px; }
.files .name { font-weight: bold; }
.hash { font-family: "Courier New", monospace; font-size: 11px; color: var(--muted); }
.checks { margin: 4px 0 0; padding-left: 1.3em; font-size: 12px; }
.callout { border: 2px solid var(--sub-dark); background: var(--sub-pale); color: var(--caution-text); padding: 6px 8px; margin: 8px 0; font-size: 12px; }
.callout .label { font-weight: bold; margin-right: 4px; }
.translation-note { border: 1px solid var(--line); background: var(--surface); padding: 6px 8px; margin: 8px 0; font-size: 12px; }
.untrusted-note { color: var(--muted); font-size: 11px; margin: 0 0 6px; }
.breadcrumb { font-size: 11px; color: var(--muted); margin: 0 0 4px; }
pre.code { margin: 6px 0; padding: 6px 8px; background: var(--surface); border: 1px solid var(--line); white-space: pre-wrap; overflow-wrap: anywhere; font-family: "Courier New", monospace; font-size: 12px; }
ul.blocks { margin: 6px 0; padding-left: 1.4em; }
ul.blocks li { margin: 3px 0; }

footer.site { background: var(--footer); border-top: 1px solid var(--line); }
footer.site ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 14px; list-style: none; margin: 0; padding: 8px 0 4px; font-size: 12px; }
footer.site p { margin: 0; padding: 0 8px 6px; color: var(--muted); font-size: 11px; text-align: center; }
footer.site p.copyright { padding-bottom: 12px; }
footer.site .contact-line { display: flex; justify-content: center; align-items: center; gap: 6px; padding: 0 8px 6px; color: var(--muted); font-size: 11px; }
form.contact { display: inline-block; margin: 0; }
form.contact button { font-size: 12px; padding: 1px 8px; }
p.contact-address { font-family: "Courier New", monospace; font-size: 15px; font-weight: bold; }

@media (max-width: 760px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .side-wide { display: none; }
  .side-narrow { display: flex; }
  .notice .long { display: none; }
  .notice .short { display: inline; }
  .brand { flex: 1 1 100%; }
  header.site search { flex: 1 1 0; }
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
