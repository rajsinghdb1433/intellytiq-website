/* Intellytiq Solutions — site engine: layout, animation, data rendering */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs = new URLSearchParams(location.search);
const page = document.body.dataset.page || '';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- icons ---------- */
const ICONS = {
  layers:'<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".5"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  snow:'<path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  flow:'<circle cx="5" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 6C13 6 12 12 16.5 12M7.5 18c5.5 0 4.5-6 9-6"/>',
  db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.300 8-3V5M4 11v6c0 1.700 3.600 3 8 3s8-1.300 8-3v-6"/>',
  server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.500h.01M7 17.500h.01"/>',
  cloud:'<path d="M7 18a4.500 4.500 0 0 1-.6-9A6 6 0 0 1 18 9.500 4 4 0 0 1 17.500 18H7Z"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  pin:'<path d="M12 21s7-6.200 7-11.500A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21Z"/><circle cx="12" cy="9.500" r="2.500"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone:'<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.layers}</svg>`;
const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const LOGO = `<img src="assets/img/logo-mark.svg" alt="" width="44" height="44">`;

/* ---------- data ---------- */
let DATA = null;
const load = async () => {
  for (const url of ['api.php?a=content', 'data/defaults.json']) {
    try { const r = await fetch(url, {cache: 'no-cache'}); if (r.ok) { const j = await r.json(); if (j && j.services) return (DATA = j); } } catch (e) {}
  }
  return (DATA = {settings: {}, services: [], posts: [], team: [], technologies: []});
};

/* ---------- sanitiser for admin-authored HTML ---------- */
const clean = html => {
  // Allowlist sanitiser: unknown tags are unwrapped, dangerous ones removed, attributes and URLs restricted.
  const ALLOW = new Set(['P', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'BR', 'HR', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'LINK', 'META', 'SVG', 'MATH', 'BASE', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'TEMPLATE', 'FRAME', 'FRAMESET']);
  const okUrl = (u, img) => { u = String(u).replace(/[\u0000- \u007f]+/g, ''); if (!u) return null; const m = u.match(/^([a-z][a-z0-9+.\-]*):/i); if (m) { const sc = m[1].toLowerCase(); if (sc === 'http' || sc === 'https' || (!img && sc === 'mailto')) return u; if (img && sc === 'data' && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+\/=]+$/i.test(u)) return u; return null; } return /^(\/|\.\/|\.\.\/|#|[a-z0-9_\-])/i.test(u) ? u : null; };
  const doc = new DOMParser().parseFromString(`<div id="r">${html || ''}</div>`, 'text/html');
  const walk = node => [...node.childNodes].forEach(c => {
    if (c.nodeType === 8) return c.remove();
    if (c.nodeType !== 1) return;
    if (DROP.has(c.tagName)) return c.remove();
    walk(c);
    if (!ALLOW.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
    [...c.attributes].forEach(a => {
      const n = a.name.toLowerCase(), ok = (c.tagName === 'A' && (n === 'href' || n === 'title')) || (c.tagName === 'IMG' && ['src', 'alt', 'title', 'width', 'height'].includes(n));
      if (!ok) return c.removeAttribute(a.name);
      if (n === 'href' || n === 'src') { const u = okUrl(a.value, n === 'src'); if (u === null) c.removeAttribute(a.name); else c.setAttribute(n, u); }
    });
    if (c.tagName === 'A' && c.hasAttribute('href')) { c.setAttribute('rel', 'noopener noreferrer nofollow'); if (/^https?:/i.test(c.getAttribute('href'))) c.setAttribute('target', '_blank'); }
    if (c.tagName === 'IMG') c.setAttribute('loading', 'lazy');
  });
  walk(doc.getElementById('r'));
  return doc.getElementById('r').innerHTML;
};

/* ---------- cover art (generated, no stock photos needed) ---------- */
const seeded = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
const cover = (p, i = 0) => {
  const r = seeded(p.slug || p.title || 'x'), h = Number(p.hue ?? Math.floor(r() * 360)), h2 = (h + 60) % 360, id = 'c' + Math.abs(i) + Math.floor(r() * 1e6);
  let nodes = '', lines = '';
  const pts = Array.from({length: 14}, () => [r() * 400, r() * 250]);
  pts.forEach((a, k) => pts.forEach((b, j) => { if (j > k && Math.hypot(a[0] - b[0], a[1] - b[1]) < 120) lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }));
  pts.forEach(a => nodes += `<circle cx="${a[0]}" cy="${a[1]}" r="${2 + r() * 4}"/>`);
  return `<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(p.title)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 85% 22%)"/><stop offset="1" stop-color="hsl(${h2} 80% 38%)"/></linearGradient><radialGradient id="${id}r" cx=".75" cy=".2" r=".7"><stop offset="0" stop-color="hsl(${h2} 100% 70%)" stop-opacity=".55"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><rect width="400" height="250" fill="url(#${id})"/><rect width="400" height="250" fill="url(#${id}r)"/><g stroke="#fff" stroke-opacity=".22">${lines}</g><g fill="#fff" fill-opacity=".8">${nodes}</g><circle cx="${60 + r() * 280}" cy="${40 + r() * 170}" r="${50 + r() * 40}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/></svg>`;
};
const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}); } catch (e) { return d; } };
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- layout ---------- */
const NAV = [['index.html', 'Home'], ['about.html', 'About'], ['services.html', 'Services', true], ['technologies.html', 'Technologies'], ['team.html', 'Team'], ['blog.html', 'Blog'], ['careers.html', 'Careers']];
const current = location.pathname.split('/').pop() || 'index.html';
const isActive = h => current === h || (h === 'services.html' && current === 'service.html') || (h === 'blog.html' && current === 'post.html');

