/* Intellytiq admin: schema-driven editor for every content collection */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API = '../api.php';
let csrf = '', DB = {}, defaultPw = false, cur = 'dashboard';

const api = async (a, body, method) => {
  const opt = {method: method || (body ? 'POST' : 'GET'), headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf}, credentials: 'same-origin'};
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(`${API}?a=${a}`, opt); let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(j.error || `Request failed (${r.status})`); err.status = r.status; throw err; }
  return j;
};
const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = 'toast', 3200); };
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/* ---------- schemas ---------- */
const T = (k, label, extra = {}) => ({k, label, type: 'text', ...extra});
const SCHEMA = {
  posts: {title: 'Blog posts', sub: 'Articles shown on the Blog page and home page.', label: i => i.title, meta: i => `${i.category || ''} · ${i.date || ''}`, blank: () => ({slug: '', title: '', category: 'Data Engineering', excerpt: '', author: 'Raj Singh', date: new Date().toISOString().slice(0, 10), read: 5, featured: false, hue: Math.floor(Math.random() * 360), tags: [], content: '<p>Write your article here.</p>'}),
    fields: [{k: 'image', label: 'Cover image (optional, replaces the generated cover)', type: 'image', kind: 'cover', full: true}, {k: 'videoFile', label: 'Article video (optional, shown at the top of the article)', type: 'video', full: true}, T('title', 'Title'), T('slug', 'URL slug', {hint: 'Auto-generated from the title if left empty'}), T('category', 'Category'), T('author', 'Author'), {k: 'date', label: 'Date', type: 'date'}, {k: 'read', label: 'Minutes to read', type: 'number'}, {k: 'hue', label: 'Cover colour (0–360)', type: 'number'}, {k: 'featured', label: 'Featured on blog page', type: 'bool'}, {k: 'tags', label: 'Tags', type: 'tags'}, {k: 'excerpt', label: 'Excerpt', type: 'textarea', full: true}, {k: 'content', label: 'Article body (HTML)', type: 'html', full: true}]},
  services: {title: 'Services', sub: 'Service pages and the home-page bento grid.', label: i => i.title, meta: i => i.slug, blank: () => ({slug: '', icon: 'layers', title: '', summary: '', body: '', features: [], tags: []}),
    fields: [{k: 'image', label: 'Card picture (optional, replaces the icon)', type: 'image', kind: 'cover', full: true}, T('title', 'Title'), T('slug', 'URL slug'), {k: 'icon', label: 'Icon', type: 'select', opts: ['layers', 'bolt', 'snow', 'flow', 'db', 'server', 'cloud', 'chart', 'globe']}, {k: 'tags', label: 'Tags', type: 'tags'}, {k: 'summary', label: 'Summary', type: 'textarea', full: true}, {k: 'body', label: 'Description', type: 'textarea', full: true}, {k: 'features', label: 'Capabilities (one per line)', type: 'lines', full: true}]},
  team: {title: 'Team', sub: 'People shown on the Team page. Tick “Open role” to show a hiring card.', label: i => i.open ? `${i.role} (open role)` : i.name, meta: i => i.role, blank: () => ({name: '', role: '', bio: '', skills: [], lead: false, open: false, c1: '#22d3ee', c2: '#6366f1'}),
    fields: [{k: 'photo', label: 'Photo', type: 'image', kind: 'team', full: true}, T('name', 'Name'), T('role', 'Role'), {k: 'lead', label: 'Large leadership card', type: 'bool'}, {k: 'open', label: 'Open role (hiring card)', type: 'bool'}, T('c1', 'Avatar colour 1', {hint: 'e.g. #22d3ee'}), T('c2', 'Avatar colour 2'), {k: 'skills', label: 'Skills', type: 'tags'}, {k: 'bio', label: 'Bio', type: 'textarea', full: true}]},
  companies: {title: 'Companies', sub: 'Organisations shown in the home page strip and on the About page. Add only companies you are happy to name publicly.', label: i => i.name, meta: i => [i.industry, i.period].filter(Boolean).join(' · '), blank: () => ({name: '', industry: '', role: '', period: '', details: '', link: '', image: ''}),
    fields: [{k: 'image', label: 'Logo (optional)', type: 'image', kind: 'logo', hint: 'Only use a logo you have the right to show.', full: true}, T('name', 'Company name'), T('industry', 'Industry'), T('role', 'Data services provided'), T('period', 'Period (e.g. 2021 to 2023)'), T('link', 'Website (optional, https://...)'), {k: 'details', label: 'Details', type: 'textarea', full: true}]},
  videos: {title: 'Videos', sub: 'Looping videos shown on the home, services and other pages. Upload the files to the Intellytiq-Videos folder first.', label: i => i.title, meta: i => i.key, blank: () => ({key: '', file: 'Intellytiq-Videos/', poster: '', title: '', tag: '', text: '', link: 'services.html'}),
    fields: [T('title', 'Title'), T('key', 'Key (lowercase letters and dashes)'), T('tag', 'Label'), T('link', 'Link when clicked'), {k: 'file', label: 'Video file', type: 'video', full: true}, {k: 'poster', label: 'Poster image (optional, shown before the video loads)', type: 'image', kind: 'cover', full: true}, {k: 'text', label: 'Short description', type: 'textarea', full: true}]},
  technologies: {title: 'Technologies', sub: 'Tiles on the Technologies page and the marquee.', label: i => i.name, meta: i => i.group, blank: () => ({name: '', mono: '', color: 'linear-gradient(135deg,#22d3ee,#6366f1)', desc: '', group: 'Platform'}),
    fields: [{k: 'image', label: 'Logo image (optional, replaces the letters)', type: 'image', kind: 'logo', hint: 'A square logo on a transparent background works best.', full: true}, T('name', 'Name'), T('mono', 'Short mark (2–3 letters)'), T('group', 'Group'), T('desc', 'Short tagline'), T('color', 'CSS gradient', {full: true}), {k: 'summary', label: 'Card description (1–2 sentences)', type: 'textarea', full: true}, {k: 'long', label: 'Popup description', type: 'textarea', full: true}, {k: 'does', label: 'What we deliver (one per line)', type: 'lines', full: true}, {k: 'usecases', label: 'Typical use cases (one per line)', type: 'lines', full: true}]},
  projects: {title: 'Case studies', sub: 'Engagement stories. Use only approved client information.', label: i => i.title, meta: i => i.industry, blank: () => ({title: '', industry: '', challenge: '', solution: '', results: [], tech: []}),
    fields: [{k: 'image', label: 'Cover image (optional)', type: 'image', kind: 'cover', full: true}, T('title', 'Title', {full: true}), T('industry', 'Industry'), {k: 'tech', label: 'Technologies', type: 'tags'}, {k: 'challenge', label: 'Challenge', type: 'textarea', full: true}, {k: 'solution', label: 'Solution', type: 'textarea', full: true}, {k: 'results', label: 'Results (one per line)', type: 'lines', full: true}]},
  careers: {title: 'Careers', sub: 'Open positions on the Careers page.', label: i => i.title, meta: i => i.type, blank: () => ({title: '', type: 'Contract · Remote', level: 'Senior', location: 'Worldwide', summary: ''}),
    fields: [T('title', 'Job title', {full: true}), T('type', 'Type'), T('level', 'Level'), T('location', 'Location'), {k: 'summary', label: 'Summary', type: 'textarea', full: true}]},
  testimonials: {title: 'Testimonials', sub: 'Replace the sample quotes with real, approved feedback.', label: i => i.name, meta: i => i.role, blank: () => ({quote: '', name: '', role: ''}),
    fields: [{k: 'photo', label: 'Photo or company logo (optional)', type: 'image', kind: 'avatar', full: true}, T('name', 'Name / title'), T('role', 'Company'), {k: 'quote', label: 'Quote', type: 'textarea', full: true}]},
  faqs: {title: 'FAQs', sub: 'Shown on the home, services and FAQ pages.', label: i => i.q, meta: () => '', blank: () => ({q: '', a: ''}), fields: [T('q', 'Question', {full: true}), {k: 'a', label: 'Answer', type: 'textarea', full: true}, {k: 'image', label: 'Picture shown in the answer (optional)', type: 'image', kind: 'cover', full: true}, {k: 'videoFile', label: 'Video shown in the answer (optional)', type: 'video', full: true}]},
  industries: {title: 'Industries', sub: '', label: i => i.title, meta: () => '', blank: () => ({title: '', text: ''}), fields: [{k: 'image', label: 'Picture (optional)', type: 'image', kind: 'cover', full: true}, T('title', 'Industry'), {k: 'text', label: 'Description', type: 'textarea', full: true}]},
  process: {title: 'Process steps', sub: 'The “How we work” timeline.', label: i => `${i.n} · ${i.title}`, meta: () => '', blank: () => ({n: '', title: '', text: ''}), fields: [T('n', 'Number (e.g. 06)'), T('title', 'Title'), {k: 'text', label: 'Description', type: 'textarea', full: true}]},
  values: {title: 'Company values', sub: '', label: i => i.title, meta: () => '', blank: () => ({title: '', text: ''}), fields: [T('title', 'Title'), {k: 'text', label: 'Description', type: 'textarea', full: true}]},
  timeline: {title: 'Timeline', sub: 'Our story on the About page.', label: i => i.title, meta: i => i.year, blank: () => ({year: '', title: '', text: ''}), fields: [T('year', 'Label / year'), T('title', 'Title'), {k: 'text', label: 'Description', type: 'textarea', full: true}, {k: 'image', label: 'Picture (optional)', type: 'image', kind: 'cover', full: true}]}
};
const TABS = [['dashboard', 'Dashboard'], ['posts', 'Blog posts'], ['services', 'Services'], ['team', 'Team'], ['videos', 'Videos'], ['technologies', 'Technologies'], ['projects', 'Case studies'], ['companies', 'Companies'], ['careers', 'Careers'], ['testimonials', 'Testimonials'], ['faqs', 'FAQs'], ['industries', 'Industries'], ['process', 'Process'], ['values', 'Values'], ['timeline', 'Timeline'], ['settings', 'Site settings'], ['email', 'Email'], ['messages', 'Messages'], ['security', 'Security']];

