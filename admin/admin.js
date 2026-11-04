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
    fields: [T('title', 'Title'), T('slug', 'URL slug', {hint: 'Auto-generated from the title if left empty'}), T('category', 'Category'), T('author', 'Author'), {k: 'date', label: 'Date', type: 'date'}, {k: 'read', label: 'Minutes to read', type: 'number'}, {k: 'hue', label: 'Cover colour (0–360)', type: 'number'}, {k: 'featured', label: 'Featured on blog page', type: 'bool'}, {k: 'tags', label: 'Tags', type: 'tags'}, {k: 'excerpt', label: 'Excerpt', type: 'textarea', full: true}, {k: 'content', label: 'Article body (HTML)', type: 'html', full: true}]},
  services: {title: 'Services', sub: 'Service pages and the home-page bento grid.', label: i => i.title, meta: i => i.slug, blank: () => ({slug: '', icon: 'layers', title: '', summary: '', body: '', features: [], tags: []}),
    fields: [T('title', 'Title'), T('slug', 'URL slug'), {k: 'icon', label: 'Icon', type: 'select', opts: ['layers', 'bolt', 'snow', 'flow', 'db', 'server', 'cloud', 'chart', 'globe']}, {k: 'tags', label: 'Tags', type: 'tags'}, {k: 'summary', label: 'Summary', type: 'textarea', full: true}, {k: 'body', label: 'Description', type: 'textarea', full: true}, {k: 'features', label: 'Capabilities (one per line)', type: 'lines', full: true}]},
  team: {title: 'Team', sub: 'People shown on the Team page. Tick “Open role” to show a hiring card.', label: i => i.open ? `${i.role} (open role)` : i.name, meta: i => i.role, blank: () => ({name: '', role: '', bio: '', skills: [], lead: false, open: false, c1: '#22d3ee', c2: '#6366f1'}),
    fields: [T('name', 'Name'), T('role', 'Role'), {k: 'lead', label: 'Large leadership card', type: 'bool'}, {k: 'open', label: 'Open role (hiring card)', type: 'bool'}, T('c1', 'Avatar colour 1', {hint: 'e.g. #22d3ee'}), T('c2', 'Avatar colour 2'), {k: 'skills', label: 'Skills', type: 'tags'}, {k: 'bio', label: 'Bio', type: 'textarea', full: true}]},
  technologies: {title: 'Technologies', sub: 'Tiles on the Technologies page and the marquee.', label: i => i.name, meta: i => i.group, blank: () => ({name: '', mono: '', color: 'linear-gradient(135deg,#22d3ee,#6366f1)', desc: '', group: 'Platform'}),
    fields: [T('name', 'Name'), T('mono', 'Short mark (2–3 letters)'), T('group', 'Group'), T('desc', 'One-line description'), T('color', 'CSS gradient', {full: true})]},
  projects: {title: 'Case studies', sub: 'Engagement stories. Use only approved client information.', label: i => i.title, meta: i => i.industry, blank: () => ({title: '', industry: '', challenge: '', solution: '', results: [], tech: []}),
    fields: [T('title', 'Title', {full: true}), T('industry', 'Industry'), {k: 'tech', label: 'Technologies', type: 'tags'}, {k: 'challenge', label: 'Challenge', type: 'textarea', full: true}, {k: 'solution', label: 'Solution', type: 'textarea', full: true}, {k: 'results', label: 'Results (one per line)', type: 'lines', full: true}]},
  careers: {title: 'Careers', sub: 'Open positions on the Careers page.', label: i => i.title, meta: i => i.type, blank: () => ({title: '', type: 'Contract · Remote', level: 'Senior', location: 'Worldwide', summary: ''}),
    fields: [T('title', 'Job title', {full: true}), T('type', 'Type'), T('level', 'Level'), T('location', 'Location'), {k: 'summary', label: 'Summary', type: 'textarea', full: true}]},
  testimonials: {title: 'Testimonials', sub: 'Replace the sample quotes with real, approved feedback.', label: i => i.name, meta: i => i.role, blank: () => ({quote: '', name: '', role: ''}),
    fields: [T('name', 'Name / title'), T('role', 'Company'), {k: 'quote', label: 'Quote', type: 'textarea', full: true}]},
  faqs: {title: 'FAQs', sub: 'Shown on the home, services and FAQ pages.', label: i => i.q, meta: () => '', blank: () => ({q: '', a: ''}), fields: [T('q', 'Question', {full: true}), {k: 'a', label: 'Answer', type: 'textarea', full: true}]},
  industries: {title: 'Industries', sub: '', label: i => i.title, meta: () => '', blank: () => ({title: '', text: ''}), fields: [T('title', 'Industry'), {k: 'text', label: 'Description', type: 'textarea', full: true}]},
  process: {title: 'Process steps', sub: 'The “How we work” timeline.', label: i => `${i.n} · ${i.title}`, meta: () => '', blank: () => ({n: '', title: '', text: ''}), fields: [T('n', 'Number (e.g. 06)'), T('title', 'Title'), {k: 'text', label: 'Description', type: 'textarea', full: true}]},
  values: {title: 'Company values', sub: '', label: i => i.title, meta: () => '', blank: () => ({title: '', text: ''}), fields: [T('title', 'Title'), {k: 'text', label: 'Description', type: 'textarea', full: true}]},
  timeline: {title: 'Timeline', sub: 'Our story on the About page.', label: i => i.title, meta: i => i.year, blank: () => ({year: '', title: '', text: ''}), fields: [T('year', 'Label / year'), T('title', 'Title'), {k: 'text', label: 'Description', type: 'textarea', full: true}]}
};
const TABS = [['dashboard', 'Dashboard'], ['posts', 'Blog posts'], ['services', 'Services'], ['team', 'Team'], ['technologies', 'Technologies'], ['projects', 'Case studies'], ['careers', 'Careers'], ['testimonials', 'Testimonials'], ['faqs', 'FAQs'], ['industries', 'Industries'], ['process', 'Process'], ['values', 'Values'], ['timeline', 'Timeline'], ['settings', 'Site settings'], ['messages', 'Messages'], ['security', 'Security']];

