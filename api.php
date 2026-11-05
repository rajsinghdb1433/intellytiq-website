<?php
/**
 * Intellytiq Solutions: small JSON API (no database required).
 *
 * Public : GET ?a=content | GET ?a=captcha | POST ?a=contact | POST ?a=subscribe
 * Admin  : POST ?a=login (CAPTCHA) | logout | save | reset | messages | delete_message | passwd
 *          mail_get | mail_save | mail_test | audit   (session + CSRF protected)
 *
 * Security notes
 *  - Every public form needs a single-use CAPTCHA token (HMAC-signed, expires, minimum solve time).
 *  - POSTs must be JSON from the same origin (blocks cross-site form posts).
 *  - Runtime data lives in ./storage as *.php files that start with an exit guard, so even if the
 *    web server ignores .htaccess the contents can never be downloaded.
 *  - The default admin password cannot be used for anything except changing it.
 */
declare(strict_types=1);

const COLLECTIONS = [
    'settings' => 'object', 'services' => 'array', 'technologies' => 'array', 'process' => 'array',
    'industries' => 'array', 'team' => 'array', 'posts' => 'array', 'projects' => 'array',
    'careers' => 'array', 'testimonials' => 'array', 'faqs' => 'array', 'values' => 'array', 'timeline' => 'array', 'videos' => 'array', 'companies' => 'array',
];
const ADMIN_USER = 'admin';
const DEFAULT_PASSWORD = 'admin';       // only works until it is changed; see need_auth()
const MAX_BODY_PUBLIC = 20000;
const MAX_BODY_ADMIN = 1_500_000;
const SESSION_IDLE = 1800;               // 30 minutes of inactivity
const SESSION_MAX = 28800;               // 8 hours absolute
const CAPTCHA_TTL = 600;                 // a code is valid for 10 minutes
const CAPTCHA_MIN_SOLVE = 2;             // seconds; faster than this is a bot
const MAX_VIDEO = 52428800;               // 50 MB per uploaded video
const VIDEO_CHUNK = 700000;              // largest chunk accepted per request
const GUARD = "<?php http_response_code(403); exit; ?>\n";