/* ---------- field rendering ---------- */
const imgSrc = v => /^(https?:|data:|blob:)/.test(v || '') ? v : '../' + (v || '');
const KINDS = {team: {w: 800, h: 800, crop: true, type: 'image/jpeg'}, avatar: {w: 600, h: 600, crop: true, type: 'image/jpeg'}, cover: {w: 1600, h: 1000, crop: true, type: 'image/jpeg'}, logo: {w: 512, h: 512, crop: false, type: 'image/png'}, inline: {w: 1600, h: 1600, crop: false, type: 'image/jpeg'}};
async function shrinkImage(file, kind) {
  const k = KINDS[kind] || KINDS.team, bmp = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, dw, dh;
  if (k.crop) { const r = k.w / k.h; if (sw / sh > r) { const nw = sh * r; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / r; sy = (sh - nh) / 2; sh = nh; } dw = Math.min(k.w, Math.round(sw)); dh = Math.round(dw / r); }
  else { const sc = Math.min(1, k.w / Math.max(sw, sh)); dw = Math.max(1, Math.round(sw * sc)); dh = Math.max(1, Math.round(sh * sc)); }
  const c = document.createElement('canvas'); c.width = dw; c.height = dh; const x = c.getContext('2d');
  if (k.type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, dw, dh); }
  x.drawImage(bmp, sx, sy, sw, sh, 0, 0, dw, dh);
  return c.toDataURL(k.type, 0.88);
}
async function uploadVideo(file, onProgress) {            // sent in small pieces so large files upload reliably
  const st = await api('upload_video_start', {size: file.size, name: file.name}); const step = st.chunk || 524288; let off = 0;
  while (off < file.size) {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(file.slice(off, off + step)); });
    let tries = 0, resp;
    for (;;) { try { resp = await api('upload_video_chunk', {id: st.id, offset: off, data: b64}); break; } catch (e) { if (e.status || ++tries > 2) throw e; } }
    off = resp.received; onProgress(off / file.size);
  }
  return api('upload_video_finish', {id: st.id});
}
function bindImages(form) {
  $$('.imgfield', form).forEach(box => {
    const hid = $('input[type=hidden]', box), prev = $('[data-prev]', box), clr = $('[data-clear]', box), msg = $('[data-msg]', box), bar = $('[data-bar]', box);
    const kind = box.dataset.kind || 'team', isVid = box.classList.contains('vidfield'), fileIn = $('[data-file]', box) || $('[data-vfile]', box);
    const setPrev = url => { prev.innerHTML = url ? (isVid ? `<video src="${esc(imgSrc(url))}" muted playsinline preload="metadata"></video>` : `<img src="${esc(imgSrc(url))}" alt="">`) : `<span>${isVid ? 'No video' : 'No photo'}</span>`; clr.hidden = !url; };
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0]; if (!f) return;
      if (isVid) {
        if (!/^video\/(mp4|webm)$/.test(f.type)) { msg.textContent = 'Please choose an MP4 or WebM video.'; fileIn.value = ''; return; }
        if (f.size > 52428800) { msg.textContent = 'That video is larger than 50 MB. Compress it first, for example to 720p.'; fileIn.value = ''; return; }
        bar.hidden = false; $('i', bar).style.width = '0%'; msg.textContent = 'Uploading video… 0%';
        try { const r = await uploadVideo(f, p => { $('i', bar).style.width = Math.round(p * 100) + '%'; msg.textContent = `Uploading video… ${Math.round(p * 100)}%`; }); hid.value = r.url; setPrev(r.url); msg.textContent = 'Video ready. Click Save changes to publish it.'; }
        catch (e) { msg.textContent = e.message; }
        bar.hidden = true;
      } else {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { msg.textContent = 'Please choose a JPG, PNG or WebP image.'; fileIn.value = ''; return; }
        if (f.size > 15e6) { msg.textContent = 'That file is too large (15 MB maximum).'; fileIn.value = ''; return; }
        msg.textContent = 'Uploading…';
        try { const r = await api('upload', {kind, data: await shrinkImage(f, kind)}); hid.value = r.url; setPrev(r.url); msg.textContent = 'Image ready. Click Save changes to publish it.'; }
        catch (e) { msg.textContent = e.message; }
      }
      fileIn.value = '';
    });
    clr.addEventListener('click', () => { hid.value = ''; setPrev(''); msg.textContent = 'Removed. Click Save changes to publish.'; });
  });
}
function bindInlineImage(form) {                          // the "Image" button in the article editor
  const btn = $('[data-img]', form), inp = $('[data-imgfile]', form); if (!btn || !inp) return;
  btn.addEventListener('click', () => inp.click());
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return; const ta = form.elements.content;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 15e6) { toast('Choose a JPG, PNG or WebP image under 15 MB', 1); inp.value = ''; return; }
    btn.disabled = true; btn.textContent = 'Uploading…';
    try { const r = await api('upload', {kind: 'inline', data: await shrinkImage(f, 'inline')}); const p = ta.selectionEnd; ta.setRangeText(`<p><img src="${r.url}" alt="Describe this image"></p>`, p, p, 'end'); toast('Image inserted. You can edit its description in the text.'); }
    catch (e) { toast(e.message, 1); }
    btn.disabled = false; btn.textContent = 'Image'; inp.value = ''; ta.focus();
  });
}
function fieldHTML(f, v) {
  const id = 'f_' + f.k, hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  const wrap = inner => `<label ${f.full ? 'style="grid-column:1/-1"' : ''}>${esc(f.label)}${inner}${hint}</label>`;
  switch (f.type) {
    case 'textarea': return wrap(`<textarea name="${f.k}">${esc(v)}</textarea>`);
    case 'html': return `<label style="grid-column:1/-1">${esc(f.label)}<div class="tb">${[['h2', 'H2'], ['p', 'P'], ['strong', 'B'], ['em', 'I'], ['code', '{ }'], ['blockquote', 'Quote'], ['ul', 'List'], ['a', 'Link']].map(([t, l]) => `<button type="button" data-ins="${t}">${l}</button>`).join('')}<button type="button" data-img>Image</button><input type="file" accept="image/jpeg,image/png,image/webp" data-imgfile hidden></div><textarea name="${f.k}" style="min-height:340px;font-family:var(--mono);font-size:13.5px">${esc(v)}</textarea><span class="hint">Allowed: p, h2, strong, em, code, pre, blockquote, ul/li, a. Scripts are always stripped.</span></label>`;
    case 'number': return wrap(`<input type="number" name="${f.k}" value="${esc(v)}">`);
    case 'date': return wrap(`<input type="date" name="${f.k}" value="${esc(v)}">`);
    case 'bool': return `<label style="flex-direction:row;display:flex;gap:10px;align-items:center;color:#fff"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''} style="width:auto"> ${esc(f.label)}</label>`;
    case 'tags': return wrap(`<input name="${f.k}" value="${esc((v || []).join(', '))}" placeholder="comma, separated">`);
    case 'lines': return wrap(`<textarea name="${f.k}">${esc((v || []).join('\n'))}</textarea>`);
    case 'image': { const round = ['team', 'avatar'].includes(f.kind || 'team'); return `<div style="grid-column:1/-1" class="imgfield" data-kind="${esc(f.kind || 'team')}"><span class="lbl">${esc(f.label)}</span><div class="imgrow"><div class="imgprev ${round ? '' : 'wide'}" data-prev>${v ? `<img src="${esc(imgSrc(v))}" alt="">` : '<span>No photo</span>'}</div><div class="imgbtns"><div class="btnrow"><label class="btn ghost sm filebtn">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" data-file hidden></label><button type="button" class="btn ghost sm" data-clear ${v ? '' : 'hidden'}>Remove photo</button></div><span class="hint" data-msg>${esc(f.hint || 'JPG, PNG or WebP. Large pictures are resized automatically.')}</span></div><input type="hidden" name="${f.k}" value="${esc(v)}"></div></div>`; }
    case 'video': return `<div style="grid-column:1/-1" class="imgfield vidfield" data-kind="video"><span class="lbl">${esc(f.label)}</span><div class="imgrow"><div class="imgprev wide" data-prev>${v ? `<video src="${esc(imgSrc(v))}" muted playsinline preload="metadata"></video>` : '<span>No video</span>'}</div><div class="imgbtns"><div class="btnrow"><label class="btn ghost sm filebtn">Upload video<input type="file" accept="video/mp4,video/webm" data-vfile hidden></label><button type="button" class="btn ghost sm" data-clear ${v ? '' : 'hidden'}>Remove video</button></div><div class="bar" data-bar hidden><i></i></div><span class="hint" data-msg>${esc(f.hint || 'MP4 (H.264) or WebM, up to 50 MB. Short looping clips of 5 to 15 seconds work best.')}</span></div><input type="hidden" name="${f.k}" value="${esc(v)}"></div></div>`;
    case 'select': return wrap(`<select name="${f.k}">${f.opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`);
    default: return wrap(`<input name="${f.k}" value="${esc(v)}">`);
  }
}
function readForm(form, fields, base) {
  const out = {...base};
  for (const f of fields) {
    const el = form.elements[f.k]; if (!el) continue;
    if (f.type === 'bool') out[f.k] = el.checked;
    else if (f.type === 'number') out[f.k] = el.value === '' ? 0 : Number(el.value);
    else if (f.type === 'tags') out[f.k] = el.value.split(',').map(s => s.trim()).filter(Boolean);
    else if (f.type === 'lines') out[f.k] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
    else out[f.k] = el.value;
  }
  return out;
}
function bindToolbar(form) {
  bindInlineImage(form);
  $$('[data-ins]', form).forEach(b => b.addEventListener('click', () => {
    const ta = form.elements.content, t = b.dataset.ins, s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || 'text';
    const map = {h2: `<h2>${sel}</h2>`, p: `<p>${sel}</p>`, strong: `<strong>${sel}</strong>`, em: `<em>${sel}</em>`, code: `<code>${sel}</code>`, blockquote: `<blockquote>${sel}</blockquote>`, ul: `<ul><li>${sel}</li></ul>`, a: `<a href="https://">${sel}</a>`};
    ta.setRangeText(map[t], s, e, 'end'); ta.focus();
  }));
}

