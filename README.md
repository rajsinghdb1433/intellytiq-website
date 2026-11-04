# Intellytiq Solutions website

Animated, Apple-inspired marketing site with an admin panel, built for Hostinger shared hosting (static files + PHP, **no database required**).

## Structure
| Path | Purpose |
|---|---|
| `*.html` | Generated pages (do not edit by hand; edit `tools/gen.mjs`) |
| `tools/gen.mjs` | Page generator: `node tools/gen.mjs` (set `SITE_URL=https://yourdomain` for sitemap/canonical) |
| `assets/` | CSS and the JS engine (`app.js`: layout, animation, rendering) |
| `data/defaults.json` | Built-in content (services, team, blog, etc.) |
| `api.php` | JSON API: public content, contact form, newsletter, admin auth and saves |
| `admin/` | Admin panel at `/admin/` |
| `storage/` | **Runtime data** (admin edits, messages). Git-ignored and web-denied, so redeploys never wipe it |

## Admin
Open `/admin/`. Initial login is `admin` / `admin`; **change the password immediately** under Security.
Admin edits are saved to `storage/content.json` and override `data/defaults.json` per section ("Restore defaults" reverts a section).

## Local preview
```bash
php -S 127.0.0.1:8080
```

## Deploy
Hostinger Git deployment (hPanel → Git) or `hosting_deploy` from this repository, branch `main`. Pushes auto-deploy.
After the first deploy make sure the site root is writable by PHP so `storage/` can be created.

## Notes
- Team "Open Role" cards, stats, testimonials and case studies are **sample content**: replace them in the admin panel.
- Privacy and Terms pages are templates and should be reviewed by counsel.

## Email notifications (contact form)
Enquiries are always saved under **Admin → Messages**. To also receive them by email:
1. Sign in at `/admin/` → **Email**.
2. Enter the recipient, a real mailbox on your domain as the sender (for Hostinger: `smtp.hostinger.com`, port 465, SSL), and that mailbox's password.
3. Click **Send test email**. Each message in the inbox then shows whether its notification was delivered.

The password is stored only in `storage/config.json` on the server (git-ignored, web-denied).