function buildNav() {
  const host = $('#nav'); if (!host) return;
  host.outerHTML = `<header class="nav" id="siteNav"><div class="wide in">
    <a class="logo" href="index.html" aria-label="Intellytiq Solutions home">${LOGO}<span>Intellytiq<small>SOLUTIONS</small></span></a>
    <button class="burger" aria-label="Menu" aria-expanded="false"><i></i></button>
    <nav class="menu" id="menu" aria-label="Main">
      ${NAV.map(([h, t, d]) => d
        ? `<div class="drop"><a class="m ${isActive(h) ? 'active' : ''}" href="${h}">${t} ▾</a><div class="panel" id="navServices"></div></div>`
        : `<a class="m ${isActive(h) ? 'active' : ''}" href="${h}">${t}</a>`).join('')}
      <button class="theme-btn" id="themeBtn" type="button" aria-label="Switch between light and dark theme"><svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg></button>
      <a class="btn primary" href="contact.html">Contact us</a>
    </nav></div></header>`;
  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement, next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next); try { localStorage.setItem('iq-theme', next); } catch (e) {}
  });
  const nav = $('#siteNav'), burger = $('.burger'), menu = $('#menu');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 20);
  onScroll(); addEventListener('scroll', onScroll, {passive: true});
  burger.addEventListener('click', () => { const o = menu.classList.toggle('open'); burger.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); });
  $('.drop > a')?.addEventListener('click', e => { if (matchMedia('(max-width:860px)').matches) { e.preventDefault(); $('.drop').classList.toggle('open'); } });
}

