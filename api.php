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

/* ---------- outgoing email: authenticated SMTP (preferred) or PHP mail() fallback ---------- */
function mail_clean(string $s): string { return trim(preg_replace('/[\r\n]+/', ' ', $s)); }
function smtp_send(array $c, string $to, string $subject, string $body, string $replyTo, ?string &$err): bool {
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
             . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
        $msg = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $body)); $msg = str_replace("\n", "\r\n", $msg);
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
/** Returns ['ok'=>bool,'via'=>'smtp'|'mail','error'=>string|null,'to'=>string] */
function send_notification(string $subject, string $body, string $replyTo): array {
    global $store, $root;
    $cfg = read_json($store . '/config.json', [])['smtp'] ?? [];
    $settings = read_json($store . '/content.json', [])['settings'] ?? read_json($root . '/data/defaults.json', [])['settings'] ?? [];
    $to = filter_var($cfg['to'] ?? '', FILTER_VALIDATE_EMAIL) ? $cfg['to'] : ($settings['email'] ?? '');
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'via' => 'none', 'error' => 'No valid notification email address is set (Admin > Email)', 'to' => (string)$to];
    if (!empty($cfg['host']) && !empty($cfg['user'])) {
        $err = null; $ok = smtp_send($cfg, $to, $subject, $body, $replyTo, $err);
        return ['ok' => $ok, 'via' => 'smtp', 'error' => $ok ? null : $err, 'to' => $to];
    }
    $from = filter_var($settings['email'] ?? '', FILTER_VALIDATE_EMAIL) ? $settings['email'] : ('no-reply@' . main_domain());
    $headers = "From: Intellytiq Website <$from>\r\nReply-To: " . mail_clean($replyTo) . "\r\nContent-Type: text/plain; charset=UTF-8";
    $ok = @mail($to, '=?UTF-8?B?' . base64_encode(mail_clean($subject)) . '?=', $body, $headers, '-f' . $from);
    return ['ok' => $ok, 'via' => 'mail', 'error' => $ok ? 'Handed to the server mail queue. Delivery is not confirmed; set up SMTP under Admin > Email for reliable delivery.' : 'The server rejected the message', 'to' => $to];
}

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
        $mail = send_notification('[Website] New enquiry from ' . $name, "Name: $name\nEmail: $email\nCompany: {$row['company']}\nTopic: {$row['topic']}\n\n$msg\n\n-- Sent from the Intellytiq website contact form", $email);
        $row['mail'] = ['ok' => $mail['ok'], 'via' => $mail['via'], 'error' => $mail['error'], 'to' => $mail['to']];
        $all = read_json($store . '/messages.json', []); array_unshift($all, $row); write_json($store . '/messages.json', array_slice($all, 0, 1000));
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

    case 'mail_get': {
        need_auth();
        $c = read_json($store . '/config.json', [])['smtp'] ?? [];
        $settings = read_json($store . '/content.json', [])['settings'] ?? read_json($root . '/data/defaults.json', [])['settings'] ?? [];
        out(['host' => $c['host'] ?? 'smtp.hostinger.com', 'port' => $c['port'] ?? 465, 'secure' => $c['secure'] ?? 'ssl', 'user' => $c['user'] ?? '', 'from' => $c['from'] ?? '',
             'to' => $c['to'] ?? ($settings['email'] ?? ''), 'has_pass' => !empty($c['pass']), 'configured' => !empty($c['host']) && !empty($c['user']) && !empty($c['pass'])]);
    }

    case 'mail_save': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        $d = body(); $cfg = read_json($store . '/config.json', []); $old = $cfg['smtp'] ?? [];
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
        if (!write_json($store . '/config.json', $cfg)) out(['error' => 'Could not write to storage. Check folder permissions.'], 500);
        out(['ok' => true]);
    }

    case 'mail_test': {
        if ($method !== 'POST') out(['error' => 'POST only'], 405);
        need_auth();
        throttle('mailtest', 8, 900);
        $r = send_notification('Test email from the Intellytiq website', "This is a test message.\n\nIf you can read this, enquiries from the contact form will reach this mailbox.\nSent: " . gmdate('c'), '');
        out($r);
    }

    default: out(['error' => 'Not found'], 404);
}
