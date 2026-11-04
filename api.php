<?php
/**
 * Intellytiq Solutions: tiny JSON API (no database required).
 * Public:  GET  ?a=content | POST ?a=contact | POST ?a=subscribe
 * Admin:   POST ?a=login|logout|save|reset|messages|delete_message|passwd  (session + CSRF protected)
 * Runtime data lives in ./storage (git-ignored, web-denied) so redeploys never wipe admin edits.
 */
declare(strict_types=1);

const COLLECTIONS = [
    'settings' => 'object', 'services' => 'array', 'technologies' => 'array', 'process' => 'array',
    'industries' => 'array', 'team' => 'array', 'posts' => 'array', 'projects' => 'array',
    'careers' => 'array', 'testimonials' => 'array', 'faqs' => 'array', 'values' => 'array', 'timeline' => 'array',
];
const ADMIN_USER = 'admin';
const DEFAULT_PASSWORD = 'admin';   // change from Admin > Security after first login
const MAX_BODY = 1_500_000;

$root = __DIR__;
$store = $root . '/storage';
if (!is_dir($store)) {
    @mkdir($store, 0750, true);
    @file_put_contents($store . '/.htaccess', "Require all denied\nDeny from all\n");
    @file_put_contents($store . '/index.html', '');
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out($data, int $code = 200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function read_json(string $file, $default) {
    if (!is_file($file)) return $default;
    $d = json_decode((string)@file_get_contents($file), true);
    return $d === null ? $default : $d;
}
function write_json(string $file, $data): bool {
    $tmp = $file . '.tmp' . bin2hex(random_bytes(3));
    if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) === false) return false;
    return @rename($tmp, $file);
}
function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || strlen($raw) > MAX_BODY) out(['error' => 'Payload too large'], 413);
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}
function ip(): string { return substr(preg_replace('/[^0-9a-fA-F:.,]/', '', $_SERVER['REMOTE_ADDR'] ?? 'x'), 0, 45); }
function throttle(string $bucket, int $max, int $window): void {
    global $store;
    $f = "$store/throttle.json"; $all = read_json($f, []); $now = time(); $k = $bucket . ':' . ip();
    $hits = array_values(array_filter($all[$k] ?? [], fn($t) => $t > $now - $window));
    if (count($hits) >= $max) out(['error' => 'Too many attempts. Please try again later.'], 429);
    $hits[] = $now; $all[$k] = $hits;
    foreach ($all as $kk => $v) { if (!array_filter($v, fn($t) => $t > $now - 3600)) unset($all[$kk]); }
    write_json($f, $all);
}
function clean(string $s, int $max = 4000): string { return mb_substr(trim(strip_tags($s)), 0, $max); }

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_name('iqadmin');

$a = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function need_auth(): void {
    session_start();
    if (empty($_SESSION['ok'])) out(['error' => 'Unauthorized'], 401);
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($t) || !hash_equals($_SESSION['csrf'] ?? '', $t)) out(['error' => 'Bad CSRF token'], 403);
    }
}

