"""Media upload tests (image shapes, chunked video, hostile files). Needs: php -S 127.0.0.1:8080 from the repo root, Pillow and ffmpeg.
Run: python3 tests/media_api_test.py"""
import base64, http.cookiejar, io, json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request
from PIL import Image

BASE = 'http://127.0.0.1:8080'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []

def mk(ip):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); op.addheaders = [('X-Real-IP', ip)]; return op

def call(op, a, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'{BASE}/api.php?a={a}', data=data, method='POST' if data is not None else 'GET')
    if data is not None: req.add_header('Content-Type', 'application/json')
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try: r = op.open(req, timeout=60); code, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e: code, txt = e.code, e.read().decode()
    try: return code, json.loads(txt)
    except Exception: return code, {'_raw': txt}

def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if (extra and not cond) else '')); cond or fails.append(name)

def text_cap(op):
    c, j = call(op, 'captcha&type=text'); m = re.search(r'(\d+) ([+\-×]) (\d+)', j['question']); a, o, b = int(m[1]), m[2], int(m[3])
    time.sleep(2.2); return {'captcha_token': j['token'], 'captcha_answer': str(a + b if o == '+' else a - b if o == '-' else a * b)}

def durl(b, mime): return f'data:{mime};base64,' + base64.b64encode(b).decode()
def img(w, h, fmt='JPEG', mode='RGB', color=(60, 100, 200)):
    b = io.BytesIO(); Image.new(mode, (w, h), color).save(b, fmt); return b.getvalue()
def fetch(url):
    r = urllib.request.urlopen(f'{BASE}/{url}', timeout=30); return r.read(), r.headers.get('Content-Type', '')

adm = mk('10.60.0.2')
c, j = call(adm, 'login', {'user': 'admin', 'pass': 'admin', **text_cap(adm)}); H = {'X-CSRF-Token': j.get('csrf', '')}
c, j = call(adm, 'passwd', {'current': 'admin', 'new': 'Media-Test-Pass-2026'}, headers=H); H = {'X-CSRF-Token': j.get('csrf', '')}

# ---------------- image shapes ----------------
def up(kind, data): return call(adm, 'upload', {'kind': kind, 'data': data}, headers=H)
c, j = up('cover', durl(img(2000, 1000), 'image/jpeg')); check('cover upload accepted', c == 200 and '/media/' in j.get('url', ''), f'{c} {j}')
raw, ctype = fetch(j['url']); im = Image.open(io.BytesIO(raw)); check('cover is cropped to 16:10 (1200x750)', im.size == (1200, 750) and im.format == 'JPEG', str(im.size)); check('cover served as an image', ctype.startswith('image/jpeg'), ctype)
c, j = up('avatar', durl(img(800, 500), 'image/jpeg')); im = Image.open(io.BytesIO(fetch(j['url'])[0])); check('avatar is a 480 square', im.size == (480, 480), str(im.size))
c, j = up('team', durl(img(900, 900), 'image/jpeg')); check('team photos still go to the team folder', j.get('url', '').startswith('uploads/team/'), str(j))
logo = img(300, 200, 'PNG', 'RGBA', (0, 0, 0, 0)); c, j = up('logo', durl(logo, 'image/png')); im = Image.open(io.BytesIO(fetch(j['url'])[0]))
check('logo keeps its transparent background (PNG, alpha)', im.format == 'PNG' and im.mode == 'RGBA' and im.getpixel((5, 5))[3] == 0, f'{im.format} {im.mode}'); check('logo is not stretched (300x200 stays 3:2)', abs(im.size[0] / im.size[1] - 1.5) < 0.02, str(im.size))
c, j = up('inline', durl(img(3000, 1500), 'image/jpeg')); im = Image.open(io.BytesIO(fetch(j['url'])[0])); check('inline pictures keep their shape and are limited to 1600px', im.size == (1600, 800), str(im.size))
c, j = up('movie', durl(img(300, 300), 'image/jpeg')); check('unknown image type rejected', c == 422)

