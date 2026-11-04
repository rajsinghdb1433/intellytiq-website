"""Upload security tests. Needs: php -S 127.0.0.1:8080 (from the repo root) and Pillow.  Run: python3 tests/upload_api_test.py"""
import base64, http.cookiejar, io, json, os, re, struct, sys, time, urllib.error, urllib.request
from PIL import Image

BASE = 'http://127.0.0.1:8080'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []

def mk(ip):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    op.addheaders = [('X-Real-IP', ip)]
    return op

def call(op, a, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'{BASE}/api.php?a={a}', data=data, method='POST' if data is not None else 'GET')
    if data is not None: req.add_header('Content-Type', 'application/json')
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        r = op.open(req, timeout=30); code, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        code, txt = e.code, e.read().decode()
    try: return code, json.loads(txt)
    except Exception: return code, {'_raw': txt}

def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if (extra and not cond) else ''))
    if not cond: fails.append(name)

def text_cap(op):
    c, j = call(op, 'captcha&type=text'); m = re.search(r'(\d+) ([+\-×]) (\d+)', j['question']); a, o, b = int(m[1]), m[2], int(m[3])
    time.sleep(2.2); return {'captcha_token': j['token'], 'captcha_answer': str(a + b if o == '+' else a - b if o == '-' else a * b)}

def data_url(img_bytes, mime): return f'data:{mime};base64,' + base64.b64encode(img_bytes).decode()
def jpeg(w, h, color=(70, 90, 200)):
    b = io.BytesIO(); Image.new('RGB', (w, h), color).save(b, 'JPEG', quality=90); return b.getvalue()
def png(w, h):
    b = io.BytesIO(); Image.new('RGB', (w, h), (200, 60, 90)).save(b, 'PNG'); return b.getvalue()

anon = mk('10.42.0.1')
c, j = call(anon, 'upload', {'kind': 'team', 'data': data_url(jpeg(300, 300), 'image/jpeg')}); check('upload requires login', c == 401, str(c))

adm = mk('10.42.0.2')
c, j = call(adm, 'login', {'user': 'admin', 'pass': 'admin', **text_cap(adm)}); H = {'X-CSRF-Token': j.get('csrf', '')}
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(jpeg(300, 300), 'image/jpeg')}, headers=H); check('upload is locked while the default password is active', c == 403, str(c))
c, j = call(adm, 'passwd', {'current': 'admin', 'new': 'Uploads-Test-2026x'}, headers=H); H = {'X-CSRF-Token': j.get('csrf', '')}
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(jpeg(300, 300), 'image/jpeg')}); check('upload without CSRF token rejected', c == 403, str(c))

# ---- a normal photo ----
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(jpeg(1000, 700), 'image/jpeg')}, headers=H)
check('valid JPEG accepted', c == 200 and re.fullmatch(r'uploads/team/[a-f0-9]{24}\.jpg', j.get('url', '')), f'{c} {j}')
url = j.get('url', ''); raw = urllib.request.urlopen(f'{BASE}/{url}').read()
im = Image.open(io.BytesIO(raw)); check('stored as a square 640x640 JPEG', raw[:3] == b'\xff\xd8\xff' and im.size == (640, 640) and im.format == 'JPEG', f'{im.format} {im.size}')
c, j2 = call(adm, 'upload', {'kind': 'team', 'data': data_url(png(500, 900), 'image/png')}, headers=H); check('valid PNG accepted and converted', c == 200 and j2['url'].endswith('.jpg'))

# ---- hostile uploads ----
payload = b"<?php system($_GET['c']); ?>"
def png_with_payload():
    b = io.BytesIO(); Image.new('RGB', (200, 200), (10, 120, 60)).save(b, 'PNG'); d = b.getvalue()
    chunk = b'tEXt' + b'Comment\x00' + payload; crc = struct.pack('>I', __import__('zlib').crc32(chunk) & 0xffffffff)
    return d[:-12] + struct.pack('>I', len(chunk) - 4) + chunk + crc + d[-12:] + payload      # payload inside a chunk AND appended after IEND
