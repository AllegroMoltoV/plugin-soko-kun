// 画面のスタイル。CSP で style-src 'self' に限るため、インラインにせず /style.css から配信する。
export const STYLE_CSS = `
:root {
  color-scheme: light dark;
  --green: #2e7d32;
  --green-dark: #1b5e20;
  --green-pale: #e8f5e9;
  --ink: #1d2320;
  --muted: #5b6660;
  --line: #d5ddd7;
  --paper: #ffffff;
  --page: #f3f5f3;
  --warn-bg: #fff8e1;
  --warn-line: #e0b84f;
  --bad: #b3261e;
  --tag-audio: #1565c0;
  --tag-video: #6a1b9a;
  --tag-source: #00838f;
  --tag-transition: #ad1457;
  --tag-dock: #5d4037;
  --tag-output: #e65100;
  --tag-utility: #455a64;
  --tag-other: #757575;
}
@media (prefers-color-scheme: dark) {
  :root {
    --green-pale: #1f2d21;
    --ink: #e5ebe6;
    --muted: #a7b3ab;
    --line: #34403a;
    --paper: #161b18;
    --page: #0f1311;
    --warn-bg: #2c2612;
    --warn-line: #8a7230;
    --bad: #f2b8b5;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC", sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
a { color: var(--green-dark); }
@media (prefers-color-scheme: dark) { a { color: #81c784; } }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 3px solid #f9a825;
  outline-offset: 2px;
}
.skip { position: absolute; left: -999px; }
.skip:focus { left: 8px; top: 8px; background: var(--paper); padding: 4px 8px; z-index: 10; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 16px; }
header.site { background: var(--green); color: #fff; }
header.site .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding-top: 10px; padding-bottom: 10px; }
.brand { color: #fff; text-decoration: none; display: flex; flex-direction: column; margin-right: auto; }
.brand b { font-size: 1.35rem; letter-spacing: .02em; }
.brand small { opacity: .9; }
header.site form { display: flex; gap: 4px; }
header.site input[type=search] { width: 16rem; max-width: 52vw; padding: 6px 8px; border: 0; border-radius: 3px; font-size: 1rem; }
header.site button { padding: 6px 12px; border: 0; border-radius: 3px; background: #fff; color: var(--green-dark); font-weight: 600; font-size: 1rem; cursor: pointer; }
details.lang { position: relative; }
details.lang summary { cursor: pointer; list-style: none; padding: 4px 8px; border: 1px solid rgba(255,255,255,.6); border-radius: 3px; }
details.lang ul { position: absolute; right: 0; top: 2.2rem; margin: 0; padding: 4px 0; list-style: none; background: var(--paper); border: 1px solid var(--line); min-width: 14rem; z-index: 5; }
details.lang li a { display: block; padding: 6px 12px; color: var(--ink); text-decoration: none; }
details.lang li a[aria-current] { font-weight: 700; }
nav.cats { background: var(--green-dark); }
nav.cats ul { display: flex; gap: 0; margin: 0; padding: 0 8px; list-style: none; overflow-x: auto; white-space: nowrap; max-width: 1080px; margin: 0 auto; }
nav.cats a { display: block; padding: 8px 12px; color: #fff; text-decoration: none; font-size: .95rem; }
nav.cats a[aria-current] { background: rgba(255,255,255,.18); }
.notice { background: var(--warn-bg); border-bottom: 1px solid var(--warn-line); }
.notice p { margin: 0; padding: 8px 0; font-size: .9rem; }
.notice .short { display: none; }
.layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; padding-top: 16px; padding-bottom: 32px; }
main, .side section { background: var(--paper); border: 1px solid var(--line); }
main { padding: 16px; min-width: 0; }
.side { display: flex; flex-direction: column; gap: 12px; }
.side section { padding: 12px 14px; }
.side h2 { font-size: 1rem; margin: 0 0 6px; padding-left: 8px; border-left: 4px solid var(--green); }
.side ul { margin: 0; padding-left: 1.2em; }
.side .example { color: var(--muted); font-size: .9rem; }
h1 { font-size: 1.4rem; margin: 0 0 8px; line-height: 1.35; overflow-wrap: anywhere; }
h2.bar { font-size: 1.05rem; margin: 20px 0 8px; padding: 4px 10px; background: var(--green-pale); border-left: 5px solid var(--green); }
.tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 8px 0; list-style: none; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 2px; color: #fff; font-size: .82rem; text-decoration: none; }
.tag.audio-filter { background: var(--tag-audio); }
.tag.video-filter { background: var(--tag-video); }
.tag.source { background: var(--tag-source); }
.tag.transition { background: var(--tag-transition); }
.tag.dock-ui { background: var(--tag-dock); }
.tag.output { background: var(--tag-output); }
.tag.utility { background: var(--tag-utility); }
.tag.other { background: var(--tag-other); }
.pill { display: inline-block; padding: 1px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: .8rem; color: var(--muted); }
.status { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: .8rem; font-weight: 700; }
.status.listed { background: var(--green-pale); color: var(--green-dark); }
.status.pending { background: var(--warn-bg); color: #7a5b00; }
.status.suspended, .status.removed { background: #fdecea; color: var(--bad); }
@media (prefers-color-scheme: dark) { .status.listed { color: #a5d6a7; } .status.pending { color: #ffe08a; } .status.suspended, .status.removed { background: #3a1c1a; } }
form.search { display: grid; gap: 8px; margin: 8px 0 4px; }
form.search .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
form.search input[type=search] { flex: 1 1 14rem; padding: 8px; font-size: 1rem; border: 1px solid var(--line); border-radius: 3px; background: var(--paper); color: var(--ink); }
form.search button { padding: 8px 16px; font-size: 1rem; background: var(--green); color: #fff; border: 0; border-radius: 3px; cursor: pointer; }
form.search select { padding: 6px; font-size: 1rem; }
ol.cards { list-style: none; margin: 0; padding: 0; }
ol.cards li { border-top: 1px solid var(--line); padding: 12px 0; }
ol.cards li:first-child { border-top: 0; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.card-head a { font-size: 1.1rem; font-weight: 700; overflow-wrap: anywhere; }
.card-head .ver { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.summary { margin: 4px 0; overflow-wrap: anywhere; }
.meta { color: var(--muted); font-size: .85rem; }
.pager { display: flex; justify-content: space-between; margin-top: 12px; }
.download { margin: 16px 0; padding: 14px; border: 2px solid var(--green); text-align: center; background: var(--green-pale); }
.download a.button { display: inline-block; padding: 10px 24px; background: var(--green); color: #fff; font-weight: 700; font-size: 1.05rem; text-decoration: none; border-radius: 3px; }
.download p { margin: 6px 0 0; color: var(--muted); font-size: .9rem; overflow-wrap: anywhere; }
table.info { width: 100%; border-collapse: collapse; }
table.info th, table.info td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
table.info th { width: 9rem; background: var(--green-pale); font-weight: 600; }
.files { list-style: none; padding: 0; margin: 0; }
.files li { border: 1px solid var(--line); padding: 10px; margin-bottom: 8px; }
.files .name { font-weight: 600; overflow-wrap: anywhere; }
.hash { font-family: ui-monospace, Consolas, monospace; font-size: .82rem; overflow-wrap: anywhere; color: var(--muted); }
.checks { margin: 6px 0 0; padding-left: 1.2em; }
.callout { border: 1px solid var(--warn-line); background: var(--warn-bg); padding: 10px 12px; margin: 12px 0; }
.untrusted-note { color: var(--muted); font-size: .8rem; }
footer.site { border-top: 1px solid var(--line); background: var(--paper); }
footer.site ul { display: flex; flex-wrap: wrap; gap: 6px 18px; list-style: none; margin: 0; padding: 14px 0; }
footer.site p { margin: 0; padding: 0 0 14px; color: var(--muted); font-size: .85rem; }
.breadcrumb { font-size: .85rem; color: var(--muted); margin-bottom: 6px; }
@media (max-width: 760px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .notice .long { display: none; }
  .notice .short { display: inline; }
  header.site input[type=search] { width: 100%; max-width: none; }
  header.site form { flex: 1 1 100%; }
  table.info th { width: 7rem; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`;
