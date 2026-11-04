/* Demo mode: emulates api.php in the browser (localStorage) so the site can be tested without PHP. Preview builds only. */
(() => {
  const real = window.fetch.bind(window);
  const defaultsURL = new URL('../../data/defaults.json', document.currentScript.src).href;
  const KEY = 'iq_demo_v1';
  let mem = null, authed = false;
  const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { mem = {}; } return mem; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'Content-Type': 'application/json'}});
  const COLS = ['settings','services','technologies','process','industries','team','posts','projects','careers','testimonials','faqs','values','timeline'];
  const clean = (s, n = 4000) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, n);
  const isAuth = () => { try { return authed || sessionStorage.getItem('iq_demo_ok') === '1'; } catch (e) { return authed; } };
  const setAuth = v => { authed = v; try { v ? sessionStorage.setItem('iq_demo_ok', '1') : sessionStorage.removeItem('iq_demo_ok'); } catch (e) {} };
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const m = url.match(/api\.php\?a=([a-z_]+)/);
    if (!m) return real(input, init);
    const a = m[1], st = load();
    let body = {}; try { body = JSON.parse(init.body || '{}'); } catch (e) {}
    const need = () => isAuth() ? null : json({error: 'Unauthorized'}, 401);
    switch (a) {
      case 'content': { const d = await (await real(defaultsURL)).json(); const o = st.content || {}; COLS.forEach(k => { if (k in o) d[k] = o[k]; }); return json(d); }
      case 'contact': {
        if (body.hp) return json({ok: true});
        const name = clean(body.name, 120), email = clean(body.email, 160), msg = clean(body.message, 5000);
        if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || msg.length < 10) return json({error: 'Please provide your name, a valid email and a message (10+ characters).'}, 422);
        (st.messages = st.messages || []).unshift({mail: {ok: false, via: 'none', error: 'Demo mode: no email is sent', to: ''}, id: Math.random().toString(16).slice(2, 12), at: new Date().toISOString(), name, email, company: clean(body.company, 160), topic: clean(body.topic, 120), message: msg}); save(); return json({ok: true});
      }
      case 'subscribe': { const e = clean(body.email, 160); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({error: 'Enter a valid email address.'}, 422); st.subs = st.subs || []; if (!st.subs.some(s => s.email === e)) st.subs.push({email: e, at: new Date().toISOString()}); save(); return json({ok: true}); }
      case 'login': if (body.user === 'admin' && body.pass === (st.pw || 'admin')) { setAuth(true); return json({ok: true, csrf: 'demo', defaultPassword: !st.pw}); } return json({error: 'Invalid user id or password'}, 401);
      case 'me': return isAuth() ? json({auth: true, csrf: 'demo', defaultPassword: !st.pw}) : json({auth: false});
      case 'logout': setAuth(false); return json({ok: true});
      case 'save': { const x = need(); if (x) return x; if (!COLS.includes(body.key) || typeof body.value !== 'object') return json({error: 'Invalid data'}, 422); (st.content = st.content || {})[body.key] = body.value; save(); return json({ok: true}); }
      case 'reset': { const x = need(); if (x) return x; if (st.content) delete st.content[body.key]; save(); return json({ok: true}); }
      case 'messages': { const x = need(); if (x) return x; return json({messages: st.messages || [], subscribers: st.subs || []}); }
      case 'delete_message': { const x = need(); if (x) return x; st.messages = (st.messages || []).filter(mm => mm.id !== body.id); save(); return json({ok: true}); }
      case 'mail_get': { const x = need(); if (x) return x; const c = st.mail || {}; return json({host: c.host || 'smtp.hostinger.com', port: c.port || 465, secure: c.secure || 'ssl', user: c.user || '', from: c.from || '', to: c.to || 'support@intellytiqsolutions.com', has_pass: !!c.pass, configured: !!(c.host && c.user && c.pass)}); }
      case 'mail_save': { const x = need(); if (x) return x; const o = st.mail || {}; st.mail = {host: body.host, port: body.port, secure: body.secure, user: body.user, from: body.from, to: body.to, pass: body.pass || o.pass || ''}; save(); return json({ok: true}); }
      case 'mail_test': { const x = need(); if (x) return x; return json({ok: false, via: 'none', error: 'Demo mode cannot send real email. Email works on the live PHP server (Admin > Email there).', to: (st.mail || {}).to || ''}); }
      case 'passwd': { const x = need(); if (x) return x; if (body.current !== (st.pw || 'admin')) return json({error: 'Current password is incorrect'}, 403); if (String(body.new || '').length < 8) return json({error: 'New password must be at least 8 characters'}, 422); st.pw = body.new; save(); return json({ok: true}); }
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