# ---------------- video: real chunked upload ----------------
tmp = tempfile.mkdtemp(); mp4 = os.path.join(tmp, 't.mp4'); webm = os.path.join(tmp, 't.webm')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=480x270:rate=24', '-t', '3', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '30', '-an', mp4], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-t', '2', '-c:v', 'libvpx', '-b:v', '300k', '-an', webm], check=True)
def send_video(path, chunk=20000):
    data = open(path, 'rb').read(); c, st = call(adm, 'upload_video_start', {'size': len(data), 'name': os.path.basename(path)}, headers=H)
    if c != 200: return c, st, data
    off = 0
    while off < len(data):
        c, r = call(adm, 'upload_video_chunk', {'id': st['id'], 'offset': off, 'data': base64.b64encode(data[off:off + chunk]).decode()}, headers=H)
        if c != 200: return c, r, data
        off = r['received']
    c, r = call(adm, 'upload_video_finish', {'id': st['id']}, headers=H); return c, r, data
c, r, data = send_video(mp4); check('MP4 uploads in several chunks', c == 200 and re.fullmatch(r'uploads/media/[a-f0-9]{24}\.mp4', r.get('url', '')), f'{c} {r}')
body, ctype = fetch(r['url']); check('stored video is byte-identical', body == data); check('video is served as video/mp4', ctype.startswith('video/mp4'), ctype)
vurl_mp4 = r['url']
c, r2, _ = send_video(webm); check('WebM accepted', c == 200 and r2.get('url', '').endswith('.webm'), f'{c} {r2}')

# ---------------- video: bad input ----------------
c, st = call(adm, 'upload_video_start', {'size': 60 * 1024 * 1024}, headers=H); check('a video over 50 MB is refused up front', c == 413, str(c))
c, st = call(adm, 'upload_video_start', {'size': 500}, headers=H); check('a tiny file is refused', c == 422)
c, st = call(adm, 'upload_video_start', {'size': 40000}, headers=H); sid = st['id']
c, r = call(adm, 'upload_video_chunk', {'id': sid, 'offset': 5000, 'data': base64.b64encode(b'x' * 100).decode()}, headers=H); check('chunks sent out of order are refused (409)', c == 409, str(c))
c, r = call(adm, 'upload_video_chunk', {'id': sid, 'offset': 0, 'data': base64.b64encode(b'x' * 10).decode()}, headers=H); c2, r2f = call(adm, 'upload_video_finish', {'id': sid}, headers=H); check('an incomplete upload cannot be finished', c2 == 422, str(c2))
c, st = call(adm, 'upload_video_start', {'size': 5000}, headers=H); c, r = call(adm, 'upload_video_chunk', {'id': st['id'], 'offset': 0, 'data': base64.b64encode(b'<?php system($_GET["c"]); ?>' + b'\x00' * 4973).decode()}, headers=H); c, r = call(adm, 'upload_video_finish', {'id': st['id']}, headers=H); check('a PHP file pretending to be a video is refused', c == 422, str(c))
c, st = call(adm, 'upload_video_start', {'size': 5000}, headers=H); c, r = call(adm, 'upload_video_chunk', {'id': st['id'], 'offset': 0, 'data': base64.b64encode(b'<html><script>alert(1)</script>' + b'\x00' * 4969).decode()}, headers=H); c, r = call(adm, 'upload_video_finish', {'id': st['id']}, headers=H); check('an HTML file pretending to be a video is refused', c == 422, str(c))
c, r = call(adm, 'upload_video_chunk', {'id': '../../etc/passwd', 'offset': 0, 'data': 'AAAA'}, headers=H); check('path tricks in the upload id are refused', c == 422, str(c))
anon = mk('10.60.0.3')
for ep in ('upload_video_start', 'upload_video_chunk', 'upload_video_finish'):
    c, r = call(anon, ep, {}); check(f'{ep} requires login', c == 401, str(c))
c, r = call(adm, 'upload_video_start', {'size': 40000}); check('video upload without CSRF token refused', c == 403, str(c))
check('no leftover upload parts are web-reachable (storage is guarded)', all(f.endswith('.part') or f.endswith('.php') or f in ('.htaccess', 'index.html') for f in os.listdir(os.path.join(ROOT, 'storage'))))