/* ---------- views ---------- */
const setHead = (t, s = '', act = '') => { $('#ptitle').textContent = t; $('#psub').textContent = s; $('#pact').innerHTML = act; };

function viewList(key) {
  const sc = SCHEMA[key], items = DB[key] || [];
  setHead(sc.title, sc.sub, `<button class="btn primary sm" id="addBtn">+ Add new</button><button class="btn ghost sm" id="resetBtn" title="Discard edits and restore the built-in content">Restore defaults</button>`);
  $('#panel').innerHTML = `<div class="list">${items.map((it, i) => `<div class="row"><div style="min-width:0"><b>${esc(sc.label(it)) || '(untitled)'}</b><small>${esc(sc.meta(it))}</small></div><div class="acts"><button class="icon-btn" data-up="${i}" title="Move up">↑</button><button class="icon-btn" data-dn="${i}" title="Move down">↓</button><button class="btn ghost sm" data-ed="${i}">Edit</button><button class="btn danger sm" data-del="${i}">Delete</button></div></div>`).join('') || '<p class="muted">Nothing here yet.</p>'}</div>`;
  $('#addBtn').onclick = () => viewEdit(key, -1);
  $('#resetBtn').onclick = async () => { if (!confirm('Discard all your edits to this section and restore the built-in content?')) return; try { await api('reset', {key}); await refresh(); toast('Restored defaults'); go(cur); } catch (e) { toast(e.message, 1); } };
  $$('[data-ed]').forEach(b => b.onclick = () => viewEdit(key, +b.dataset.ed));
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this item?')) return; items.splice(+b.dataset.del, 1); await persist(key, items); viewList(key); });
  $$('[data-up]').forEach(b => b.onclick = async () => { const i = +b.dataset.up; if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; await persist(key, items); viewList(key); } });
  $$('[data-dn]').forEach(b => b.onclick = async () => { const i = +b.dataset.dn; if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; await persist(key, items); viewList(key); } });
}