function buildFooter(s = {}) {
  const host = $('#foot'); if (!host) return;
  const soc = (u, p) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${p[0]}"><svg viewBox="0 0 24 24">${p[1]}</svg></a>` : '';
  host.outerHTML = `<footer><div class="wrap">
    <div class="fgrid"><div>
      <a class="logo" href="index.html">${LOGO}<span>Intellytiq<small>SOLUTIONS</small></span></a>
      <p class="about">${esc(s.tagline || 'Data engineering & cloud talent, delivered remotely worldwide.')}</p>
      <div class="social">${soc(s.linkedin, ['LinkedIn', '<path d="M4.500 8.500h3.500V20H4.500zM6.300 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 8.500h3.300v1.600c.5-.9 1.700-1.900 3.500-1.900 3.600 0 4.200 2.400 4.200 5.400V20h-3.500v-5.600c0-1.300 0-3-1.900-3s-2.100 1.400-2.100 2.900V20H10z"/>'])}${soc(s.github, ['GitHub', '<path d="M12 2a10 10 0 0 0-3.200 19.500c.5.100.7-.2.7-.5v-1.800c-2.800.6-3.400-1.300-3.400-1.300-.5-1.200-1.100-1.500-1.100-1.500-.9-.6.100-.6.100-.6 1 .1 1.500 1 1.500 1 .9 1.500 2.300 1.100 2.900.8.1-.7.4-1.100.6-1.300-2.200-.3-4.600-1.100-4.600-5 0-1.100.4-2 1-2.700-.1-.3-.4-1.300.1-2.700 0 0 .8-.3 2.800 1a9.500 9.500 0 0 1 5 0c1.900-1.300 2.800-1 2.800-1 .5 1.400.2 2.400.1 2.700.6.700 1 1.600 1 2.700 0 3.900-2.400 4.700-4.600 5 .4.300.7.900.7 1.800V21c0 .3.200.6.700.5A10 10 0 0 0 12 2z"/>'])}${soc(s.twitter, ['X', '<path d="M17.800 3h3l-6.500 7.500L22 21h-6l-4.700-6.100L5.900 21h-3l7-8L2.500 3h6.100l4.300 5.600L17.800 3zm-1 16.200h1.700L7.700 4.700H5.900l10.900 14.500z"/>'])}</div>
    </div>
    <div><h5>Company</h5><ul><li><a href="about.html">About us</a></li><li><a href="team.html">Our team</a></li><li><a href="careers.html">Careers</a></li><li><a href="case-studies.html">Case studies</a></li><li><a href="contact.html">Contact</a></li></ul></div>
    <div><h5>Services</h5><ul id="footServices"></ul></div>
    <div><h5>Resources</h5><ul><li><a href="blog.html">Blog</a></li><li><a href="technologies.html">Technologies</a></li><li><a href="industries.html">Industries</a></li><li><a href="engagement.html">Engagement models</a></li><li><a href="faq.html">FAQ</a></li></ul>
      <h5 style="margin-top:26px">Newsletter</h5><form class="sub-form" data-subscribe novalidate><div class="subscribe"><input type="email" name="email" placeholder="you@company.com" aria-label="Email" autocomplete="email" required><button>Join</button></div><div class="cap-slot" data-captcha hidden></div></form><p class="muted" id="subMsg" role="status" style="font-size:13px;margin-top:8px"></p></div></div>
    <div class="fbot"><span>© ${new Date().getFullYear()} ${esc(s.company || 'Intellytiq Solutions')}. All rights reserved.</span><span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="sitemap.xml">Sitemap</a> · <a href="admin/">Admin</a></span></div>
  </div></footer>
  <button class="totop" aria-label="Back to top"><svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></svg></button><div class="progress" id="prog"></div><div class="glow" id="glow"></div>`;
  const tt = $('.totop'); tt.addEventListener('click', () => scrollTo({top: 0, behavior: reduce ? 'auto' : 'smooth'}));
  const pr = $('#prog'), gl = $('#glow');
  addEventListener('scroll', () => { tt.classList.toggle('show', scrollY > 700); const h = document.documentElement; pr.style.width = (scrollY / (h.scrollHeight - h.clientHeight) * 100) + '%'; }, {passive: true});
  if (!reduce && matchMedia('(pointer:fine)').matches) addEventListener('pointermove', e => { gl.style.left = e.clientX + 'px'; gl.style.top = e.clientY + 'px'; }, {passive: true});
}

