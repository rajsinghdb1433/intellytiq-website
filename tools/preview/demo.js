/* Demo mode: emulates api.php in the browser (localStorage) so the site can be tested without PHP. Preview builds only. */
(() => {
  window.__IQ_DEMO = true;
  const real = window.fetch.bind(window);
  const defaultsURL = new URL('../../data/defaults.json', document.currentScript.src).href;
  const KEY = 'iq_demo_v1';
  let mem = null, authed = false;
  const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { mem = {}; } return mem; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'Content-Type': 'application/json'}});
  const COLS = ['settings','services','technologies','process','industries','team','posts','projects','careers','testimonials','faqs','values','timeline','videos','companies'];
  const clean = (s, n = 4000) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, n);
  const isAuth = () => { try { return authed || sessionStorage.getItem('iq_demo_ok') === '1'; } catch (e) { return authed; } };
  const setAuth = v => { authed = v; try { v ? sessionStorage.setItem('iq_demo_ok', '1') : sessionStorage.removeItem('iq_demo_ok'); } catch (e) {} };
  const caps = {};
  const capGen = text => {
    const id = Math.random().toString(36).slice(2);
    if (text) { const a = 3 + Math.floor(Math.random() * 15), b = 2 + Math.floor(Math.random() * 8); caps[id] = {ans: String(a + b), t: Date.now()}; return {token: id, question: `What is ${a} + ${b}?`, type: 'text'}; }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const c = document.createElement('canvas'); c.width = 200; c.height = 70; const x = c.getContext('2d'); x.fillStyle = '#f3f5ff'; x.fillRect(0, 0, 200, 70);
    for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(80,90,200,.35)'; x.beginPath(); x.moveTo(Math.random() * 200, Math.random() * 70); x.lineTo(Math.random() * 200, Math.random() * 70); x.stroke(); }
    x.font = 'bold 36px serif'; for (let i = 0; i < 5; i++) { x.save(); x.translate(18 + i * 34, 50 + Math.random() * 6); x.rotate((Math.random() - .5) * .5); x.fillStyle = `hsl(${220 + Math.random() * 60},60%,30%)`; x.fillText(code[i], 0, 0); x.restore(); }
    caps[id] = {ans: code, t: Date.now()}; return {token: id, image: c.toDataURL('image/png'), type: 'image'};
  };
  const capOk = b => { const k = caps[b.captcha_token]; delete caps[b.captcha_token]; return !!k && Date.now() - k.t > 1500 && String(b.captcha_answer || '').replace(/\s+/g, '').toUpperCase() === k.ans; };
  const capBad = () => json({error: 'The security code was not correct. Please try the new code.', captcha: true}, 422);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const m = url.match(/api\.php\?a=([a-z_]+)/);
    if (!m) return real(input, init);
    const a = m[1], st = load();
    let body = {}; try { body = JSON.parse(init.body || '{}'); } catch (e) {}
    const need = (allowDefault) => !isAuth() ? json({error: 'Unauthorized'}, 401) : (!allowDefault && !st.pw ? json({error: 'Change the default password first (Security tab).', code: 'default_password'}, 403) : null);
    switch (a) {
      case 'captcha': return json(capGen(/type=text/.test(url)));
      case 'content': { const d = await (await real(defaultsURL)).json(); const o = st.content || {}; COLS.forEach(k => { if (k in o) d[k] = o[k]; }); return json(d); }
      case 'contact': {
        if (body.hp) return json({ok: true});
        const name = clean(body.name, 120), email = clean(body.email, 160), msg = clean(body.message, 5000);
        if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || msg.length < 10) return json({error: 'Please provide your name, a valid email and a message (10+ characters).'}, 422);
        if (!capOk(body)) return capBad();
        (st.messages = st.messages || []).unshift({mail: {ok: false, via: 'none', error: 'Demo mode: no email is sent', to: ''}, id: Math.random().toString(16).slice(2, 12), at: new Date().toISOString(), name, email, company: clean(body.company, 160), topic: clean(body.topic, 120), message: msg}); save(); return json({ok: true});
      }
      case 'subscribe': { const e = clean(body.email, 160); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({error: 'Enter a valid email address.'}, 422); if (!capOk(body)) return capBad(); st.subs = st.subs || []; if (!st.subs.some(s => s.email === e)) st.subs.push({email: e, at: new Date().toISOString()}); save(); return json({ok: true}); }
      case 'login': if (!capOk(body)) return capBad(); if (body.user === 'admin' && body.pass === (st.pw || 'admin')) { setAuth(true); return json({ok: true, csrf: 'demo', defaultPassword: !st.pw}); } return json({error: 'Invalid user id or password'}, 401);
      case 'me': return isAuth() ? json({auth: true, csrf: 'demo', defaultPassword: !st.pw}) : json({auth: false});
      case 'logout': setAuth(false); return json({ok: true});
      case 'save': { const x = need(); if (x) return x; if (!COLS.includes(body.key) || typeof body.value !== 'object') return json({error: 'Invalid data'}, 422); (st.content = st.content || {})[body.key] = body.value; save(); return json({ok: true}); }
      case 'reset': { const x = need(); if (x) return x; if (st.content) delete st.content[body.key]; save(); return json({ok: true}); }
      case 'messages': { const x = need(); if (x) return x; return json({messages: st.messages || [], subscribers: st.subs || []}); }
      case 'delete_message': { const x = need(); if (x) return x; st.messages = (st.messages || []).filter(mm => mm.id !== body.id); save(); return json({ok: true}); }
      case 'mail_get': { const x = need(); if (x) return x; const c = st.mail || {}; return json({host: c.host || 'smtp.hostinger.com', port: c.port || 465, secure: c.secure || 'ssl', user: c.user || '', from: c.from || '', to: c.to || 'support@intellytiqsolutions.com', has_pass: !!c.pass, configured: !!(c.host && c.user && c.pass)}); }
      case 'mail_save': { const x = need(); if (x) return x; const o = st.mail || {}; st.mail = {host: body.host, port: body.port, secure: body.secure, user: body.user, from: body.from, to: body.to, pass: body.pass || o.pass || ''}; save(); return json({ok: true}); }
      case 'mail_test': { const x = need(); if (x) return x; return json({ok: false, via: 'none', error: 'Demo mode cannot send real email. Email works on the live PHP server (Admin > Email there).', to: (st.mail || {}).to || ''}); }
      case 'passwd': { const x = need(true); if (x) return x; if (body.current !== (st.pw || 'admin')) return json({error: 'Current password is incorrect'}, 403); const nw = String(body.new || ''); if (nw.length < 12) return json({error: 'The new password must be at least 12 characters.'}, 422); if (!/[A-Za-z]/.test(nw) || !/\d/.test(nw)) return json({error: 'Use both letters and numbers in the new password.'}, 422); if (nw.toLowerCase() === 'admin' || nw === body.current) return json({error: 'Choose a password that is different from the current one.'}, 422); st.pw = nw; save(); return json({ok: true, csrf: 'demo'}); }
      case 'upload': { const x = need(); if (x) return x; if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(body.data || ''))) return json({error: 'Please choose a JPG, PNG or WebP image.'}, 422); return json({ok: true, url: body.data}); }
      case 'upload_video_start': { const x = need(); if (x) return x; if ((body.size || 0) > 1500000) return json({error: 'Demo mode only keeps videos up to 1.5 MB. The real site accepts up to 50 MB.'}, 413); const id = Math.random().toString(16).slice(2, 18).padEnd(16, '0'); (window.__vid = window.__vid || {})[id] = []; return json({ok: true, id, chunk: 524288}); }
      case 'upload_video_chunk': { const x = need(); if (x) return x; const b = (window.__vid || {})[body.id]; if (!b) return json({error: 'Upload not found. Please start again.'}, 404); b.push(atob(body.data)); return json({ok: true, received: b.reduce((n, t) => n + t.length, 0)}); }
      case 'upload_video_finish': { const x = need(); if (x) return x; const b = (window.__vid || {})[body.id]; if (!b) return json({error: 'Upload not found. Please start again.'}, 404); delete window.__vid[body.id]; return json({ok: true, url: 'data:video/mp4;base64,' + btoa(b.join(''))}); }
      case 'audit': { const x = need(); if (x) return x; return json({events: [{t: new Date().toISOString(), ip: 'demo', event: 'login success'}]}); }
    }
    return json({error: 'Not found'}, 404);
  };
  addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;display:flex;gap:10px;align-items:center;padding:8px 8px 8px 14px;border-radius:99px;background:#fff;color:#111;font:600 12.5px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
    b.innerHTML = 'Demo mode: edits stay in this browser <button style="border:0;border-radius:99px;background:#111;color:#fff;padding:6px 12px;font:inherit;cursor:pointer">Reset demo</button>';
    b.querySelector('button').onclick = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem('iq_demo_ok'); } catch (e) {} mem = {}; authed = false; location.reload(); };
    document.body.appendChild(b);
  });
})();