function viewEdit(key, idx) {
  const sc = SCHEMA[key], items = DB[key], isNew = idx < 0, item = isNew ? sc.blank() : items[idx];
  setHead((isNew ? 'New ' : 'Edit ') + sc.title.replace(/s$/, ''), '', `<button class="btn ghost sm" id="back">← Back to list</button>`);
  $('#back').onclick = () => viewList(key);
  $('#panel').innerHTML = `<form class="card formcard" id="ef"><div class="grid2">${sc.fields.map(f => fieldHTML(f, item[f.k])).join('')}</div><div class="note" id="en"></div><div style="display:flex;gap:10px"><button class="btn primary">${isNew ? 'Create' : 'Save changes'}</button><button type="button" class="btn ghost" id="cancel">Cancel</button></div></form>`;
  const form = $('#ef'); bindToolbar(form); bindImages(form);
  $('#cancel').onclick = () => viewList(key);
  form.onsubmit = async e => {
    e.preventDefault(); const out = readForm(form, sc.fields, item);
    if (key === 'posts' || key === 'services') { out.slug = slugify(out.slug || out.title); if (!out.slug) return toast('A title is required', 1); if (items.some((x, i) => i !== idx && x.slug === out.slug)) return toast('That URL slug already exists', 1); }
    if (isNew) items.unshift(out); else items[idx] = out;
    try { await persist(key, items); toast('Saved. Live on the website now.'); viewList(key); } catch (er) { toast(er.message, 1); }
  };
}