$root = __DIR__;
$store = $root . '/storage';
if (!is_dir($store)) {
    @mkdir($store, 0750, true);
    @file_put_contents($store . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    @file_put_contents($store . '/index.html', '');
}
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
@ini_set('error_log', $store . '/php-error.log.php');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cross-Origin-Resource-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store');

function out($data, int $code = 200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

/* ---------- guarded JSON storage ---------- */
function spath(string $name): string { global $store; return "$store/$name.php"; }
function read_json(string $name, $default) {
    global $store;
    $f = spath($name);
    if (!is_file($f)) {                                   // migrate an older unguarded file
        $legacy = "$store/$name";
        if (!is_file($legacy)) return $default;
        $d = json_decode((string)@file_get_contents($legacy), true);
        if ($d !== null) { write_json($name, $d); @unlink($legacy); return $d; }
        return $default;
    }
    $raw = (string)@file_get_contents($f);
    if (strncmp($raw, GUARD, strlen(GUARD)) === 0) $raw = substr($raw, strlen(GUARD));
    $d = json_decode($raw, true);
    return $d === null ? $default : $d;
}
function write_json(string $name, $data): bool {
    $f = spath($name); $tmp = $f . '.tmp' . bin2hex(random_bytes(3));
    $payload = GUARD . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (@file_put_contents($tmp, $payload, LOCK_EX) === false) return false;
    @chmod($tmp, 0640);
    return @rename($tmp, $f);
}

/* ---------- request helpers ---------- */
function body(int $max = MAX_BODY_PUBLIC): array {
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) out(['error' => 'Payload too large'], 413);
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}
function ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $h) {
        if (!empty($_SERVER[$h])) { $v = trim(explode(',', (string)$_SERVER[$h])[0]); if (filter_var($v, FILTER_VALIDATE_IP)) return $v; }
    }
    $v = (string)($_SERVER['REMOTE_ADDR'] ?? ''); return filter_var($v, FILTER_VALIDATE_IP) ? $v : '0.0.0.0';
}
function throttle(string $bucket, int $max, int $window, bool $global = false): void {
    $all = read_json('throttle.json', []); $now = time(); $k = $bucket . ':' . ($global ? '*' : ip());
    $hits = array_values(array_filter($all[$k] ?? [], fn($t) => $t > $now - $window));
    if (count($hits) >= $max) out(['error' => 'Too many attempts. Please try again later.'], 429);
    $hits[] = $now; $all[$k] = $hits;
    foreach ($all as $kk => $v) { if (!array_filter($v, fn($t) => $t > $now - 3600)) unset($all[$kk]); }
    write_json('throttle.json', $all);
}
function clean(string $s, int $max = 4000): string { return mb_substr(trim(strip_tags(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $s))), 0, $max); }
function audit(string $event): void {
    $all = read_json('audit.json', []);
    array_unshift($all, ['t' => gmdate('c'), 'ip' => ip(), 'ua' => mb_substr(preg_replace('/[^\x20-\x7E]/', '', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 90), 'event' => $event]);
    write_json('audit.json', array_slice($all, 0, 200));
}

/* ---------- CAPTCHA (self-hosted, single use, signed) ---------- */
function app_secret(): string {
    $cfg = read_json('config.json', []);
    if (empty($cfg['secret'])) { $cfg['secret'] = bin2hex(random_bytes(32)); write_json('config.json', $cfg); }
    return (string)$cfg['secret'];
}
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64u_dec(string $s): string { return (string)base64_decode(strtr($s, '-_', '+/')); }
function captcha_norm(string $a): string { return strtoupper(preg_replace('/\s+/', '', $a)); }
function captcha_token(string $answer): string {
    $iat = time(); $nonce = bin2hex(random_bytes(8));
    $sig = hash_hmac('sha256', "$iat|$nonce|" . captcha_norm($answer), app_secret());
    return b64u("$iat|$nonce|$sig");
}
function captcha_png(string $code): ?string {
    $font = __DIR__ . '/data/captcha.ttf';
    if (!function_exists('imagecreatetruecolor') || !function_exists('imagettftext') || !is_file($font)) return null;
    $w = 200; $h = 70; $im = imagecreatetruecolor($w, $h);
    $bg = imagecolorallocate($im, 243, 245, 255); imagefilledrectangle($im, 0, 0, $w, $h, $bg);
    for ($i = 0; $i < 220; $i++) { $c = imagecolorallocate($im, random_int(150, 225), random_int(150, 225), random_int(170, 235)); imagesetpixel($im, random_int(0, $w - 1), random_int(0, $h - 1), $c); }
    for ($i = 0; $i < 5; $i++) { $c = imagecolorallocate($im, random_int(120, 200), random_int(120, 200), random_int(150, 230)); imagesetthickness($im, 1); imageline($im, random_int(0, 40), random_int(0, $h), random_int($w - 40, $w), random_int(0, $h), $c); }
    $x = 12;
    foreach (str_split($code) as $ch) {
        $c = imagecolorallocate($im, random_int(10, 90), random_int(10, 90), random_int(70, 170));
        imagettftext($im, random_int(30, 36), random_int(-24, 24), $x, random_int(48, 60), $c, $font, $ch);
        $x += random_int(30, 35);
    }
    for ($i = 0; $i < 4; $i++) { $c = imagecolorallocate($im, random_int(60, 150), random_int(60, 150), random_int(100, 200)); imagesetthickness($im, 2); imagearc($im, random_int(20, $w - 20), random_int(10, $h - 10), random_int(60, 160), random_int(20, 60), random_int(0, 180), random_int(181, 360), $c); }
    $out = imagecreatetruecolor($w, $h); imagefilledrectangle($out, 0, 0, $w, $h, $bg); $ph = random_int(0, 628) / 100; $per = random_int(14, 22);
    for ($cx = 0; $cx < $w; $cx++) { imagecopy($out, $im, $cx, (int)round(sin($cx / $per + $ph) * 3), $cx, 0, 1, $h); }
    ob_start(); imagepng($out); $png = (string)ob_get_clean(); imagedestroy($im); imagedestroy($out);
    return $png;
}
/** @return array{token:string,image?:string,question?:string} */
function captcha_issue(bool $forceText): array {
    if (!$forceText) {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $code = '';
        for ($i = 0; $i < 5; $i++) $code .= $chars[random_int(0, strlen($chars) - 1)];
        $png = captcha_png($code);
        if ($png !== null) return ['token' => captcha_token($code), 'image' => 'data:image/png;base64,' . base64_encode($png), 'type' => 'image'];
    }
    $a = random_int(3, 19); $b = random_int(2, 9); $op = random_int(0, 2);
    [$q, $ans] = $op === 0 ? ["$a + $b", $a + $b] : ($op === 1 ? ["$a - $b", $a - $b] : ["$b × " . random_int(2, 9), 0]);
    if ($op === 2) { preg_match('/(\d+) × (\d+)/u', $q, $m); $ans = (int)$m[1] * (int)$m[2]; }
    return ['token' => captcha_token((string)$ans), 'question' => "What is $q?", 'type' => 'text'];
}
function captcha_check(array $d): bool {
    $tok = (string)($d['captcha_token'] ?? ''); $ans = (string)($d['captcha_answer'] ?? '');
    if ($tok === '' || $ans === '' || strlen($tok) > 300 || strlen($ans) > 20) return false;
    $p = explode('|', b64u_dec($tok)); if (count($p) !== 3) return false;
    [$iat, $nonce, $sig] = $p; $iat = (int)$iat; $now = time();
    if ($iat > $now || $now - $iat > CAPTCHA_TTL || $now - $iat < CAPTCHA_MIN_SOLVE || !preg_match('/^[a-f0-9]{16}$/', $nonce)) return false;
    $used = read_json('captcha-used.json', []);
    foreach ($used as $n => $exp) { if ($exp < $now) unset($used[$n]); }
    if (isset($used[$nonce])) return false;                         // single use, even after a wrong answer
    $used[$nonce] = $iat + CAPTCHA_TTL + 60; write_json('captcha-used.json', $used);
    return hash_equals(hash_hmac('sha256', "$iat|$nonce|" . captcha_norm($ans), app_secret()), $sig);
}
function captcha_fail(): never { out(['error' => 'The security code was not correct. Please try the new code.', 'captcha' => true], 422); }

/* ---------- HTML + data sanitising (defence in depth; the browser sanitises again) ---------- */
function safe_url(string $u, bool $img = false): ?string {
    $u = trim(preg_replace('/[\x00-\x20\x7F]+/', '', html_entity_decode($u, ENT_QUOTES | ENT_HTML5)));
    if ($u === '') return null;
    if (preg_match('/^([a-z][a-z0-9+.\-]*):/i', $u, $m)) {
        $s = strtolower($m[1]);
        if ($s === 'http' || $s === 'https' || (!$img && $s === 'mailto')) return $u;
        if ($img && $s === 'data' && preg_match('#^data:image/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$#i', $u)) return $u;
        return null;
    }
    return preg_match('#^(/|\./|\.\./|\#|[a-z0-9_\-])#i', $u) ? $u : null;
}
function sanitize_html(string $html): string {
    if (trim($html) === '') return '';
    $allowed = ['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'br', 'hr', 'img'];
    $drop = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'svg', 'math', 'base', 'textarea', 'select', 'noscript', 'template', 'frame', 'frameset'];
    $attrs = ['a' => ['href', 'title'], 'img' => ['src', 'alt', 'title', 'width', 'height']];
    libxml_use_internal_errors(true);
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->loadHTML('<?xml encoding="utf-8"?><div id="iqroot">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
    $walk = function (DOMNode $node) use (&$walk, $allowed, $drop, $attrs): void {
        foreach (iterator_to_array($node->childNodes) as $c) {
            if ($c->nodeType === XML_COMMENT_NODE || $c->nodeType === XML_PI_NODE || $c->nodeType === XML_CDATA_SECTION_NODE) { $node->removeChild($c); continue; }
            if ($c->nodeType !== XML_ELEMENT_NODE) continue;
            $tag = strtolower($c->nodeName);
            if (in_array($tag, $drop, true)) { $node->removeChild($c); continue; }
            $walk($c);
            if (!in_array($tag, $allowed, true)) { while ($c->firstChild) $node->insertBefore($c->firstChild, $c); $node->removeChild($c); continue; }
            foreach (iterator_to_array($c->attributes) as $at) {
                $n = strtolower($at->nodeName);
                if (!in_array($n, $attrs[$tag] ?? [], true)) { $c->removeAttribute($at->nodeName); continue; }
                if ($n === 'href' || $n === 'src') { $u = safe_url($at->nodeValue, $n === 'src'); if ($u === null) $c->removeAttribute($at->nodeName); else $c->setAttribute($n, $u); }
            }
            if ($tag === 'a' && $c->hasAttribute('href')) { $c->setAttribute('rel', 'noopener noreferrer nofollow'); if (preg_match('#^https?:#i', $c->getAttribute('href'))) $c->setAttribute('target', '_blank'); }
            if ($tag === 'img') $c->setAttribute('loading', 'lazy');
        }
    };
    $root = $dom->getElementById('iqroot') ?: $dom->documentElement; $walk($root);
    $o = ''; foreach ($root->childNodes as $c) $o .= $dom->saveHTML($c);
    return $o;
}
/** Validates and normalises admin-supplied content so nothing unsafe can be stored. */
function clean_value($v, string $key = '', int $depth = 0) {
    if ($depth > 5) return null;
    if (is_array($v)) { $o = []; $n = 0; foreach ($v as $k => $x) { if (++$n > 500) break; $o[is_int($k) ? $k : mb_substr(preg_replace('/[^A-Za-z0-9_\-]/', '', (string)$k), 0, 40)] = clean_value($x, is_string($k) ? $k : $key, $depth + 1); } return $o; }
    if (is_bool($v) || is_int($v) || is_float($v) || $v === null) return $v;
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)$v);
    if ($key === 'content') return sanitize_html(mb_substr($s, 0, 60000));
    $s = mb_substr($s, 0, 8000);
    if (in_array($key, ['c1', 'c2'], true)) return preg_match('/^#[0-9a-f]{3,8}$/i', $s) ? $s : '#6366f1';
    if ($key === 'color') return preg_match('/^[#a-zA-Z0-9(),.%\s\-]{1,200}$/', $s) && !preg_match('/url\s*\(|expression|javascript|;|\{|\}/i', $s) ? $s : 'linear-gradient(135deg,#22d3ee,#6366f1)';
    if ($key === 'photo' || $key === 'image') return preg_match('#^(uploads/(team|media)/[a-f0-9]{16,40}\.(jpg|png|webp)|assets/img/(companies|tech)/[a-z0-9-]{2,30}\.svg)$#', $s) ? $s : '';
    if ($key === 'videoFile') return preg_match('#^uploads/media/[a-f0-9]{16,40}\.(mp4|webm)$#', $s) ? $s : '';
    if ($key === 'file' || $key === 'poster') return preg_match('#^[A-Za-z0-9_\-./]{1,200}$#', $s) && strpos($s, '..') === false && preg_match('/\.(mp4|webm|jpg|jpeg|png|webp)$/i', $s) ? $s : '';
    if ($key === 'link') return preg_match('#^(https?://[^\s"\'<>]+|[a-z0-9_\-./?=&\#%]+)$#i', $s) ? $s : '';
    if ($key === 'video' || $key === 'key') return preg_replace('/[^a-z0-9\-]/', '', strtolower($s));
    if ($key === 'slug' || $key === 'icon') return preg_replace('/[^a-z0-9\-]/', '', strtolower($s));
    if (in_array($key, ['linkedin', 'github', 'twitter'], true)) return $s === '' ? '' : (preg_match('#^https?://#i', $s) && filter_var($s, FILTER_VALIDATE_URL) ? $s : '');
    if ($key === 'email') return $s === '' || filter_var($s, FILTER_VALIDATE_EMAIL) ? $s : '';
    return $s;
}