/* ---------- field rendering ---------- */
function fieldHTML(f, v) {
  const id = 'f_' + f.k, hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  const wrap = inner => `<label ${f.full ? 'style="grid-column:1/-1"' : ''}>${esc(f.label)}${inner}${hint}</label>`;
  switch (f.type) {
    case 'textarea': return wrap(`<textarea name="${f.k}">${esc(v)}</textarea>`);
    case 'html': return `<label style="grid-column:1/-1">${esc(f.label)}<div class="tb">${[['h2', 'H2'], ['p', 'P'], ['strong', 'B'], ['em', 'I'], ['code', '{ }'], ['blockquote', 'Quote'], ['ul', 'List'], ['a', 'Link']].map(([t, l]) => `<button type="button" data-ins="${t}">${l}</button>`).join('')}</div><textarea name="${f.k}" style="min-height:340px;font-family:var(--mono);font-size:13.5px">${esc(v)}</textarea><span class="hint">Allowed: p, h2, strong, em, code, pre, blockquote, ul/li, a. Scripts are always stripped.</span></label>`;
    case 'number': return wrap(`<input type="number" name="${f.k}" value="${esc(v)}">`);
    case 'date': return wrap(`<input type="date" name="${f.k}" value="${esc(v)}">`);
    case 'bool': return `<label style="flex-direction:row;display:flex;gap:10px;align-items:center;color:#fff"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''} style="width:auto"> ${esc(f.label)}</label>`;
    case 'tags': return wrap(`<input name="${f.k}" value="${esc((v || []).join(', '))}" placeholder="comma, separated">`);
    case 'lines': return wrap(`<textarea name="${f.k}">${esc((v || []).join('\n'))}</textarea>`);
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
  const form = $('#ef'); bindToolbar(form);
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

async function viewMessages() {
  setHead('Messages', 'Enquiries from the contact form and newsletter sign-ups.');
  $('#panel').innerHTML = '<p class="muted">Loading…</p>';
  try {
    const {messages, subscribers} = await api('messages');
    $('#panel').innerHTML = `<h3 style="margin-bottom:14px">Enquiries (${messages.length})</h3><div class="list">${messages.map(m => `<div class="msg"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(m.name)} <span class="muted" style="font-weight:400">· ${esc(m.company || 'no company')}</span></b><small class="muted">${esc(new Date(m.at).toLocaleString())}</small></div><a class="link" href="mailto:${esc(m.email)}">${esc(m.email)}</a><span class="pill" style="justify-self:start">${esc(m.topic || 'General')}</span><p>${esc(m.message)}</p><div><button class="btn danger sm" data-md="${esc(m.id)}">Delete</button></div></div>`).join('') || '<p class="muted">No messages yet.</p>'}</div>
    <h3 style="margin:36px 0 14px">Newsletter subscribers (${subscribers.length})</h3><div class="list">${subscribers.map(s => `<div class="row"><b>${esc(s.email)}</b><small>${esc(new Date(s.at).toLocaleDateString())}</small></div>`).join('') || '<p class="muted">No subscribers yet.</p>'}</div>`;
    $$('[data-md]').forEach(b => b.onclick = async () => { if (!confirm('Delete this message?')) return; await api('delete_message', {id: b.dataset.md}); viewMessages(); });
  } catch (e) { $('#panel').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
}

function viewSecurity() {
  setHead('Security', 'Change the admin password.');
  $('#panel').innerHTML = `<form class="card formcard" id="pw" style="max-width:520px"><label>Current password<input type="password" name="current" autocomplete="current-password" required></label><label>New password <span class="hint">At least 8 characters</span><input type="password" name="new" autocomplete="new-password" minlength="8" required></label><label>Repeat new password<input type="password" name="again" autocomplete="new-password" required></label><div class="note" id="pn"></div><button class="btn primary" style="justify-self:start">Update password</button></form>`;
  $('#pw').onsubmit = async e => {
    e.preventDefault(); const f = e.target.elements, n = $('#pn');
    if (f.new.value !== f.again.value) { n.className = 'note err'; n.textContent = 'New passwords do not match'; return; }
    try { await api('passwd', {current: f.current.value, new: f.new.value}); n.className = 'note ok'; n.textContent = 'Password updated.'; defaultPw = false; $('#warn').hidden = true; e.target.reset(); } catch (er) { n.className = 'note err'; n.textContent = er.message; }
  };
}

function viewDash() {
  setHead('Dashboard', 'Everything you edit here appears on the public website immediately.');
  const c = k => (DB[k] || []).length;
  $('#panel').innerHTML = `<div class="dash">${[['posts', 'Blog posts'], ['services', 'Services'], ['team', 'Team entries'], ['projects', 'Case studies'], ['careers', 'Open roles'], ['technologies', 'Technologies']].map(([k, l]) => `<a class="card" href="#${k}"><b class="grad">${c(k)}</b><span class="muted">${l}</span></a>`).join('')}</div>
  <div class="card formcard"><h3>Quick tips</h3><p class="muted">• Add a blog post under <b>Blog posts → Add new</b>. Use the toolbar to insert headings and quotes.<br>• Edit contact email and social links under <b>Site settings</b>.<br>• Use <b>Restore defaults</b> on any section to undo your changes.<br>• Contact-form enquiries arrive under <b>Messages</b> and are emailed to your contact address.</p></div>`;
}

/* ---------- plumbing ---------- */
async function persist(key, value) { await api('save', {key, value}); DB[key] = value; renderTabs(); }
async function refresh() { DB = await (await fetch(`${API}?a=content`, {cache: 'no-store'})).json(); }
function renderTabs() { $('#tabs').innerHTML = TABS.map(([k, l]) => `<a href="#${k}" class="${k === cur ? 'on' : ''}">${l}${SCHEMA[k] ? `<i>${(DB[k] || []).length}</i>` : ''}</a>`).join(''); }
function go(k) {
  cur = TABS.some(t => t[0] === k) ? k : 'dashboard'; renderTabs();
  if (SCHEMA[cur]) viewList(cur); else ({dashboard: viewDash, settings: viewSettings, messages: viewMessages, security: viewSecurity})[cur]();
  scrollTo(0, 0);
}
addEventListener('hashchange', () => $('#app').hidden || go(location.hash.slice(1)));

async function enter(info) {
  csrf = info.csrf; defaultPw = info.defaultPassword; await refresh();
  $('#login').hidden = true; $('#app').hidden = false; $('#warn').hidden = !defaultPw; go(location.hash.slice(1) || 'dashboard');
}
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target.elements, n = $('#loginNote');
  try { const r = await api('login', {user: f.user.value.trim(), pass: f.pass.value}); n.className = 'note'; await enter(r); } catch (er) { n.className = 'note err'; n.textContent = er.message; }
};
$('#logout').onclick = async () => { try { await api('logout', {}); } catch (e) {} location.reload(); };
(async () => {
  try { const me = await api('me'); if (me.auth) return enter(me); } catch (e) {}
  $('#login').hidden = false;
})();
})();