function viewSettings() {
  const s = DB.settings || {}; setHead('Site settings', 'Contact details, social links and headline numbers.');
  const f = (k, l, extra = '') => `<label>${l}<input name="${k}" value="${esc(s[k])}" ${extra}></label>`;
  $('#panel').innerHTML = `<form class="card formcard" id="sf"><div class="grid2">${f('company', 'Company name')}${f('tagline', 'Tagline')}${f('email', 'Contact email')}${f('phone', 'Phone (optional)')}${f('address', 'Address / coverage')}${f('hours', 'Availability')}${f('linkedin', 'LinkedIn URL')}${f('github', 'GitHub URL')}${f('twitter', 'X / Twitter URL')}</div>
  <label>Headline stats <span class="hint">One per line: value | suffix | label</span><textarea name="stats" style="min-height:130px">${esc((s.stats || []).map(x => `${x.value} | ${x.suffix || ''} | ${x.label}`).join('\n'))}</textarea></label>
  <div style="display:flex;gap:10px"><button class="btn primary">Save settings</button></div></form>`;
  $('#sf').onsubmit = async e => {
    e.preventDefault(); const fm = e.target.elements, out = {...s};
    ['company', 'tagline', 'email', 'phone', 'address', 'hours', 'linkedin', 'github', 'twitter'].forEach(k => out[k] = fm[k].value.trim());
    out.stats = fm.stats.value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0] && p[2]).map(p => ({value: Number(p[0]) || 0, suffix: p[1] || '', label: p[2]}));
    try { await persist('settings', out); toast('Settings saved'); } catch (er) { toast(er.message, 1); }
  };
}