/* ---------- media uploads: images are re-encoded server side, videos are validated; stored where code can never run ---------- */
function ensure_uploads(string $sub): string {
    $base = __DIR__ . '/uploads';
    if (!is_dir($base)) @mkdir($base, 0755, true);
    if (!is_file($base . '/.htaccess')) {
        @file_put_contents($base . '/.htaccess',
            "Options -ExecCGI -Indexes\n<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n<IfModule mod_php7.c>\nphp_flag engine off\n</IfModule>\n<IfModule mod_php8.c>\nphp_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .phar .php5 .php7 .php8\nRemoveType .php .phtml .phar\n<FilesMatch \"(?i)\\.(php[0-9]?|phtml|phar|pl|py|cgi|sh|html?|js|svg)$\">\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n</FilesMatch>\n");
    }
    if (!is_file($base . '/index.html')) @file_put_contents($base . '/index.html', '');
    $dir = "$base/$sub"; if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir;
}
function media_in_use(): array {
    global $root;
    $blob = str_replace('\\/', '/', json_encode(read_json('content.json', [])) . (string)@file_get_contents($root . '/data/defaults.json'));
    preg_match_all('#uploads/(?:team|media)/[a-f0-9]{16,40}\.(?:jpg|png|webp|mp4|webm)#', $blob, $m);
    return array_flip(array_map('basename', $m[0]));
}
function cleanup_media(): void {                  // delete media that is no longer used anywhere, once it is 3 hours old
    global $store;
    $used = media_in_use(); $cut = time() - 10800;
    foreach (['team', 'media'] as $sub) foreach (glob(ensure_uploads($sub) . '/*.*') ?: [] as $f) { if (!isset($used[basename($f)]) && filemtime($f) < $cut) @unlink($f); }
    foreach (array_merge(glob($store . '/vid-*.part') ?: [], glob($store . '/vid-*.json.php') ?: []) as $f) { if (filemtime($f) < time() - 7200) @unlink($f); }
}
/** Resizes/crops an uploaded image for its purpose. Returns [gd resource, extension, subfolder]. */
function render_image($im, string $kind): array {
    $w = imagesx($im); $h = imagesy($im);
    $crop = function (float $ratio, int $maxW) use ($im, $w, $h) {
        if ($w / $h > $ratio) { $sh = $h; $sw = (int)round($h * $ratio); $sx = intdiv($w - $sw, 2); $sy = 0; } else { $sw = $w; $sh = (int)round($w / $ratio); $sx = 0; $sy = intdiv($h - $sh, 2); }
        $dw = min($maxW, $sw); $dh = (int)round($dw / $ratio);
        $o = imagecreatetruecolor($dw, $dh); imagefilledrectangle($o, 0, 0, $dw, $dh, imagecolorallocate($o, 255, 255, 255));
        imagecopyresampled($o, $im, 0, 0, $sx, $sy, $dw, $dh, $sw, $sh); return $o;
    };
    $fit = function (int $max, bool $alpha) use ($im, $w, $h) {
        $sc = min(1, $max / max($w, $h)); $dw = max(1, (int)round($w * $sc)); $dh = max(1, (int)round($h * $sc));
        $o = imagecreatetruecolor($dw, $dh);
        if ($alpha) { imagealphablending($o, false); imagesavealpha($o, true); imagefilledrectangle($o, 0, 0, $dw, $dh, imagecolorallocatealpha($o, 255, 255, 255, 127)); }
        else imagefilledrectangle($o, 0, 0, $dw, $dh, imagecolorallocate($o, 255, 255, 255));
        imagecopyresampled($o, $im, 0, 0, 0, 0, $dw, $dh, $w, $h); return $o;
    };
    return match ($kind) {
        'team' => [$crop(1.0, 640), 'jpg', 'team'],
        'avatar' => [$crop(1.0, 480), 'jpg', 'media'],
        'cover' => [$crop(1.6, 1200), 'jpg', 'media'],
        'logo' => [$fit(512, true), 'png', 'media'],
        default => [$fit(1600, false), 'jpg', 'media'],
    };
}