/* ---------- renderers ---------- */
const R = {
  'services-bento'(el, d) {
    const spans = ['span3', 'span3', 'span2', 'span2', 'span2', 'span4', 'span2', 'span3', 'span3'];
    const n = +el.dataset.limit || d.services.length;
    el.innerHTML = d.services.slice(0, n).map((s, i) => `<a class="card ${spans[i % spans.length]} rv" style="--d:${(i % 3) * .08}s" href="service.html?s=${esc(s.slug)}"><div class="ico">${icon(s.icon)}</div><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><ul>${(s.tags || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></a>`).join('');
  },
  'services-grid'(el, d) {
    el.innerHTML = d.services.map((s, i) => `<a class="card rv" style="--d:${(i % 3) * .08}s" href="service.html?s=${esc(s.slug)}"><div class="ico">${icon(s.icon)}</div><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><span class="link" style="margin-top:20px">Explore ${ARROW}</span></a>`).join('');
  },
  'service-detail'(el, d) {
    const s = d.services.find(x => x.slug === qs.get('s')) || d.services[0]; if (!s) return;
    document.title = `${s.title} | Intellytiq Solutions`;
    $('#svcTitle').textContent = s.title; $('#svcSummary').textContent = s.summary; $('#svcCrumb').textContent = s.title;
    el.innerHTML = `<div class="story"><div class="stick rv left"><div class="ico card" style="width:84px;height:84px;padding:0;display:grid;place-items:center;background:var(--grad)">${icon(s.icon).replace('<svg', '<svg style="width:40px;height:40px;stroke:#fff;fill:none;stroke-width:1.7"')}</div><h2 style="margin:26px 0 16px">What we deliver</h2><p class="lead">${esc(s.body)}</p><div class="cta" style="display:flex;gap:12px;margin-top:30px;flex-wrap:wrap"><a class="btn primary" href="contact.html?topic=${encodeURIComponent(s.title)}">Discuss this service ${ARROW}</a></div></div>
    <div>${(s.features || []).map((f, i) => `<div class="card rv" style="margin-bottom:16px;--d:${i * .05}s;display:flex;gap:18px;align-items:center;padding:24px 28px"><b class="grad" style="font-size:26px;font-family:var(--mono)">${String(i + 1).padStart(2, '0')}</b><h3 style="font-size:20px;margin:0">${esc(f)}</h3></div>`).join('')}</div></div>`;
    const sm = $('#svcMedia'); if (sm) { const vv = (d.videos || []).find(x => x.key === s.video); sm.innerHTML = vv ? videoFrame(vv) : ''; }
    const others = d.services.filter(x => x.slug !== s.slug).slice(0, 3);
    const rel = $('#related'); if (rel) rel.innerHTML = others.map(o => `<a class="card rv" href="service.html?s=${esc(o.slug)}"><div class="ico">${icon(o.icon)}</div><h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p></a>`).join('');
  },
  'video-bento'(el, d) { el.innerHTML = (d.videos || []).map(videoTile).join(''); },
  'video-frame'(el, d) { const v = (d.videos || []).find(x => x.key === el.dataset.key); el.innerHTML = v ? videoFrame(v) : ''; },
  'bg-video'(el, d) { const v = (d.videos || []).find(x => x.key === el.dataset.key); el.innerHTML = v ? `<video class="bgvid" muted loop playsinline preload="none" data-src="${esc(v.file)}" aria-hidden="true"></video>` : ''; },
  'tech-marquee'(el, d) {
    const items = d.technologies.map(t => `<span>${esc(t.name)}</span>`).join('');
    el.innerHTML = `<div class="tr">${items}${items}</div>`;
  },
  'tech-tiles'(el, d) {
    const n = +el.dataset.limit || d.technologies.length;
    el.innerHTML = d.technologies.slice(0, n).map((t, i) => `<button type="button" class="tile rv" data-tech="${i}" data-tilt style="--d:${(i % 4) * .06}s;--glow:${esc((t.color.match(/#[0-9a-f]{6}/i) || ['#6366f1'])[0])}88" aria-label="${esc(t.name)}: view details"><div class="mono" style="--bgc:${esc(t.color)}">${esc(t.mono)}</div><h4>${esc(t.name)}</h4><p>${esc(t.summary || t.desc)}</p><span class="more">Learn more ${ARROW}</span></button>`).join('');
  },
  stats(el, d) {
    el.innerHTML = (d.settings.stats || []).map(s => `<div class="stat rv"><b><span data-count="${+s.value}">0</span>${esc(s.suffix || '')}</b><span>${esc(s.label)}</span></div>`).join('');
  },
  process(el, d) {
    el.innerHTML = d.process.map((p, i) => `<div class="step ${i === 0 ? 'on' : ''}" data-i="${i}"><span>${esc(p.n)}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join('');
  },
  industries(el, d) {
    el.innerHTML = d.industries.map((x, i) => `<div class="card rv" style="--d:${(i % 4) * .06}s"><h3 style="font-size:21px">${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('');
  },
  values(el, d) { el.innerHTML = d.values.map((x, i) => `<div class="card rv" style="--d:${i * .07}s"><div class="ico">${icon(['bolt', 'chart', 'globe', 'layers'][i % 4])}</div><h3 style="font-size:22px">${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join(''); },
  timeline(el, d) { el.innerHTML = d.timeline.map(x => `<div class="it rv"><span class="yr">${esc(x.year)}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join(''); },
  testimonials(el, d) {
    el.innerHTML = d.testimonials.map((t, i) => `<figure class="quote rv" style="--d:${i * .1}s"><div class="stars">★★★★★</div><p>“${esc(t.quote)}”</p><figcaption class="by"><i></i><div><b>${esc(t.name)}</b><small>${esc(t.role)}</small></div></figcaption></figure>`).join('');
  },
  faq(el, d) {
    const n = +el.dataset.limit || d.faqs.length;
    el.innerHTML = d.faqs.slice(0, n).map(f => `<div class="qa rv"><button aria-expanded="false">${esc(f.q)}<i></i></button><div class="a"><div><p>${esc(f.a)}</p></div></div></div>`).join('');
    $$('.qa button', el).forEach(b => b.addEventListener('click', () => { const q = b.parentElement, o = q.classList.toggle('open'); b.setAttribute('aria-expanded', o); }));
  },
  team(el, d) {
    const members = d.team.filter(m => !m.open), open = d.team.filter(m => m.open);
    const card = (m, i) => m.open
      ? `<a class="person rv" href="careers.html" style="--d:${(i % 4) * .07}s;border-style:dashed"><div class="avatar" style="--av:rgba(255,255,255,.07);font-size:38px">+</div><h3>${esc(m.role)}</h3><div class="role">We’re hiring</div><p>${esc(m.bio)}</p><div class="sk">${(m.skills || []).map(s => `<span>${esc(s)}</span>`).join('')}</div></a>`
      : `<article class="person rv ${m.lead ? 'lead-p' : ''}" style="--d:${(i % 4) * .07}s"><div class="avatar" style="--av:linear-gradient(135deg,${esc(m.c1 || '#22d3ee')},${esc(m.c2 || '#6366f1')})">${esc(initials(m.name))}</div><div><h3>${esc(m.name)}</h3><div class="role">${esc(m.role)}</div><p>${esc(m.bio)}</p><div class="sk">${(m.skills || []).map(s => `<span>${esc(s)}</span>`).join('')}</div></div></article>`;
    el.innerHTML = members.map(card).join('');
    const o = $('#openRoles'); if (o) o.innerHTML = open.map(card).join('');
  },
  projects(el, d) {
    el.innerHTML = d.projects.map((p, i) => `<article class="card rv ${i % 2 ? '' : ''}" style="--d:${(i % 2) * .1}s"><span class="pill">${esc(p.industry)}</span><h3 style="margin-top:16px">${esc(p.title)}</h3><p><b style="color:#fff">Challenge.</b> ${esc(p.challenge)}</p><p style="margin-top:10px"><b style="color:#fff">Solution.</b> ${esc(p.solution)}</p><ul>${(p.results || []).map(r => `<li style="background:rgba(52,211,153,.14);color:#6ee7b7">✓ ${esc(r)}</li>`).join('')}</ul><ul>${(p.tech || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul></article>`).join('');
  },
  careers(el, d) {
    el.innerHTML = d.careers.map((j, i) => `<a class="job rv" style="--d:${i * .06}s" href="contact.html?topic=${encodeURIComponent('Career: ' + j.title)}"><div><h3>${esc(j.title)}</h3><p class="muted" style="margin-top:6px">${esc(j.summary)}</p><div class="m"><span class="pill">${esc(j.type)}</span><span class="pill" style="background:rgba(168,85,247,.14);color:#d8b4fe">${esc(j.level)}</span><span class="pill" style="background:rgba(255,255,255,.08);color:#cfd3e4">${esc(j.location)}</span></div></div><span class="btn ghost">Apply ${ARROW}</span></a>`).join('');
  },
  'blog-latest'(el, d) {
    el.innerHTML = [...d.posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((p, i) => postCard(p, i)).join('');
  },
  contactinfo(el, d) {
    const s = d.settings, row = (ic, t, v, h) => v ? `<div class="card rv"><div class="ico">${icon(ic)}</div><div><small class="muted">${t}</small><div style="font-size:18px;font-weight:600">${h ? `<a href="${h}">${esc(v)}</a>` : esc(v)}</div></div></div>` : '';
    el.innerHTML = row('mail', 'Email', s.email, 'mailto:' + s.email) + row('phone', 'Phone', s.phone, 'tel:' + s.phone) + row('pin', 'Where we work', s.address) + row('clock', 'Availability', s.hours);
  }
};

function postCard(p, i = 0) {
  return `<a class="post rv" style="--d:${(i % 3) * .08}s" href="post.html?p=${esc(p.slug)}"><div class="cover">${cover(p, i)}<span class="cat">${esc(p.category)}</span></div><div class="bd"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><div class="meta"><span>${esc(p.author)}</span><i></i><span>${fmtDate(p.date)}</span><i></i><span>${+p.read || 5} min read</span></div></div></a>`;
}

/* ---------- blog list ---------- */
function blogPage(d) {
  const host = $('#posts'), chips = $('#chips'), q = $('#q'), feat = $('#featured'); if (!host) return;
  const posts = [...d.posts].sort((a, b) => b.date.localeCompare(a.date));
  const cats = ['All', ...new Set(posts.map(p => p.category))];
  let cat = 'All', view = localStorage.getItem('iq-view') || 'grid';
  chips.innerHTML = cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}">${esc(c)}</button>`).join('');
  const draw = () => {
    const term = (q.value || '').toLowerCase();
    let list = posts.filter(p => (cat === 'All' || p.category === cat) && (!term || (p.title + p.excerpt + (p.tags || []).join(' ')).toLowerCase().includes(term)));
    const f = (cat === 'All' && !term) ? (list.find(p => p.featured) || list[0]) : null;
    if (f) { list = list.filter(p => p !== f); feat.innerHTML = `<a class="featured rv in" href="post.html?p=${esc(f.slug)}"><div class="cover">${cover(f, 99)}</div><div class="bd"><span class="pill" style="align-self:flex-start">Featured · ${esc(f.category)}</span><h2>${esc(f.title)}</h2><p class="lead" style="font-size:18px">${esc(f.excerpt)}</p><div class="meta" style="display:flex;gap:12px;color:var(--muted);font-size:14px"><span>${esc(f.author)}</span><span>${fmtDate(f.date)}</span><span>${+f.read || 5} min</span></div><span class="link">Read article ${ARROW}</span></div></a>`; } else feat.innerHTML = '';
    host.className = 'posts ' + view;
    host.innerHTML = list.length ? list.map((p, i) => postCard(p, i).replace('post rv', 'post rv in')).join('') : '<div class="empty">No articles match your search.</div>';
    $$('.toggle button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    $('#count').textContent = `${list.length + (f ? 1 : 0)} article${list.length + (f ? 1 : 0) === 1 ? '' : 's'}`;
  };
  chips.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.textContent; $$('.chip', chips).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  q.addEventListener('input', draw);
  $$('.toggle button').forEach(b => b.addEventListener('click', () => { view = b.dataset.v; try { localStorage.setItem('iq-view', view); } catch (e) {} draw(); }));
  draw();
}

function postPage(d) {
  const host = $('#article'); if (!host) return;
  const p = d.posts.find(x => x.slug === qs.get('p')) || d.posts[0]; if (!p) return;
  document.title = `${p.title} | Intellytiq Solutions`;
  $('meta[name=description]')?.setAttribute('content', p.excerpt);
  $('#pTitle').textContent = p.title; $('#pCat').textContent = p.category;
  $('#pMeta').innerHTML = `${esc(p.author)} · ${fmtDate(p.date)} · ${+p.read || 5} min read`;
  $('#pCover').innerHTML = cover(p, 7);
  host.innerHTML = clean(p.content);
  const rel = d.posts.filter(x => x.slug !== p.slug && (x.category === p.category || (x.tags || []).some(t => (p.tags || []).includes(t)))).slice(0, 3);
  const more = rel.length ? rel : d.posts.filter(x => x.slug !== p.slug).slice(0, 3);
  $('#relPosts').innerHTML = more.map((x, i) => postCard(x, i)).join('');
  $('#share').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(location.href);
}

/* ---------- forms ---------- */
function forms() {
  const arm = form => {                       // mount a CAPTCHA and load it the first time the visitor interacts
    const slot = $('[data-captcha]', form); if (!slot) return null;
    const cap = window.IQCaptcha.mount(slot, 'api.php'); let started = false;
    form.addEventListener('focusin', () => { if (started) return; started = true; slot.hidden = false; cap.load(); });
    return {cap, slot, start() { if (!started) { started = true; slot.hidden = false; cap.load(); } }};
  };
  const c = $('form[data-contact]');
  if (c) {
    const g = arm(c);
    if (qs.get('topic')) { const t = c.elements.topic; if (t) { if (![...t.options].some(o => o.value === qs.get('topic'))) t.add(new Option(qs.get('topic'), qs.get('topic'))); t.value = qs.get('topic'); } }
    c.addEventListener('submit', async e => {
      e.preventDefault(); const note = $('.note', c), btn = $('button[type=submit]', c);
      if (!c.checkValidity()) { c.reportValidity(); return; }
      const body = Object.fromEntries(new FormData(c)); btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
      try {
        const r = await fetch('api.php?a=contact', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
        const j = await r.json(); if (!r.ok) { const er = new Error(j.error || 'Something went wrong'); er.captcha = j.captcha; throw er; }
        note.className = 'note ok'; note.textContent = 'Thank you! Your message has been received. We will reply within one business day.'; c.reset(); g && g.cap.reset();
      } catch (err) { note.className = 'note err'; note.textContent = err.message; g && g.cap.reset(); }
      btn.disabled = false; btn.firstChild.textContent = 'Send message ';
    });
  }
  $$('form[data-subscribe]').forEach(f => {
    const g = arm(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const m = $('#subMsg');
      if (g) g.start();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      try {
        const r = await fetch('api.php?a=subscribe', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.fromEntries(new FormData(f)))});
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Please try again.');
        m.textContent = 'You’re in. Thank you!'; f.reset(); if (g) { g.slot.hidden = true; g.cap.reset(); }
      } catch (err) { m.textContent = err.message || 'Please try again.'; if (g) g.cap.reset(); }
    });
  });
}

/* ---------- motion ---------- */
function motion() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {threshold: .12, rootMargin: '0px 0px -6% 0px'});
  $$('.rv:not(.in)').forEach(n => io.observe(n));
  const co = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; co.unobserve(e.target);
    const end = +e.target.dataset.count, t0 = performance.now(), dur = 1800;
    const tick = t => { const k = Math.min(1, (t - t0) / dur); e.target.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(tick); };
    reduce ? (e.target.textContent = end) : requestAnimationFrame(tick);
  }), {threshold: .6});
  $$('[data-count]').forEach(n => co.observe(n));
  // spotlight + tilt
  $$('.card,.person,.tile').forEach(n => {
    if (n.dataset.fx) return; n.dataset.fx = 1;
    n.addEventListener('pointermove', e => {
      const r = n.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      n.style.setProperty('--mx', x + 'px'); n.style.setProperty('--my', y + 'px');
      if (n.hasAttribute('data-tilt') && !reduce) n.style.transform = `perspective(700px) rotateX(${((y / r.height) - .5) * -9}deg) rotateY(${((x / r.width) - .5) * 9}deg) translateY(-4px)`;
    });
    n.addEventListener('pointerleave', () => { if (n.hasAttribute('data-tilt')) n.style.transform = ''; });
  });
  // story steps
  const steps = $$('.step');
  if (steps.length) {
    const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { steps.forEach(s => s.classList.toggle('on', s === e.target)); const i = +e.target.dataset.i; $$('.dn').forEach(n => n.classList.toggle('hot', +n.dataset.i <= i)); } }), {rootMargin: '-40% 0px -45% 0px'});
    steps.forEach(s => so.observe(s));
  }
}