c, j3 = call(adm, 'upload', {'kind': 'team', 'data': data_url(png_with_payload(), 'image/png')}, headers=H)
check('PNG containing PHP code is accepted only as a clean re-encoded image', c == 200, f'{c} {j3}')
if c == 200:
    out = open(os.path.join(ROOT, j3['url']), 'rb').read(); check('hidden PHP code is gone from the stored file', b'<?php' not in out and b'system(' not in out)
c, j = call(adm, 'upload', {'kind': 'team', 'data': 'data:image/gif;base64,' + base64.b64encode(b'GIF89a\x01\x00\x01\x00').decode()}, headers=H); check('GIF rejected', c == 422)
c, j = call(adm, 'upload', {'kind': 'team', 'data': 'data:image/svg+xml;base64,' + base64.b64encode(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').decode()}, headers=H); check('SVG rejected', c == 422)
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(b'<html><script>alert(1)</script></html>', 'image/png')}, headers=H); check('HTML disguised as PNG rejected', c == 422)
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(payload + b'\x00' * 200, 'image/jpeg')}, headers=H); check('PHP disguised as JPEG rejected', c == 422)
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(jpeg(10, 10), 'image/jpeg')}, headers=H); check('tiny image rejected', c == 422)
c, j = call(adm, 'upload', {'kind': 'team', 'data': 'not-a-data-url'}, headers=H); check('non data-URL rejected', c == 422)
c, j = call(adm, 'upload', {'kind': '../../storage', 'data': data_url(jpeg(300, 300), 'image/jpeg')}, headers=H); check('unknown upload type rejected', c == 422)
big = io.BytesIO(); Image.effect_noise((1500, 1500), 90).convert('RGB').save(big, 'JPEG', quality=95)
c, j = call(adm, 'upload', {'kind': 'team', 'data': data_url(big.getvalue(), 'image/jpeg')}, headers=H); check('oversized image rejected', c in (413, 422), str(c))

# ---- the saved photo path is validated ----
team = [{'name': 'A', 'role': 'r', 'bio': 'b', 'skills': [], 'photo': url}, {'name': 'B', 'role': 'r', 'bio': 'b', 'skills': [], 'photo': 'uploads/team/../../storage/config.json'},
        {'name': 'C', 'role': 'r', 'bio': 'b', 'skills': [], 'photo': 'https://evil.example/x.jpg'}, {'name': 'D', 'role': 'r', 'bio': 'b', 'skills': [], 'photo': 'javascript:alert(1)'}]
c, j = call(adm, 'save', {'key': 'team', 'value': team}, headers=H); c, j = call(anon, 'content'); t = j['team']
check('valid uploaded path kept', t[0]['photo'] == url)
check('path traversal removed', t[1]['photo'] == '')
check('external URL removed', t[2]['photo'] == '')
check('javascript: URL removed', t[3]['photo'] == '')

# ---- old unreferenced photos are tidied up, referenced ones kept ----
orphan = os.path.join(ROOT, j2['url']); os.utime(orphan, (time.time() - 7200, time.time() - 7200))
fresh = os.path.join(ROOT, j3['url']) if os.path.exists(os.path.join(ROOT, j3.get('url', 'x'))) else None
c, j4 = call(adm, 'upload', {'kind': 'team', 'data': data_url(jpeg(300, 300), 'image/jpeg')}, headers=H)
check('an old unused photo is removed', not os.path.exists(orphan))
check('the photo in use is kept', os.path.exists(os.path.join(ROOT, url)))
check('a just-uploaded photo is kept', fresh is None or os.path.exists(fresh))

# ---- folder rules ----
ht = open(os.path.join(ROOT, 'uploads/.htaccess')).read()
check('uploads/.htaccess switches PHP off and denies scripts', 'engine off' in ht and 'RemoveHandler' in ht and 'Require all denied' in ht)
print('\nRESULT:', 'ALL PASSED' if not fails else f'{len(fails)} FAILED: {fails}'); sys.exit(1 if fails else 0)