/* ---------- outgoing email: authenticated SMTP (preferred) or PHP mail() fallback ---------- */
function mail_clean(string $s): string { return trim(preg_replace('/[\r\n]+/', ' ', $s)); }
function mail_mime(string $body, ?string $html, string &$ctype): string {
    if ($html === null || $html === '') { $ctype = "text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit"; return $body; }
    $b = 'iq' . bin2hex(random_bytes(10)); $ctype = "multipart/alternative; boundary=\"$b\"";
    $enc = fn(string $s): string => rtrim(chunk_split(base64_encode($s), 76, "\n"));
    return "--$b\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n" . $enc($body) . "\n--$b\nContent-Type: text/html; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n" . $enc($html) . "\n--$b--";
}
function smtp_send(array $c, string $to, string $subject, string $body, string $replyTo, ?string &$err, ?string $html = null): bool {
    $host = (string)($c['host'] ?? ''); $port = (int)($c['port'] ?? 465); $sec = (string)($c['secure'] ?? 'ssl');
    $user = (string)($c['user'] ?? ''); $pass = (string)($c['pass'] ?? '');
    $from = filter_var($c['from'] ?? '', FILTER_VALIDATE_EMAIL) ? $c['from'] : $user;
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client(($sec === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $en, $es, 12, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) { $err = "Could not connect to $host:$port ($es)"; return false; }
    stream_set_timeout($fp, 12);
    $read = function () use ($fp): string { $o = ''; while (($l = fgets($fp, 1024)) !== false) { $o .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return $o; };
    $step = function (string $cmd, array $ok) use ($fp, $read, &$err) {
        if ($cmd !== '') fwrite($fp, $cmd . "\r\n");
        $r = $read(); $code = (int)substr($r, 0, 3);
        if (!in_array($code, $ok, true)) { $err = trim($r) !== '' ? trim($r) : 'No response from the mail server'; return false; }
        return true;
    };
    $name = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost') ?: 'localhost';
    try {
        if (!$step('', [220]) || !$step("EHLO $name", [250])) return false;
        if ($sec === 'tls') {
            if (!$step('STARTTLS', [220])) return false;
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { $err = 'STARTTLS negotiation failed'; return false; }
            if (!$step("EHLO $name", [250])) return false;
        }
        if ($user !== '') {
            if (!$step('AUTH LOGIN', [334]) || !$step(base64_encode($user), [334]) || !$step(base64_encode($pass), [235])) { $err = 'Login rejected: ' . $err; return false; }
        }
        if (!$step("MAIL FROM:<$from>", [250]) || !$step("RCPT TO:<$to>", [250, 251]) || !$step('DATA', [354])) return false;
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $hdr = "From: \"Intellytiq Website\" <$from>\r\nTo: <$to>\r\n" . ($replyTo !== '' ? "Reply-To: <" . mail_clean($replyTo) . ">\r\n" : '')
             . 'Subject: =?UTF-8?B?' . base64_encode(mail_clean($subject)) . "?=\r\nDate: " . date('r') . "\r\nMessage-ID: <" . bin2hex(random_bytes(8)) . "@$domain>\r\n"
             . "MIME-Version: 1.0\r\n";
        $ct = ''; $payload = mail_mime($body, $html, $ct); $hdr .= "Content-Type: $ct\r\n";
        $msg = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $payload)); $msg = str_replace("\n", "\r\n", $msg);
        fwrite($fp, $hdr . "\r\n" . $msg . "\r\n.\r\n");
        if (!$step('', [250])) return false;
        @fwrite($fp, "QUIT\r\n");
        return true;
    } finally { @fclose($fp); }
}
function main_domain(): string {
    $h = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost')); $p = explode('.', $h);
    return count($p) > 2 ? implode('.', array_slice($p, -2)) : $h;
}
function site_settings(): array {
    global $root;
    return read_json('content.json', [])['settings'] ?? read_json_file($root . '/data/defaults.json')['settings'] ?? [];
}
function read_json_file(string $path): array { $d = json_decode((string)@file_get_contents($path), true); return is_array($d) ? $d : []; }