function typer() {
  const el = $('#rot'); if (!el) return;
  const words = ['Microsoft Fabric', 'Databricks', 'Snowflake', 'Azure Cloud', 'SQL Server', 'Data Engineering'];
  if (reduce) { el.textContent = words[0]; return; }
  let w = 0, c = 0, del = false;
  const step = () => {
    const word = words[w]; el.textContent = word.slice(0, c);
    if (!del && c === word.length) { del = true; return setTimeout(step, 1700); }
    if (del && c === 0) { del = false; w = (w + 1) % words.length; }
    c += del ? -1 : 1; setTimeout(step, del ? 35 : 75);
  };
  step();
}

function network() {
  $$('canvas.net').forEach(cv => {
    const ctx = cv.getContext('2d'); let W, H, pts = [], mouse = {x: -999, y: -999}, vis = true, raf;
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1 : 1.5);
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const n = Math.round(Math.min(110, W * H / 15000)); pts = Array.from({length: n}, () => ({x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.8 + .8, h: Math.random() < .5 ? 190 : 265})); };
    size(); addEventListener('resize', size);
    cv.parentElement.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) draw(); }).observe(cv);
    const draw = () => {
      if (!vis) return; ctx.clearRect(0, 0, W, H); const L = document.documentElement.getAttribute('data-theme') === 'dark' ? 65 : 45;
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy); if (d < 140) { p.x += dx / d * .8; p.y += dy / d * .8; }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) { const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 135) { ctx.strokeStyle = `hsla(${a.h},90%,${L}%,${(1 - d / 135) * .35})`; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
        ctx.fillStyle = `hsla(${a.h},95%,${L + 5}%,.9)`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    if (reduce) { draw(); cancelAnimationFrame(raf); } else draw();
  });
}