async function viewEmail() {
  setHead('Email notifications', 'Choose where contact-form enquiries are emailed, and the mailbox the website sends them from.');
  $('#panel').innerHTML = '<p class="muted">Loading…</p>';
  let c; try { c = await api('mail_get'); } catch (e) { $('#panel').innerHTML = `<div class="note err">${esc(e.message)}</div>`; return; }
  const f = (k, l, extra = '', hint = '') => `<label>${l}<input name="${k}" value="${esc(c[k])}" ${extra}>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  $('#panel').innerHTML = `<div class="warn" style="max-width:880px;${c.configured ? 'background:rgba(52,211,153,.12);color:#6ee7b7' : ''}">${c.configured ? '✓ Authenticated email is configured. Use “Send test email” to confirm.' : '⚠ Not configured yet. Until it is, enquiries are saved under Messages, but emails may not be delivered.'}</div>
  <form class="card formcard" id="mf"><div class="grid2">
    ${f('to', 'Send enquiries to', 'type="email"', 'Any mailbox you read, e.g. support@yourdomain.com')}
    ${f('user', 'Sending mailbox (username)', 'type="email" autocomplete="off"', 'A real mailbox on your domain, e.g. support@yourdomain.com')}
    <label>Mailbox password<input name="pass" type="password" autocomplete="new-password" placeholder="${c.has_pass ? '•••••••• (saved. Leave blank to keep)' : 'Password of that mailbox'}"><span class="hint">Stored only on the server, never shown again.</span></label>
    ${f('from', 'From address (optional)', 'type="email"', 'Leave blank to use the sending mailbox')}
    ${f('host', 'SMTP server', '', 'Hostinger: smtp.hostinger.com')}
    <label>Port and security<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input name="port" type="number" value="${esc(c.port)}"><select name="secure"><option value="ssl" ${c.secure === 'ssl' ? 'selected' : ''}>SSL (port 465)</option><option value="tls" ${c.secure === 'tls' ? 'selected' : ''}>STARTTLS (port 587)</option><option value="none" ${c.secure === 'none' ? 'selected' : ''}>None (testing only)</option></select></div></label>
  </div><div class="note" id="mn"></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary">Save</button><button type="button" class="btn ghost" id="mt">Send test email</button></div></form>`;
  const note = (cls, t) => { const n = $('#mn'); n.className = 'note ' + cls; n.textContent = t; };
  const val = () => Object.fromEntries(new FormData($('#mf')));
  $('#mf').onsubmit = async e => { e.preventDefault(); try { await api('mail_save', val()); toast('Email settings saved'); viewEmail(); } catch (er) { note('err', er.message); } };
  $('#mt').onclick = async () => {
    try { await api('mail_save', val()); note('ok', 'Sending test email…'); const r = await api('mail_test', {});
      r.ok && r.via === 'smtp' ? note('ok', `Test email sent to ${r.to}. Check that mailbox (and its spam folder).`) : note('err', `Not delivered: ${r.error || 'unknown error'}`); }
    catch (er) { note('err', er.message); }
  };
}