# ---------------- saved paths are validated everywhere ----------------
good_img = j and re.search(r'uploads/media/[a-f0-9]{24}\.jpg', json.dumps(call(adm, 'upload', {'kind': 'cover', 'data': durl(img(400, 300), 'image/jpeg')}, headers=H)[1])).group(0)
posts = [{'slug': 'p1', 'title': 'P1', 'category': 'c', 'excerpt': 'e', 'author': 'a', 'date': '2026-01-01', 'read': 1, 'tags': [], 'content': f'<p>Hi</p><p><img src="{good_img}" alt="x"></p>', 'image': good_img, 'videoFile': vurl_mp4},
         {'slug': 'p2', 'title': 'P2', 'category': 'c', 'excerpt': 'e', 'author': 'a', 'date': '2026-01-01', 'read': 1, 'tags': [], 'content': '<p>x</p>', 'image': 'uploads/media/../../storage/config.json', 'videoFile': 'https://evil.example/v.mp4'},
         {'slug': 'p3', 'title': 'P3', 'category': 'c', 'excerpt': 'e', 'author': 'a', 'date': '2026-01-01', 'read': 1, 'tags': [], 'content': '<p>x</p>', 'image': 'javascript:alert(1)', 'videoFile': 'uploads/media/x.php'}]
c, j = call(adm, 'save', {'key': 'posts', 'value': posts}, headers=H); c, j = call(anon, 'content'); P = j['posts']
check('uploaded cover path kept', P[0]['image'] == good_img); check('uploaded video path kept', P[0]['videoFile'] == vurl_mp4)
check('traversal in image removed', P[1]['image'] == ''); check('external video URL removed', P[1]['videoFile'] == '')
check('javascript: image removed', P[2]['image'] == ''); check('non-video extension removed', P[2]['videoFile'] == '')
check('picture placed inside article text is kept', good_img in P[0]['content'])
faqs = [{'q': 'Q', 'a': 'A', 'image': good_img, 'videoFile': vurl_mp4}]; c, j = call(adm, 'save', {'key': 'faqs', 'value': faqs}, headers=H); c, j = call(anon, 'content'); check('FAQ media saved', j['faqs'][0]['image'] == good_img and j['faqs'][0]['videoFile'] == vurl_mp4)
tech = [{'name': 'T', 'mono': 'T', 'color': '#fff', 'desc': 'd', 'group': 'g', 'image': good_img}]; c, j = call(adm, 'save', {'key': 'technologies', 'value': tech}, headers=H); c, j = call(anon, 'content'); check('technology logo saved', j['technologies'][0]['image'] == good_img)
vids = [{'key': 'k', 'file': vurl_mp4, 'poster': good_img, 'title': 't', 'tag': 'x', 'text': 'y', 'link': 'services.html'}]; c, j = call(adm, 'save', {'key': 'videos', 'value': vids}, headers=H); c, j = call(anon, 'content'); check('video file and poster saved', j['videos'][0]['file'] == vurl_mp4 and j['videos'][0]['poster'] == good_img)

# ---------------- tidy-up keeps what is referenced anywhere (including inside article text) ----------------
unused = os.path.join(ROOT, 'uploads/media', 'a' * 24 + '.jpg'); open(unused, 'wb').write(img(50, 50)); os.utime(unused, (time.time() - 40000, time.time() - 40000))
inline_only = call(adm, 'upload', {'kind': 'inline', 'data': durl(img(500, 300), 'image/jpeg')}, headers=H)[1]['url']; io_path = os.path.join(ROOT, inline_only); os.utime(io_path, (time.time() - 40000, time.time() - 40000))
posts[0]['content'] += f'<p><img src="{inline_only}" alt="y"></p>'; call(adm, 'save', {'key': 'posts', 'value': posts}, headers=H)
call(adm, 'upload', {'kind': 'cover', 'data': durl(img(400, 300), 'image/jpeg')}, headers=H)
check('old unreferenced media is deleted', not os.path.exists(unused)); check('an old picture used inside an article is kept', os.path.exists(io_path))
check('video in use is kept', os.path.exists(os.path.join(ROOT, vurl_mp4)))
print('\nRESULT:', 'ALL PASSED' if not fails else f'{len(fails)} FAILED: {fails}'); sys.exit(1 if fails else 0)