/** Branded HTML email (table layout + inline CSS so it renders in Outlook, Gmail and Apple Mail). Every value is escaped. */
function mail_html(string $kicker, string $title, array $rows, string $message = '', string $cta = '', string $ctaUrl = '', string $note = ''): string {
    $e = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $site = 'https://' . (preg_match('/^[a-z0-9.-]+$/i', main_domain()) && main_domain() !== 'localhost' ? main_domain() : 'intellytiqsolutions.com');
    $rowsH = '';
    foreach ($rows as $k => $v) {
        if ((string)$v === '') continue;
        $val = $e((string)$v);
        if ($k === 'Email' && filter_var($v, FILTER_VALIDATE_EMAIL)) $val = '<a href="mailto:' . $e((string)$v) . '" style="color:#4f46e5;text-decoration:none;font-weight:600">' . $val . '</a>';
        $rowsH .= '<tr><td style="padding:14px 0;border-top:1px solid #eef0f6;width:110px;font:600 11px/16px Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8b90a7;vertical-align:top">' . $e((string)$k) . '</td><td style="padding:14px 0;border-top:1px solid #eef0f6;font:500 15px/22px Arial,Helvetica,sans-serif;color:#151833">' . $val . '</td></tr>';
    }
    $msgH = $message === '' ? '' : '<tr><td style="padding:6px 36px 4px"><div style="font:600 11px/16px Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8b90a7;padding-bottom:10px">Message</div><div style="background:#f6f7fd;border-left:4px solid #6366f1;border-radius:0 14px 14px 0;padding:20px 22px;font:400 16px/26px Arial,Helvetica,sans-serif;color:#23264a">' . nl2br($e($message), false) . '</div></td></tr>';
    $btn = ($cta !== '' && $ctaUrl !== '') ? '<tr><td style="padding:26px 36px 8px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:999px;background:#4f46e5;background-image:linear-gradient(135deg,#22d3ee,#6366f1 55%,#a855f7)"><a href="' . $e($ctaUrl) . '" style="display:inline-block;padding:14px 30px;font:700 15px/20px Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px">' . $e($cta) . ' &rarr;</a></td></tr></table></td></tr>' : '';
    $noteH = $note === '' ? '' : '<tr><td style="padding:18px 36px 0;font:400 13px/20px Arial,Helvetica,sans-serif;color:#8b90a7">' . $e($note) . '</td></tr>';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' . $e($title) . '</title></head>'
    . '<body style="margin:0;padding:0;background:#eceef8"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' . $e($kicker . ': ' . $title) . '</div>'
    . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eceef8"><tr><td align="center" style="padding:32px 14px">'
    . '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px -20px rgba(40,40,120,.35)">'
    . '<tr><td style="background:#0a0c22;background-image:linear-gradient(135deg,#0a0c22 0%,#1b1f5e 60%,#3b2a8c 100%);padding:34px 36px 30px">'
    . '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:middle"><img src="' . $site . '/assets/img/icon-192.png" width="44" height="44" alt="IQ" style="display:block;border:0;border-radius:12px"></td>'
    . '<td style="padding-left:14px;vertical-align:middle;font:800 21px/22px Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-.01em">Intellytiq<div style="font:600 10px/14px Arial,Helvetica,sans-serif;letter-spacing:.32em;color:#a9b0ff;padding-top:3px">SOLUTIONS</div></td></tr></table>'
    . '<div style="padding-top:26px;font:700 11px/16px Arial,Helvetica,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#67e8f9">' . $e($kicker) . '</div>'
    . '<div style="padding-top:8px;font:800 28px/34px Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-.02em">' . $e($title) . '</div></td></tr>'
    . '<tr><td style="height:4px;line-height:4px;font-size:0;background:#6366f1;background-image:linear-gradient(90deg,#22d3ee,#6366f1,#a855f7,#ec4899)">&nbsp;</td></tr>'
    . ($rowsH !== '' ? '<tr><td style="padding:14px 36px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' . $rowsH . '</table></td></tr>' : '')
    . $msgH . $btn . $noteH
    . '<tr><td style="padding:30px 36px 32px"><div style="border-top:1px solid #eef0f6;padding-top:20px;font:400 12.5px/20px Arial,Helvetica,sans-serif;color:#8b90a7">Sent automatically from the <a href="' . $site . '" style="color:#4f46e5;text-decoration:none;font-weight:600">Intellytiq Solutions</a> website. Reply to this email to answer the sender directly.<br>Data engineering &amp; cloud, delivered remotely &middot; 24&times;7&times;365</div></td></tr>'
    . '</table></td></tr></table></body></html>';
}
/** Returns ['ok'=>bool,'via'=>'smtp'|'mail','error'=>string|null,'to'=>string] */
function send_notification(string $subject, string $body, string $replyTo, ?string $html = null): array {
    $cfg = read_json('config.json', [])['smtp'] ?? []; $settings = site_settings();
    $to = filter_var($cfg['to'] ?? '', FILTER_VALIDATE_EMAIL) ? $cfg['to'] : ($settings['email'] ?? '');
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'via' => 'none', 'error' => 'No valid notification email address is set (Admin > Email)', 'to' => (string)$to];
    if (!empty($cfg['host']) && !empty($cfg['user'])) {
        $err = null; $ok = smtp_send($cfg, $to, $subject, $body, $replyTo, $err, $html);
        return ['ok' => $ok, 'via' => 'smtp', 'error' => $ok ? null : $err, 'to' => $to];
    }
    $from = filter_var($settings['email'] ?? '', FILTER_VALIDATE_EMAIL) ? $settings['email'] : ('no-reply@' . main_domain());
    $ct = ''; $payload = mail_mime($body, $html, $ct);
    $headers = "From: Intellytiq Website <$from>\r\nReply-To: " . mail_clean($replyTo) . "\r\nMIME-Version: 1.0\r\nContent-Type: $ct";
    $ok = @mail($to, '=?UTF-8?B?' . base64_encode(mail_clean($subject)) . '?=', $payload, $headers, '-f' . $from);
    return ['ok' => $ok, 'via' => 'mail', 'error' => $ok ? 'Handed to the server mail queue. Delivery is not confirmed; set up SMTP under Admin > Email for reliable delivery.' : 'The server rejected the message', 'to' => $to];
}