async function viewMessages() {
  setHead('Messages', 'Enquiries from the contact form and newsletter sign-ups.');
  $('#panel').innerHTML = '<p class="muted">Loading…</p>';
  try {
    const {messages, subscribers} = await api('messages');
    $('#panel').innerHTML = `<h3 style="margin-bottom:14px">Enquiries (${messages.length})</h3><div class="list">${messages.map(m => `<div class="msg"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(m.name)} <span class="muted" style="font-weight:400">· ${esc(m.company || 'no company')}</span></b><small class="muted">${esc(new Date(m.at).toLocaleString())}</small></div><a class="link" href="mailto:${esc(m.email)}">${esc(m.email)}</a><span class="pill" style="justify-self:start">${esc(m.topic || 'General')}</span><p>${esc(m.message)}</p>${m.mail ? (m.mail.ok && m.mail.via === 'smtp' ? `<small style="color:#6ee7b7">✓ Email notification sent to ${esc(m.mail.to)}</small>` : `<small style="color:#fcd34d">⚠ Email notification ${m.mail.ok ? 'handed to the server, delivery not confirmed' : 'NOT sent'}: ${esc(m.mail.error || '')} <a href="#email" style="text-decoration:underline">Fix email settings</a></small>`) : ''}<div><button class="btn danger sm" data-md="${esc(m.id)}">Delete</button></div></div>`).join('') || '<p class="muted">No messages yet.</p>'}</div>
    <h3 style="margin:36px 0 14px">Newsletter subscribers (${subscribers.length})</h3><div class="list">${subscribers.map(s => `<div class="row"><b>${esc(s.email)}</b><small>${esc(new Date(s.at).toLocaleDateString())}</small></div>`).join('') || '<p class="muted">No subscribers yet.</p>'}</div>`;
    $$('[data-md]').forEach(b => b.onclick = async () => { if (!confirm('Delete this message?')) return; await api('delete_message', {id: b.dataset.md}); viewMessages(); });
  } catch (e) { $('#panel').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
}

