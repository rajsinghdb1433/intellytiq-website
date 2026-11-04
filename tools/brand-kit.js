// Builds the LinkedIn / social brand kit into ./brand  (node tools/brand-kit.js; needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'brand');
fs.mkdirSync(out, { recursive: true });
const markSvg = fs.readFileSync(path.join(root, 'assets/img/logo-mark.svg'), 'utf8');
const FONT = '"Inter","SF Pro Display",-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
const mark = (size) => markSvg.replace('<svg ', `<svg style="width:${size}px;height:${size}px;display:block" `);

const page = (w, h, bg, body, css = '') => `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:${FONT};background:${bg}}${css}</style>${body}`;
const wordmark = (color, sub, big, small) => `<div style="display:grid;line-height:1"><b style="font-size:${big}px;font-weight:700;letter-spacing:-.03em;color:${color}">Intellytiq</b><span style="font-size:${small}px;letter-spacing:.34em;font-weight:600;color:${sub};margin-top:${Math.round(big * .14)}px">SOLUTIONS</span></div>`;
const GLOW = 'radial-gradient(circle at 12% 120%,rgba(34,211,238,.35),transparent 45%),radial-gradient(circle at 92% -20%,rgba(168,85,247,.45),transparent 50%),linear-gradient(120deg,#0b1030,#1b1a64 55%,#0d3f73)';
const dots = `<svg style="position:absolute;right:0;top:0;height:100%;opacity:.5" viewBox="0 0 600 400" preserveAspectRatio="xMaxYMid slice" width="900"><g stroke="#8b9cff" stroke-opacity=".35" stroke-width="1.2" fill="none"><path d="M60 80 200 160 330 70 470 150 560 60M200 160 260 300 400 260 470 150M260 300 120 340M400 260 540 330"/></g><g fill="#22d3ee"><circle cx="60" cy="80" r="4"/><circle cx="330" cy="70" r="5"/><circle cx="260" cy="300" r="4"/><circle cx="540" cy="330" r="4"/></g><g fill="#c084fc"><circle cx="200" cy="160" r="5"/><circle cx="470" cy="150" r="6"/><circle cx="400" cy="260" r="4"/><circle cx="560" cy="60" r="4"/></g></svg>`;

const assets = [
  // square logos: LinkedIn company logo (300x300 min) and profile photo (400x400), safe inside a circular crop
  { file: 'intellytiq-linkedin-logo-400x400.png', w: 400, h: 400, html: page(400, 400, '#ffffff', `<div style="width:400px;height:400px;display:grid;place-items:center">${mark(250)}</div>`) },
  { file: 'intellytiq-linkedin-logo-dark-400x400.png', w: 400, h: 400, html: page(400, 400, '#0b1030', `<div style="width:400px;height:400px;display:grid;place-items:center;background:${GLOW}">${mark(250)}</div>`) },
  { file: 'intellytiq-linkedin-logo-1200x1200.png', w: 1200, h: 1200, html: page(1200, 1200, '#ffffff', `<div style="width:1200px;height:1200px;display:grid;place-items:center">${mark(750)}</div>`) },
  // cover banners
  { file: 'intellytiq-linkedin-company-cover-1128x191.png', w: 1128, h: 191, html: page(1128, 191, '#0b1030', `<div style="position:relative;width:1128px;height:191px;background:${GLOW};display:flex;align-items:center;padding-left:250px;gap:20px;overflow:hidden">${dots}<div style="position:relative;display:flex;align-items:center;gap:18px">${mark(76)}${wordmark('#fff', '#a5b4fc', 44, 11)}</div><div style="position:relative;margin-left:34px;padding-left:34px;border-left:1px solid rgba(255,255,255,.25);color:#dfe5ff;font-size:17px;line-height:1.45;max-width:380px">Microsoft Fabric · Databricks · Snowflake · SQL Server · Azure<br><span style="color:#8fe9ff;font-weight:600">Remote data engineering, worldwide</span></div></div>`) },
  { file: 'intellytiq-linkedin-profile-cover-1584x396.png', w: 1584, h: 396, html: page(1584, 396, '#0b1030', `<div style="position:relative;width:1584px;height:396px;background:${GLOW};display:flex;align-items:center;padding-left:360px;overflow:hidden">${dots}<div style="position:relative;display:grid;gap:26px"><div style="display:flex;align-items:center;gap:26px">${mark(120)}${wordmark('#fff', '#a5b4fc', 78, 17)}</div><div style="color:#dfe5ff;font-size:27px;line-height:1.4">Data engineering and cloud talent, delivered remotely worldwide.<br><span style="color:#8fe9ff;font-weight:600">Per-day or project basis · Guaranteed delivery</span></div></div></div>`) },
  // transparent logos for documents, slides and websites
  { file: 'intellytiq-logo-mark-transparent-1024.png', w: 1024, h: 1024, transparent: true, html: page(1024, 1024, 'transparent', `<div style="width:1024px;height:1024px;display:grid;place-items:center">${mark(960)}</div>`) },
  { file: 'intellytiq-logo-lockup-dark-text-transparent.png', w: 1600, h: 480, transparent: true, html: page(1600, 480, 'transparent', `<div style="width:1600px;height:480px;display:flex;align-items:center;justify-content:center;gap:40px">${mark(300)}${wordmark('#0f1430', '#566086', 190, 42)}</div>`) },
  { file: 'intellytiq-logo-lockup-white-text-transparent.png', w: 1600, h: 480, transparent: true, html: page(1600, 480, 'transparent', `<div style="width:1600px;height:480px;display:flex;align-items:center;justify-content:center;gap:40px">${mark(300)}${wordmark('#ffffff', '#c7d2fe', 190, 42)}</div>`) },
];

(async () => {
  const b = await chromium.launch();
  for (const a of assets) {
    const pg = await b.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
    await pg.setContent(a.html); await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(out, a.file), omitBackground: !!a.transparent, clip: { x: 0, y: 0, width: a.w, height: a.h } });
    await pg.close(); console.log('made', a.file, `${a.w}x${a.h}`);
  }
  fs.copyFileSync(path.join(root, 'assets/img/logo-mark.svg'), path.join(out, 'intellytiq-logo-mark.svg'));
  await b.close();
})();