/* ---------- sessions and request guards ---------- */
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
function start_session(): void {
    global $https;
    if (session_status() === PHP_SESSION_ACTIVE) return;
    @ini_set('session.use_strict_mode', '1'); @ini_set('session.use_only_cookies', '1'); @ini_set('session.gc_maxlifetime', (string)SESSION_MAX);
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
    session_name($https ? '__Host-iqadmin' : 'iqadmin');
    session_start();
}
function session_valid(): bool {
    start_session();
    $ua = hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')); $now = time();
    if (empty($_SESSION['ok']) || ($_SESSION['ua'] ?? '') !== $ua || $now - (int)($_SESSION['last'] ?? 0) > SESSION_IDLE || $now - (int)($_SESSION['start'] ?? 0) > SESSION_MAX) {
        $_SESSION = []; return false;
    }
    $_SESSION['last'] = $now; return true;
}
function is_default_pw(): bool { return empty(read_json('config.json', [])['hash']); }
function need_auth(bool $allowDefault = false): void {
    if (!session_valid()) out(['error' => 'Unauthorized'], 401);
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($t) || !hash_equals((string)($_SESSION['csrf'] ?? ''), $t)) out(['error' => 'Bad CSRF token'], 403);
    }
    if (!$allowDefault && is_default_pw()) out(['error' => 'Change the default password first (Security tab).', 'code' => 'default_password'], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$a = (string)($_GET['a'] ?? '');
if (!in_array($method, ['GET', 'POST'], true)) out(['error' => 'Method not allowed'], 405);
if ($method === 'POST') {
    if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) out(['error' => 'Unsupported content type'], 415);
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '') {
        $oh = strtolower((string)parse_url($origin, PHP_URL_HOST)); $hh = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
        if ($origin === 'null' || $oh === '' || $oh !== $hh) out(['error' => 'Cross-site request blocked'], 403);
    }
    if (strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin')) === 'cross-site') out(['error' => 'Cross-site request blocked'], 403);
}

function valid_new_password(string $new, string $current): ?string {
    if (strlen($new) < 12) return 'The new password must be at least 12 characters.';
    if (!preg_match('/[A-Za-z]/', $new) || !preg_match('/\d/', $new)) return 'Use both letters and numbers in the new password.';
    if (strcasecmp($new, 'admin') === 0 || hash_equals($current, $new)) return 'Choose a password that is different from the current one.';
    return null;
}