async function viewSecurity() {
  setHead('Security', 'Change the admin password and review recent sign-in activity.');
  $('#panel').innerHTML = `${defaultPw ? '<div class="warn" style="max-width:640px">The default password is still active, so the rest of the admin panel is locked. Choose a new password below to continue.</div>' : ''}
  <form class="card formcard" id="pw" style="max-width:640px"><h3>Change password</h3><label>Current password<input type="password" name="current" autocomplete="current-password" required></label><label>New password <span class="hint">At least 12 characters, with letters and numbers. A short phrase of random words works well.</span><input type="password" name="new" autocomplete="new-password" minlength="12" required></label><label>Repeat new password<input type="password" name="again" autocomplete="new-password" required></label><div class="note" id="pn"></div><button class="btn primary" style="justify-self:start">Update password</button></form>
  <div class="card formcard" style="max-width:640px;margin-top:20px"><h3>Recent activity</h3><div id="audit" class="muted">Loading…</div></div>`;
  $('#pw').onsubmit = async e => {
    e.preventDefault(); const f = e.target.elements, n = $('#pn');
    if (f.new.value !== f.again.value) { n.className = 'note err'; n.textContent = 'New passwords do not match'; return; }
    try { const r = await api('passwd', {current: f.current.value, new: f.new.value}); if (r.csrf) csrf = r.csrf; n.className = 'note ok'; n.textContent = 'Password updated. The rest of the admin panel is now available.'; defaultPw = false; $('#warn').hidden = true; e.target.reset(); setTimeout(() => go('dashboard'), 1200); }
    catch (er) { n.className = 'note err'; n.textContent = er.message; }
  };
  if (!defaultPw) {
    try {
      const {events} = await api('audit');
      $('#audit').innerHTML = events.length ? `<div class="list">${events.slice(0, 25).map(x => `<div class="row" style="padding:10px 14px"><div style="min-width:0"><b style="font-size:14px">${esc(x.event)}</b><small>${esc(x.ip)} · ${esc(new Date(x.t).toLocaleString())}</small></div></div>`).join('')}</div>` : 'No activity yet.';
    } catch (e) { $('#audit').textContent = 'Could not load activity.'; }
  } else $('#audit').textContent = 'Available after you change the default password.';
}

async function viewDash() {
  setHead('Dashboard', 'Everything you edit here appears on the public website immediately.');
  let mailWarn = ''; try { const mc = await api('mail_get'); if (!mc.configured) mailWarn = '<div class="warn" style="margin-bottom:22px">⚠ Email notifications are not set up, so enquiries may not reach your inbox. <a href="#email">Set up email</a></div>'; } catch (e) {}
  const c = k => (DB[k] || []).length;
  $('#panel').innerHTML = mailWarn + `<div class="dash">${[['posts', 'Blog posts'], ['services', 'Services'], ['team', 'Team entries'], ['projects', 'Case studies'], ['careers', 'Open roles'], ['technologies', 'Technologies']].map(([k, l]) => `<a class="card" href="#${k}"><b class="grad">${c(k)}</b><span class="muted">${l}</span></a>`).join('')}</div>
  <div class="card formcard"><h3>Quick tips</h3><p class="muted">• Add a blog post under <b>Blog posts → Add new</b>. Use the toolbar to insert headings and quotes.<br>• Edit contact email and social links under <b>Site settings</b>.<br>• Use <b>Restore defaults</b> on any section to undo your changes.<br>• Contact-form enquiries arrive under <b>Messages</b> and are emailed to your contact address.</p></div>`;
}

/* ---------- plumbing ---------- */
async function persist(key, value) { await api('save', {key, value}); DB[key] = value; renderTabs(); }
async function refresh() { DB = await (await fetch(`${API}?a=content`, {cache: 'no-store'})).json(); }
function renderTabs() { $('#tabs').innerHTML = TABS.map(([k, l]) => `<a href="#${k}" class="${k === cur ? 'on' : ''}">${l}${SCHEMA[k] ? `<i>${(DB[k] || []).length}</i>` : ''}</a>`).join(''); }
function go(k) {
  cur = TABS.some(t => t[0] === k) ? k : 'dashboard';
  if (defaultPw && cur !== 'security') { cur = 'security'; if (location.hash !== '#security') history.replaceState(null, '', '#security'); }
  renderTabs();
  if (SCHEMA[cur]) viewList(cur); else ({dashboard: viewDash, settings: viewSettings, email: viewEmail, messages: viewMessages, security: viewSecurity})[cur]();
  scrollTo(0, 0);
}
addEventListener('hashchange', () => $('#app').hidden || go(location.hash.slice(1)));

async function enter(info) {
  csrf = info.csrf; defaultPw = info.defaultPassword; await refresh();
  $('#login').hidden = true; $('#app').hidden = false; $('#warn').hidden = !defaultPw; go(location.hash.slice(1) || 'dashboard');
}
const loginCap = window.IQCaptcha.mount($('#loginCap'), '../api.php');
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target.elements, n = $('#loginNote');
  try { const r = await api('login', {user: f.user.value.trim(), pass: f.pass.value, ...loginCap.values()}); n.className = 'note'; f.pass.value = ''; await enter(r); }
  catch (er) { n.className = 'note err'; n.textContent = er.message; loginCap.reset(); }
};
$('#logout').onclick = async () => { try { await api('logout', {}); } catch (e) {} location.reload(); };
(async () => {
  try { const me = await api('me'); if (me.auth) return enter(me); } catch (e) {}
  $('#login').hidden = false; loginCap.load();
})();
})();