/* ---------- videos: lazy, muted loops that remove themselves if the file cannot play ---------- */
const videoFrame = (v, cls = '') => `<div class="vframe vwide ${cls}" data-vkey="${esc(v.key)}"><video muted loop playsinline preload="none" data-src="${esc(v.file)}" ${v.poster ? `poster="${esc(v.poster)}"` : ''} aria-label="${esc(v.title)}"></video>${v.title ? `<div class="vcap"><span class="vtag">${esc(v.tag || '')}</span><b>${esc(v.title)}</b></div>` : ''}</div>`;
const videoTile = (v, i) => `<a class="vtile rv" style="--d:${(i % 3) * .08}s" href="${esc(v.link || 'services.html')}" data-vkey="${esc(v.key)}"><video muted loop playsinline preload="none" data-src="${esc(v.file)}" ${v.poster ? `poster="${esc(v.poster)}"` : ''} aria-hidden="true"></video><div class="vover"><span class="vtag">${esc(v.tag || '')}</span><h3>${esc(v.title)}</h3><p>${esc(v.text || '')}</p><span class="more">Explore ${ARROW}</span></div></a>`;
function lazyVideos() {
  const vids = $$('video[data-src]'); if (!vids.length) return;
  const saver = !!(navigator.connection && navigator.connection.saveData);
  const kill = v => {
    (v.closest('.vtile,.vframe,.bgvid-slot') || v).remove();
    $$('[data-video-section]').forEach(h => { if (!h.querySelector('video')) (h.closest('section') || h).hidden = true; });
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      if (saver) return;
      if (!v.getAttribute('src')) { v.preload = 'metadata'; v.src = v.dataset.src; v.load(); }
      if (!reduce) v.play().catch(() => {});
    } else if (!v.paused) v.pause();
  }), {rootMargin: '300px 0px'});
  vids.forEach(v => {
    v.addEventListener('error', () => kill(v));
    v.addEventListener('loadedmetadata', () => { if (!v.videoWidth || !isFinite(v.duration) || v.duration < 1.5) kill(v); });
    io.observe(v);
  });
}