switch ($a) {
    case 'content': {
        $defaults = read_json_file($root . '/data/defaults.json');
        $over = read_json('content.json', []);
        foreach (COLLECTIONS as $k => $_) if (array_key_exists($k, $over)) $defaults[$k] = $over[$k];
        header('Cache-Control: public, max-age=30');
        out($defaults);
    }

    case 'captcha': {
        if ($method !== 'GET') out(['error' => 'GET only'], 405);
        throttle('captcha', 80, 3600); throttle('captcha', 1500, 3600, true);
        out(captcha_issue(($_GET['type'] ?? '') === 'text'));
    }

    case 'contact': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        $d = body();
        if (!empty($d['hp'])) out(['ok' => true]);               // honeypot: pretend success
        throttle('contact', 5, 3600); throttle('contact', 120, 3600, true);
        $name = clean((string)($d['name'] ?? ''), 120); $email = clean((string)($d['email'] ?? ''), 160);
        $msg = clean((string)($d['message'] ?? ''), 5000);
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($msg) < 10) out(['error' => 'Please provide your name, a valid email and a message (10+ characters).'], 422);
        if (!captcha_check($d)) captcha_fail();
        $row = ['id' => bin2hex(random_bytes(5)), 'at' => gmdate('c'), 'name' => $name, 'email' => $email,
                'company' => clean((string)($d['company'] ?? ''), 160), 'topic' => clean((string)($d['topic'] ?? ''), 120), 'message' => $msg, 'ip' => ip()];
        $html = mail_html('New website enquiry', 'From ' . $name, ['Name' => $name, 'Email' => $email, 'Company' => $row['company'], 'Topic' => $row['topic'], 'Received' => gmdate('D j M Y, H:i') . ' UTC'], $msg, 'Reply to ' . strtok($name, ' '), 'mailto:' . $email . '?subject=' . rawurlencode('Re: your enquiry to Intellytiq Solutions'), 'Quick tip: just hit Reply. The sender’s address is already set.');
        $mail = send_notification('[Website] New enquiry from ' . mail_clean($name), "Name: $name\nEmail: $email\nCompany: {$row['company']}\nTopic: {$row['topic']}\n\n$msg\n\n-- Sent from the Intellytiq website contact form", $email, $html);
        $row['mail'] = ['ok' => $mail['ok'], 'via' => $mail['via'], 'error' => $mail['error'], 'to' => $mail['to']];
        $all = read_json('messages.json', []); array_unshift($all, $row); write_json('messages.json', array_slice($all, 0, 1000));
        out(['ok' => true]);
    }

    case 'subscribe': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        $d = body();
        throttle('sub', 5, 3600); throttle('sub', 200, 3600, true);
        $email = clean((string)($d['email'] ?? ''), 160);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(['error' => 'Enter a valid email address.'], 422);
        if (!captcha_check($d)) captcha_fail();
        $all = read_json('subscribers.json', []);
        if (count($all) < 20000 && !in_array($email, array_column($all, 'email'), true)) { $all[] = ['email' => $email, 'at' => gmdate('c')]; write_json('subscribers.json', $all); }
        out(['ok' => true]);
    }

    case 'login': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        throttle('login', 8, 900); throttle('login', 40, 3600, true);
        $d = body(); $cfg = read_json('config.json', []);
        if (!captcha_check($d)) { audit('login blocked: wrong security code'); captcha_fail(); }
        $hash = $cfg['hash'] ?? password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
        $okUser = hash_equals(ADMIN_USER, (string)($d['user'] ?? ''));
        $okPass = password_verify((string)($d['pass'] ?? ''), $hash);
        if (!($okUser && $okPass)) { audit('login failed'); usleep(random_int(400000, 900000)); out(['error' => 'Invalid user id or password'], 401); }
        start_session(); session_regenerate_id(true);
        $_SESSION = ['ok' => true, 'csrf' => bin2hex(random_bytes(16)), 'ua' => hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 'last' => time(), 'start' => time()];
        audit('login success');
        out(['ok' => true, 'csrf' => $_SESSION['csrf'], 'defaultPassword' => !isset($cfg['hash'])]);
    }

    case 'me': {
        if (!session_valid()) out(['auth' => false]);
        out(['auth' => true, 'csrf' => $_SESSION['csrf'], 'defaultPassword' => is_default_pw()]);
    }

    case 'logout': {
        start_session(); $_SESSION = []; if (session_status() === PHP_SESSION_ACTIVE) session_destroy(); out(['ok' => true]);
    }

    case 'save': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $d = body(MAX_BODY_ADMIN); $key = (string)($d['key'] ?? ''); $val = $d['value'] ?? null;
        if (!isset(COLLECTIONS[$key])) out(['error' => 'Unknown collection'], 422);
        if (!is_array($val)) out(['error' => 'Invalid value'], 422);
        $val = clean_value($val, '');
        $isList = array_is_list($val);
        if ((COLLECTIONS[$key] === 'array') !== $isList && $val !== []) out(['error' => 'Wrong data shape for ' . $key], 422);
        $over = read_json('content.json', []);
        $over[$key] = $val;
        if (!write_json('content.json', $over)) out(['error' => 'Could not write to storage. Check folder permissions.'], 500);
        audit('content saved: ' . $key);
        out(['ok' => true]);
    }

    case 'reset': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $key = (string)(body()['key'] ?? '');
        $over = read_json('content.json', []); unset($over[$key]); write_json('content.json', $over);
        out(['ok' => true]);
    }

    case 'messages': {
        need_auth();
        out(['messages' => read_json('messages.json', []), 'subscribers' => read_json('subscribers.json', [])]);
    }

    case 'delete_message': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $id = (string)(body()['id'] ?? '');
        $all = array_values(array_filter(read_json('messages.json', []), fn($m) => ($m['id'] ?? '') !== $id));
        write_json('messages.json', $all); out(['ok' => true]);
    }

    case 'audit': {
        need_auth();
        out(['events' => read_json('audit.json', [])]);
    }

    case 'passwd': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth(true);
        throttle('passwd', 6, 900);
        $d = body(); $cfg = read_json('config.json', []);
        $hash = $cfg['hash'] ?? password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
        $cur = (string)($d['current'] ?? ''); $new = (string)($d['new'] ?? '');
        if (!password_verify($cur, $hash)) { audit('password change failed'); out(['error' => 'Current password is incorrect'], 403); }
        if (($msg = valid_new_password($new, $cur)) !== null) out(['error' => $msg], 422);
        $cfg['hash'] = password_hash($new, PASSWORD_DEFAULT);
        write_json('config.json', $cfg);
        session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(16));
        audit('password changed');
        out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
    }

    case 'upload': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        throttle('upload', 150, 3600);
        $d = body(MAX_BODY_ADMIN); $data = (string)($d['data'] ?? ''); $kind = (string)($d['kind'] ?? 'team');
        if (!in_array($kind, ['team', 'avatar', 'cover', 'logo', 'inline'], true)) out(['error' => 'Unknown upload type'], 422);
        if (!preg_match('#^data:image/(jpeg|png|webp);base64,#', $data, $m)) out(['error' => 'Please choose a JPG, PNG or WebP image.'], 422);
        $bin = base64_decode(substr($data, strlen($m[0])), true);
        if ($bin === false || $bin === '') out(['error' => 'That image could not be read.'], 422);
        if (strlen($bin) > 1_100_000) out(['error' => 'The image is too large after resizing. Try a smaller picture.'], 413);
        $info = @getimagesizefromstring($bin);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true) || $info[0] > 6000 || $info[1] > 6000 || $info[0] < 16 || $info[1] < 16 || ($kind !== 'logo' && ($info[0] < 40 || $info[1] < 40))) out(['error' => 'That does not look like a valid image.'], 422);
        if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) out(['error' => 'Image processing is not available on this server.'], 500);
        $im = @imagecreatefromstring($bin);
        if (!$im) out(['error' => 'That image could not be processed.'], 422);
        [$res, $ext, $sub] = render_image($im, $kind);                               // re-encoding drops metadata and any hidden payload
        $name = bin2hex(random_bytes(12)) . '.' . $ext; $path = ensure_uploads($sub) . '/' . $name;
        $ok = $ext === 'png' ? @imagepng($res, $path, 6) : @imagejpeg($res, $path, 86);
        if (!$ok) out(['error' => 'Could not save the image. Check folder permissions.'], 500);
        @chmod($path, 0644); imagedestroy($im); imagedestroy($res);
        cleanup_media(); audit("image uploaded ($kind)");
        out(['ok' => true, 'url' => "uploads/$sub/$name"]);
    }

    case 'upload_video_start': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        throttle('vstart', 40, 3600);
        $d = body(); $size = (int)($d['size'] ?? 0);
        if ($size < 2000) out(['error' => 'That file is too small to be a video.'], 422);
        if ($size > MAX_VIDEO) out(['error' => 'Videos can be up to 50 MB. Compress it first, for example to 720p.'], 413);
        cleanup_media();
        $id = bin2hex(random_bytes(8));
        if (@file_put_contents($store . "/vid-$id.part", '') === false) out(['error' => 'Could not prepare the upload. Check folder permissions.'], 500);
        write_json("vid-$id.json", ['size' => $size, 'ts' => time()]);
        out(['ok' => true, 'id' => $id, 'chunk' => 524288]);
    }

    case 'upload_video_chunk': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        throttle('vchunk', 3000, 3600);
        $d = body(MAX_BODY_ADMIN); $id = (string)($d['id'] ?? '');
        if (!preg_match('/^[a-f0-9]{16}$/', $id)) out(['error' => 'Bad upload id'], 422);
        $meta = read_json("vid-$id.json", null); $part = $store . "/vid-$id.part";
        if (!$meta || !is_file($part)) out(['error' => 'Upload not found. Please start again.'], 404);
        $off = (int)($d['offset'] ?? -1); clearstatcache(true, $part);
        if ($off !== filesize($part)) out(['error' => 'Upload out of sequence. Please start again.', 'expected' => filesize($part)], 409);
        $bin = base64_decode((string)($d['data'] ?? ''), true);
        if ($bin === false || $bin === '' || strlen($bin) > VIDEO_CHUNK) out(['error' => 'Bad chunk'], 422);
        if ($off + strlen($bin) > $meta['size']) out(['error' => 'More data than announced'], 422);
        if (@file_put_contents($part, $bin, FILE_APPEND | LOCK_EX) === false) out(['error' => 'Could not write the upload.'], 500);
        out(['ok' => true, 'received' => $off + strlen($bin)]);
    }

    case 'upload_video_finish': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $d = body(); $id = (string)($d['id'] ?? '');
        if (!preg_match('/^[a-f0-9]{16}$/', $id)) out(['error' => 'Bad upload id'], 422);
        $meta = read_json("vid-$id.json", null); $part = $store . "/vid-$id.part";
        if (!$meta || !is_file($part)) out(['error' => 'Upload not found. Please start again.'], 404);
        clearstatcache(true, $part);
        $drop = function () use ($part, $id) { @unlink($part); @unlink(spath("vid-$id.json")); };
        if (filesize($part) !== (int)$meta['size']) { $drop(); out(['error' => 'The upload was incomplete. Please try again.'], 422); }
        $head = (string)file_get_contents($part, false, null, 0, 16);
        if (substr($head, 4, 4) === 'ftyp') $ext = 'mp4';
        elseif (substr($head, 0, 4) === "\x1A\x45\xDF\xA3") $ext = 'webm';
        else { $drop(); out(['error' => 'That is not an MP4 or WebM video.'], 422); }
        $name = bin2hex(random_bytes(12)) . '.' . $ext; $dest = ensure_uploads('media') . '/' . $name;
        if (!@rename($part, $dest) && !(@copy($part, $dest) && @unlink($part))) { $drop(); out(['error' => 'Could not save the video. Check folder permissions.'], 500); }
        @chmod($dest, 0644); @unlink(spath("vid-$id.json"));
        audit('video uploaded');
        out(['ok' => true, 'url' => 'uploads/media/' . $name, 'size' => (int)$meta['size']]);
    }

    case 'mail_get': {
        need_auth();
        $c = read_json('config.json', [])['smtp'] ?? []; $settings = site_settings();
        out(['host' => $c['host'] ?? 'smtp.hostinger.com', 'port' => $c['port'] ?? 465, 'secure' => $c['secure'] ?? 'ssl', 'user' => $c['user'] ?? '', 'from' => $c['from'] ?? '',
             'to' => $c['to'] ?? ($settings['email'] ?? ''), 'has_pass' => !empty($c['pass']), 'configured' => !empty($c['host']) && !empty($c['user']) && !empty($c['pass'])]);
    }

    case 'mail_save': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $d = body(); $cfg = read_json('config.json', []); $old = $cfg['smtp'] ?? [];
        $host = clean((string)($d['host'] ?? ''), 200); $port = (int)($d['port'] ?? 465); $sec = (string)($d['secure'] ?? 'ssl');
        $user = clean((string)($d['user'] ?? ''), 200); $from = clean((string)($d['from'] ?? ''), 200); $to = clean((string)($d['to'] ?? ''), 200);
        if (!in_array($sec, ['ssl', 'tls', 'none'], true)) out(['error' => 'Choose SSL, TLS or None'], 422);
        if ($port < 1 || $port > 65535) out(['error' => 'Enter a valid port'], 422);
        if ($host !== '' && !preg_match('/^[a-z0-9.-]+$/i', $host)) out(['error' => 'Enter a valid SMTP host'], 422);
        foreach (['Username' => $user, 'From address' => $from, 'Notification address' => $to] as $label => $v) {
            if ($v !== '' && !filter_var($v, FILTER_VALIDATE_EMAIL)) out(['error' => "$label must be an email address"], 422);
        }
        $pass = (string)($d['pass'] ?? '');
        $cfg['smtp'] = ['host' => $host, 'port' => $port, 'secure' => $sec, 'user' => $user, 'from' => $from, 'to' => $to, 'pass' => $pass !== '' ? $pass : ($old['pass'] ?? '')];
        if (!write_json('config.json', $cfg)) out(['error' => 'Could not write to storage. Check folder permissions.'], 500);
        audit('email settings saved');
        out(['ok' => true]);
    }

    case 'mail_test': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        throttle('mailtest', 8, 900);
        out(send_notification('Test email from the Intellytiq website', "This is a test message.\n\nIf you can read this, enquiries from the contact form will reach this mailbox.\nSent: " . gmdate('c'), '', mail_html('Email test', 'Your email is working', ['Status' => 'Delivered', 'Sent' => gmdate('D j M Y, H:i') . ' UTC'], 'If you can read this, enquiries from the contact form will reach this mailbox. Every message from the website will arrive in this layout.')));
    }

    default: out(['error' => 'Not found'], 404);
}
