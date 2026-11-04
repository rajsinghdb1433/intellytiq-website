#!/usr/bin/env bash
# Builds a PHP-free, browser-only preview of the site into the directory given as $1.
set -euo pipefail
OUT="$1"; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$ROOT"/*.html "$ROOT"/assets "$ROOT"/data "$ROOT"/admin "$OUT"/
cp "$ROOT/tools/preview/demo.js" "$OUT/assets/js/demo.js"
rm -f "$OUT/data/captcha.ttf" "$OUT/data/captcha-font-LICENSE.txt" "$OUT/admin/.htaccess"
cd "$OUT"
mv index.html home.html; mv admin/index.html admin/home.html
for f in *.html; do sed -i 's#<script src="assets/js/app.js" defer>#<script src="assets/js/demo.js"></script>\n<script src="assets/js/app.js" defer>#' "$f"; done
sed -i 's#<script src="admin.js">#<script src="../assets/js/demo.js"></script>\n<script src="admin.js">#' admin/home.html
grep -rl "index.html" --include=*.html --include=*.js . | xargs sed -i 's#admin/"#admin/home.html"#g; s#index\.html#home.html#g'
cp "$ROOT/tools/preview/launcher.html" index.html