/* ---------- technology popup ---------- */
function techModal(d) {
  const T = d.technologies; if (!T.length) return;
  const ov = document.createElement('div'); ov.className = 'tmodal'; ov.hidden = true;
  ov.innerHTML = '<div class="tm-box" role="dialog" aria-modal="true" aria-labelledby="tmTitle" tabindex="-1"><button type="button" class="tm-x" aria-label="Close">&times;</button><div class="tm-body"></div></div>';
  document.body.appendChild(ov);
  const box = $('.tm-box', ov), body = $('.tm-body', ov); let last = null;
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
  const open = i => {
    const t = T[i]; if (!t) return; last = document.activeElement;
    body.innerHTML = `<div class="tm-head" style="--bgc:${esc(t.color)}"><div class="mono">${esc(t.mono)}</div><div><span class="tm-group">${esc(t.group || 'Technology')}</span><h3 id="tmTitle">${esc(t.name)}</h3><p>${esc(t.desc || '')}</p></div></div>
    <div class="tm-main"><p class="tm-long">${esc(t.long || t.summary || t.desc)}</p>
    <div class="tm-cols"><div><h4>What we deliver</h4><ul class="ticks">${li(t.does)}</ul></div><div><h4>Typical use cases</h4><ul class="ticks warm">${li(t.usecases)}</ul></div></div>
    <div class="tm-assure"><div class="tm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg></div><div><b>We have the right skill set to deliver your ${esc(t.name)} project.</b><p>Senior engineers, proven patterns and guaranteed delivery. Hire us per day or for a fixed project, at rates below typical market prices.</p></div></div>
    <div class="tm-cta"><a class="btn primary" href="contact.html?topic=${encodeURIComponent(t.name)}">Discuss your ${esc(t.name)} project ${ARROW}</a><button type="button" class="btn ghost" data-close>Close</button></div></div>`;
    ov.hidden = false; document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { ov.classList.add('open'); box.scrollTop = 0; $('.tm-x', ov).focus(); });
  };
  const close = () => { ov.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { ov.hidden = true; }, 280); if (last && last.focus) last.focus(); };
  document.addEventListener('click', e => { const b = e.target.closest('[data-tech]'); if (b) { e.preventDefault(); open(+b.dataset.tech); } });
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.tm-x') || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => {
    if (ov.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { const f = $$('a[href],button', box).filter(x => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
}

/* ---------- boot ---------- */
buildNav();
const done = () => $('.loader')?.classList.add('done');
setTimeout(done, 2500);
load().then(d => {
  buildFooter(d.settings);
  const ns = $('#navServices'); if (ns) ns.innerHTML = d.services.map(s => `<a href="service.html?s=${esc(s.slug)}"><b>${esc(s.title)}</b><span>${esc(s.tags?.slice(0, 2).join(' · ') || '')}</span></a>`).join('');
  const fs = $('#footServices'); if (fs) fs.innerHTML = d.services.slice(0, 6).map(s => `<li><a href="service.html?s=${esc(s.slug)}">${esc(s.title)}</a></li>`).join('');
  $$('[data-render]').forEach(el => R[el.dataset.render]?.(el, d));
  techModal(d); lazyVideos(); blogPage(d); postPage(d); forms(); motion(); network(); typer(); done();
});
})();
