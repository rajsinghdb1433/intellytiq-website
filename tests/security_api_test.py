import json, re, time, base64, urllib.request, urllib.error, http.cookiejar, sys, os

BASE = 'http://127.0.0.1:8080'
ROOT = '/home/user/intellytiq-website'
fails = []

_n = [0]
def mk(ip=None):
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    _n[0] += 1
    op.addheaders = [('X-Real-IP', ip or f'10.9.{_n[0] // 250}.{_n[0] % 250 + 1}')]
    return op

def call(op, a, body=None, method=None, headers=None, raw=None, ctype='application/json'):
    url = f'{BASE}/api.php?a={a}'
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method or ('POST' if data is not None else 'GET'))
    if data is not None and ctype: req.add_header('Content-Type', ctype)
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        r = op.open(req, timeout=20); code = r.status; txt = r.read().decode()
    except urllib.error.HTTPError as e:
        code = e.code; txt = e.read().decode()
    try: return code, json.loads(txt)
    except Exception: return code, {'_raw': txt}

def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)

def text_captcha(op, wait=2.2):
    c, j = call(op, 'captcha&type=text')
    m = re.search(r'(\d+) ([+\-×]) (\d+)', j['question'])
    a, o, b = int(m[1]), m[2], int(m[3])
    ans = a + b if o == '+' else a - b if o == '-' else a * b
    time.sleep(wait)
    return {'captcha_token': j['token'], 'captcha_answer': str(ans)}

anon = mk()

# ---- CAPTCHA basics ----
c, j = call(anon, 'captcha')
check('image captcha is served', c == 200 and j.get('image', '').startswith('data:image/png;base64,') and len(j['image']) > 1500)
png = base64.b64decode(j['image'].split(',')[1]); check('captcha is a real PNG', png[:8] == b'\x89PNG\r\n\x1a\n')
pass
check('token holds only time, nonce and signature (no answer)', bool(re.fullmatch(r'\\d+\\|[a-f0-9]{16}\\|[a-f0-9]{64}', base64.urlsafe_b64decode(j['token'] + '==').decode())))

form = {'name': 'Test Visitor', 'email': 'visitor@example.com', 'company': 'ACME', 'topic': 'Fabric', 'message': 'Hello, we need a Fabric architect for a project.'}
c, j = call(anon, 'contact', form); check('contact without CAPTCHA is rejected', c == 422 and j.get('captcha'), f'{c} {j}')
c, j = call(anon, 'contact', {**form, 'captcha_token': 'x', 'captcha_answer': 'y'}); check('contact with forged token is rejected', c == 422)
cap = text_captcha(anon); c, j = call(anon, 'contact', {**form, **cap}); check('contact with a correct CAPTCHA succeeds', c == 200 and j.get('ok'), f'{c} {j}')
c, j = call(anon, 'contact', {**form, **cap}); check('the same CAPTCHA cannot be replayed', c == 422, f'{c}')
anon = mk(); cap = text_captcha(anon); cap['captcha_answer'] = '9999'; c, j = call(anon, 'contact', {**form, **cap}); check('wrong CAPTCHA answer is rejected', c == 422)
cap = text_captcha(anon, wait=0); c, j = call(anon, 'contact', {**form, **cap}); check('instant (bot-speed) answers are rejected', c == 422, f'{c}')
anon = mk(); cap = text_captcha(anon); c, j = call(anon, 'contact', {**form, **cap, 'email': 'not-an-email'}); check('invalid email rejected before CAPTCHA is consumed', c == 422 and not j.get('captcha'))
c, j = call(anon, 'contact', {**form, 'hp': 'bot'}); check('honeypot silently swallowed', c == 200)
c, j = call(anon, 'subscribe', {'email': 'a@example.com'}); check('subscribe without CAPTCHA is rejected', c == 422 and j.get('captcha'))
cap = text_captcha(anon); c, j = call(anon, 'subscribe', {'email': 'a@example.com', **cap}); check('subscribe with CAPTCHA succeeds', c == 200)

# ---- request guards ----
c, j = call(anon, 'contact', raw=b'name=a&email=b', ctype='application/x-www-form-urlencoded'); check('form-encoded POST rejected (415)', c == 415, str(c))
cap = text_captcha(anon); c, j = call(anon, 'contact', {**form, **cap}, headers={'Origin': 'https://evil.example'}); check('cross-origin POST rejected (403)', c == 403, str(c))
c, j = call(anon, 'contact', {**form}, headers={'Sec-Fetch-Site': 'cross-site'}); check('Sec-Fetch-Site cross-site rejected', c == 403, str(c))
c, j = call(anon, 'contact', method='DELETE', raw=b'{}'); check('DELETE method rejected', c == 405, str(c))
c, j = call(anon, 'contact', raw=b'{' + b'"message":"' + b'A' * 30000 + b'"}'); check('oversized public body rejected (413)', c == 413, str(c))
for ep in ['save', 'messages', 'audit', 'mail_get', 'mail_save', 'mail_test', 'delete_message', 'reset', 'passwd']:
    c, j = call(anon, ep, {} if ep not in ('messages', 'audit', 'mail_get') else None)
    check(f'admin endpoint "{ep}" requires login', c == 401, str(c))

