const { chromium } = require('playwright');
const SP = process.argv[2];
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', async route => { const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': CSP } }); });
  const errs = [], csp = [];
  const watch = (pg, tag) => { pg.on('pageerror', e => errs.push(tag + ': ' + e.message)); pg.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) csp.push(tag + ': ' + t.slice(0, 140)); else if (m.type() === 'error' && !/401|403|422|429|favicon/.test(t)) errs.push(tag + ': ' + t.slice(0, 140)); }); };
  const B = 'http://127.0.0.1:8080/';
  const solveText = async (pg, scope) => {
    await pg.click(`${scope} .cap-t`); await pg.waitForSelector(`${scope} .cap-q`); await pg.waitForTimeout(2300);
    const q = await pg.textContent(`${scope} .cap-q`); const m = q.match(/(\d+) ([+\-×]) (\d+)/); const a = +m[1], o = m[2], c = +m[3];
    return String(o === '+' ? a + c : o === '-' ? a - c : a * c);
  };

  // 1) every public page loads under the strict CSP with no violations
  const pages = ['index', 'about', 'services', 'technologies', 'team', 'blog', 'contact', 'careers', 'case-studies', 'engagement', 'faq', 'industries', 'privacy', 'terms', '404'];
  const pg = await ctx.newPage(); watch(pg, 'page');
  for (const p of pages) { await pg.goto(`${B}${p}.html`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(500); }
  await pg.goto(B + 'services.html', { waitUntil: 'networkidle' }); await pg.locator('button.tile[data-tech]').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(700); await pg.locator('button.tile[data-tech]').first().click(); await pg.waitForSelector('.tmodal.open'); await pg.keyboard.press('Escape');
  await pg.goto(B + 'post.html?p=snowflake-cost-optimisation-playbook', { waitUntil: 'networkidle' });
  console.log('1) all pages + tech popup under strict CSP: done');

  // 2) contact form with CAPTCHA
  await pg.goto(B + 'contact.html', { waitUntil: 'networkidle' });
  console.log('2) captcha hidden until interaction:', await pg.locator('form[data-contact] [data-captcha]').isHidden());
  await pg.fill('[name=name]', 'UI Tester'); await pg.waitForSelector('form[data-contact] .cap-img img');
  console.log('   image captcha shown after focus:', await pg.locator('form[data-contact] .cap-img img').count() === 1);
  await pg.screenshot({ path: `/tmp/iq-shot.png`, fullPage: true });
  await pg.fill('[name=email]', 'ui@example.com'); await pg.fill('[name=message]', 'Testing the form with the security code.');
  await pg.click('button[type=submit]'); await pg.waitForTimeout(600); console.log('   submit with empty code blocked:', (await pg.locator('.note.ok').count()) === 0 && await pg.evaluate(() => document.querySelector('form[data-contact] .cap-in').matches(':invalid')));
  await pg.waitForSelector('form[data-contact] .cap-img img'); const ans = await solveText(pg, 'form[data-contact]'); await pg.fill('form[data-contact] .cap-in', ans); await pg.click('button[type=submit]');
  await pg.waitForSelector('.note.ok'); console.log('   correct answer accepted:', (await pg.textContent('.note')).includes('Thank you'));

  // 3) newsletter box in the footer
  await pg.goto(B + 'about.html', { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  await pg.locator('footer .subscribe input').scrollIntoViewIfNeeded(); await pg.focus('footer .subscribe input');
  await pg.waitForSelector('footer .cap-slot:not([hidden]) .cap-img'); console.log('3) footer newsletter shows CAPTCHA on focus: true');
  await pg.fill('footer .subscribe input', 'news@example.com'); const a2 = await solveText(pg, 'footer'); await pg.fill('footer .cap-in', a2); await pg.click('footer .subscribe button');
  await pg.waitForFunction(() => /in\. Thank you/.test(document.getElementById('subMsg').textContent)); console.log('   newsletter subscription accepted: true');
  await pg.screenshot({ path: `/tmp/iq-shot.png` });

  // 4) admin: login CAPTCHA, locked until the default password is changed
  const ap = await ctx.newPage(); watch(ap, 'admin');
  await ap.goto(B + 'admin/', { waitUntil: 'networkidle' }); await ap.waitForSelector('#loginCap .cap-img img');
  await ap.screenshot({ path: `/tmp/iq-shot.png` });
  await ap.fill('[name=user]', 'admin'); await ap.fill('[name=pass]', 'admin'); await ap.click('#loginForm button.btn');
  await ap.waitForTimeout(500); console.log('4) login without a code is blocked:', await ap.evaluate(() => document.querySelector('#loginCap .cap-in').matches(':invalid')) && !(await ap.isVisible('#app')));
  await ap.waitForSelector('#loginCap .cap-img img'); const a3 = await solveText(ap, '#loginCap'); await ap.fill('#loginCap .cap-in', a3); await ap.fill('[name=pass]', 'admin'); await ap.click('#loginForm button.btn');
  await ap.waitForSelector('#app:not([hidden])'); await ap.waitForTimeout(500);
  console.log('   lands on Security tab while default password is active:', (await ap.textContent('#ptitle')) === 'Security');
  await ap.click('#tabs a[href="#posts"]'); await ap.waitForTimeout(400); console.log('   other tabs stay locked:', (await ap.textContent('#ptitle')) === 'Security');
  await ap.screenshot({ path: `/tmp/iq-shot.png` });
  await ap.fill('#pw [name=current]', 'admin'); await ap.fill('#pw [name=new]', 'short'); await ap.fill('#pw [name=again]', 'short'); await ap.click('#pw button'); await ap.waitForTimeout(400);
  await ap.fill('#pw [name=new]', 'Brand-New-Secret-99'); await ap.fill('#pw [name=again]', 'Brand-New-Secret-99'); await ap.click('#pw button'); await ap.waitForSelector('#pn.ok'); await ap.waitForTimeout(1700);
  console.log('   password changed, panel unlocked:', (await ap.textContent('#ptitle')) === 'Dashboard');
  await ap.click('#tabs a[href="#posts"]'); await ap.waitForSelector('#addBtn'); console.log('   editing works after change: true');
  await ap.click('#tabs a[href="#security"]'); await ap.waitForSelector('#audit .row'); console.log('   activity log visible:', await ap.locator('#audit .row').count() > 0);

  console.log('\nCSP violations:', csp.length ? '\n' + csp.join('\n') : 'none');
  console.log('JS errors:', errs.length ? '\n' + errs.join('\n') : 'none');
  await b.close();
})().catch(e => { console.error('TEST ERROR:', e.message); process.exit(1); });