switch ($a) {
    case 'content': {
        $defaults = read_json($root . '/data/defaults.json', []);
        $over = read_json($store . '/content.json', []);
        foreach (COLLECTIONS as $k => $_) if (array_key_exists($k, $over)) $defaults[$k] = $over[$k];
        header('Cache-Control: public, max-age=30');
        out($defaults);
    }

    case 'contact': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        $d = body();
        if (!empty($d['hp'])) out(['ok' => true]);               // honeypot
        throttle('contact', 5, 3600);
        $name = clean((string)($d['name'] ?? ''), 120); $email = clean((string)($d['email'] ?? ''), 160);
        $msg = clean((string)($d['message'] ?? ''), 5000);
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($msg) < 10) out(['error' => 'Please provide your name, a valid email and a message (10+ characters).'], 422);
        $row = ['id' => bin2hex(random_bytes(5)), 'at' => gmdate('c'), 'name' => $name, 'email' => $email,
                'company' => clean((string)($d['company'] ?? ''), 160), 'topic' => clean((string)($d['topic'] ?? ''), 120), 'message' => $msg, 'ip' => ip()];
        $all = read_json($store . '/messages.json', []); array_unshift($all, $row); write_json($store . '/messages.json', array_slice($all, 0, 1000));
        $settings = (read_json($store . '/content.json', [])['settings'] ?? read_json($root . '/data/defaults.json', [])['settings'] ?? []);
        $to = $settings['email'] ?? '';
        if (filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $subject = '[Website] New enquiry from ' . preg_replace('/[\r\n]+/', ' ', $name);
            $headers = "From: no-reply@" . preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost') . "\r\nReply-To: " . preg_replace('/[\r\n]+/', '', $email) . "\r\nContent-Type: text/plain; charset=utf-8";
            @mail($to, $subject, "Name: $name\nEmail: $email\nCompany: {$row['company']}\nTopic: {$row['topic']}\n\n$msg", $headers);
        }
        out(['ok' => true]);
    }

    case 'subscribe': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        throttle('sub', 5, 3600);
        $email = clean((string)(body()['email'] ?? ''), 160);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(['error' => 'Enter a valid email address.'], 422);
        $all = read_json($store . '/subscribers.json', []);
        if (!in_array($email, array_column($all, 'email'), true)) { $all[] = ['email' => $email, 'at' => gmdate('c')]; write_json($store . '/subscribers.json', $all); }
        out(['ok' => true]);
    }

    case 'login': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        throttle('login', 8, 900);
        $d = body(); $cfg = read_json($store . '/config.json', []);
        $hash = $cfg['hash'] ?? password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
        $okUser = hash_equals(ADMIN_USER, (string)($d['user'] ?? ''));
        $okPass = password_verify((string)($d['pass'] ?? ''), $hash);
        if (!($okUser && $okPass)) out(['error' => 'Invalid user id or password'], 401);
        session_start(); session_regenerate_id(true);
        $_SESSION['ok'] = true; $_SESSION['csrf'] = bin2hex(random_bytes(16));
        out(['ok' => true, 'csrf' => $_SESSION['csrf'], 'defaultPassword' => !isset($cfg['hash'])]);
    }

    case 'me': {
        session_start();
        if (empty($_SESSION['ok'])) out(['auth' => false]);
        $cfg = read_json($store . '/config.json', []);
        out(['auth' => true, 'csrf' => $_SESSION['csrf'], 'defaultPassword' => !isset($cfg['hash'])]);
    }

    case 'logout': {
        session_start(); $_SESSION = []; session_destroy(); out(['ok' => true]);
    }

    case 'save': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $d = body(); $key = (string)($d['key'] ?? ''); $val = $d['value'] ?? null;
        if (!isset(COLLECTIONS[$key])) out(['error' => 'Unknown collection'], 422);
        if (!is_array($val)) out(['error' => 'Invalid value'], 422);
        $isList = array_is_list($val);
        if ((COLLECTIONS[$key] === 'array') !== $isList && !($val === [] )) out(['error' => 'Wrong data shape for ' . $key], 422);
        $over = read_json($store . '/content.json', []);
        $over[$key] = $val;
        if (!write_json($store . '/content.json', $over)) out(['error' => 'Could not write to storage. Check folder permissions.'], 500);
        out(['ok' => true]);
    }

    case 'reset': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $key = (string)(body()['key'] ?? '');
        $over = read_json($store . '/content.json', []); unset($over[$key]); write_json($store . '/content.json', $over);
        out(['ok' => true]);
    }

    case 'messages': {
        need_auth();
        out(['messages' => read_json($store . '/messages.json', []), 'subscribers' => read_json($store . '/subscribers.json', [])]);
    }

    case 'delete_message': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $id = (string)(body()['id'] ?? '');
        $all = array_values(array_filter(read_json($store . '/messages.json', []), fn($m) => ($m['id'] ?? '') !== $id));
        write_json($store . '/messages.json', $all); out(['ok' => true]);
    }

    case 'passwd': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        throttle('passwd', 6, 900);
        $d = body(); $cfg = read_json($store . '/config.json', []);
        $hash = $cfg['hash'] ?? password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
        if (!password_verify((string)($d['current'] ?? ''), $hash)) out(['error' => 'Current password is incorrect'], 403);
        $new = (string)($d['new'] ?? '');
        if (strlen($new) < 8) out(['error' => 'New password must be at least 8 characters'], 422);
        $cfg['hash'] = password_hash($new, PASSWORD_DEFAULT);
        write_json($store . '/config.json', $cfg); out(['ok' => true]);
    }

    default: out(['error' => 'Not found'], 404);
}