# ---- login, default-password lock, password policy ----
adm = mk()
c, j = call(adm, 'login', {'user': 'admin', 'pass': 'admin'}); check('login without CAPTCHA rejected', c == 422 and j.get('captcha'))
cap = text_captcha(adm); c, j = call(adm, 'login', {'user': 'admin', 'pass': 'wrongpass', **cap}); check('wrong password rejected', c == 401)
cap = text_captcha(adm); c, j = call(adm, 'login', {'user': 'admin', 'pass': 'admin', **cap}); check('login with default credentials works', c == 200 and j.get('defaultPassword') is True, str(j)); csrf = j.get('csrf', '')
H = {'X-CSRF-Token': csrf}
c, j = call(adm, 'save', {'key': 'faqs', 'value': []}, headers=H); check('default password: content editing is locked', c == 403 and j.get('code') == 'default_password', f'{c} {j}')
c, j = call(adm, 'messages', headers=H); check('default password: reading messages is locked', c == 403)
c, j = call(adm, 'passwd', {'current': 'admin', 'new': 'short1'}, headers=H); check('weak new password rejected (too short)', c == 422)
c, j = call(adm, 'passwd', {'current': 'admin', 'new': 'onlylettersnonumbers'}, headers=H); check('weak new password rejected (no digit)', c == 422)
c, j = call(adm, 'passwd', {'current': 'wrong', 'new': 'StrongPass-2026-xyz'}, headers=H); check('password change needs the current password', c == 403)
c, j = call(adm, 'passwd', {'current': 'admin', 'new': 'Stronger-Pass-2026'}); check('password change without CSRF token rejected', c == 403)
c, j = call(adm, 'passwd', {'current': 'admin', 'new': 'Stronger-Pass-2026'}, headers=H); check('strong password accepted', c == 200 and j.get('csrf'), str(j)); H = {'X-CSRF-Token': j.get('csrf', '')}
c, j = call(adm, 'messages', headers=H); check('after change: admin endpoints unlock', c == 200 and len(j['messages']) >= 1, str(c))

# ---- stored-content sanitising ----
evil = '<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">x</a><a href="java&#9;script:alert(4)">y</a><iframe src="//evil"></iframe><svg onload=alert(5)></svg><a href="https://ok.example/page">fine</a><b onclick="x()">bold</b><img src="data:text/html;base64,AAAA">'
posts = [{'slug': 'Bad Slug!<x>', 'title': 'T', 'category': 'C', 'excerpt': 'e', 'author': 'a', 'date': '2026-01-01', 'read': 3, 'hue': 10, 'tags': [], 'content': evil}]
c, j = call(adm, 'save', {'key': 'posts', 'value': posts}, headers=H); check('posts saved', c == 200, str(j))
c, j = call(anon, 'content'); p = j['posts'][0]; h = p['content']
check('HTML: <script> removed', '<script' not in h.lower() and 'alert(1)' not in h)
check('HTML: event handlers removed', 'onerror' not in h.lower() and 'onclick' not in h.lower() and 'onload' not in h.lower())
check('HTML: javascript: URLs removed', 'javascript:' not in h.lower() and not re.search(r'java\s*script', h, re.I))
check('HTML: iframe/svg removed', '<iframe' not in h.lower() and '<svg' not in h.lower())
check('HTML: data:text/html image removed', 'data:text/html' not in h)
check('HTML: safe link kept with rel', 'href="https://ok.example/page"' in h and 'noopener' in h, h)
check('slug normalised', p['slug'] == 'badslugx', p['slug'])
tech = [{'name': 'X', 'mono': 'X', 'color': 'red;background:url(//evil)', 'desc': 'd', 'group': 'g'}, {'name': 'Y', 'mono': 'Y', 'color': 'linear-gradient(135deg,#22d3ee,#6366f1)', 'desc': 'd', 'group': 'g'}]
c, j = call(adm, 'save', {'key': 'technologies', 'value': tech}, headers=H); c, j = call(anon, 'content')
check('CSS injection via colour field neutralised', 'url(' not in j['technologies'][0]['color'] and ';' not in j['technologies'][0]['color'])
check('legitimate gradient kept', j['technologies'][1]['color'].startswith('linear-gradient'))
c, j = call(adm, 'save', {'key': 'settings', 'value': {'linkedin': 'javascript:alert(1)', 'github': 'https://github.com/x', 'email': 'bad'}}, headers=H); c, j = call(anon, 'content')
check('non-http social URL dropped', j['settings']['linkedin'] == '' and j['settings']['github'].startswith('https://'))
check('invalid contact email dropped', j['settings']['email'] == '')
c, j = call(adm, 'save', {'key': 'nope', 'value': []}, headers=H); check('unknown collection rejected', c == 422)

# ---- storage can never be downloaded ----
files = sorted(os.listdir(f'{ROOT}/storage'))
check('storage files are guarded .php files', all(f.endswith('.php') or f in ('.htaccess', 'index.html') for f in files), str(files))
bad = [f for f in files if f.endswith('.php') and not open(f'{ROOT}/storage/{f}').read().startswith('<?php http_response_code(403); exit; ?>')]
check('every storage file starts with the exit guard', not bad, str(bad))
for f in ('config.json.php', 'messages.json.php', 'audit.json.php'):
    try:
        r = urllib.request.urlopen(f'{BASE}/storage/{f}', timeout=10); code, body = r.status, r.read().decode()
    except urllib.error.HTTPError as e: code, body = e.code, e.read().decode()
    check(f'direct download of storage/{f} reveals nothing', body.strip() == '' or 'smtp' not in body and 'hash' not in body and 'Test Visitor' not in body, f'{code} {body[:60]}')

# ---- brute force ----
brute = mk('10.77.0.1'); codes = []
for i in range(11):
    cap = text_captcha(brute, wait=2.1 if i == 0 else 2.05); c, j = call(brute, 'login', {'user': 'admin', 'pass': f'guess{i}', **cap}); codes.append(c)
check('login brute-force is throttled (429 appears)', 429 in codes, str(codes))

print('\nRESULT:', 'ALL PASSED' if not fails else f'{len(fails)} FAILED: {fails}')
sys.exit(1 if fails else 0)
