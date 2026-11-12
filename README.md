# Exploriva Travels

Website for **Exploriva Travels** (explorivatravels.com): small-group trips for women.
Node.js 20+, Express, server-rendered EJS, Tailwind via CDN, no database. Trips live in a CSV file.

## Run it

```bash
npm install
cp .env.example .env        # then edit .env (see below)
npm start                   # http://localhost:3000
npm test                    # node:test + supertest
```

`data/trips.csv` is created (header only) if it doesn't exist. To fill it with 4 sample trips
(dates are relative to today, images are the placeholders in `public/img/trips/`):

```bash
npm run seed                # refuses to overwrite existing trips unless you add: -- --force
```

## Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Long random string. **Required in production.** |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (see below). Admin login is disabled while empty. |
| `CONTACT_EMAIL`, `CONTACT_PHONE`, `WHATSAPP_NUMBER` | Contact details (see below). |
| `SITE_URL` | Public URL, used for canonical / Open Graph / sitemap links. |
| `PORT`, `NODE_ENV`, `TRUST_PROXY`, `TIMEZONE` | Optional. `TIMEZONE` (default `Asia/Kolkata`) decides what "today" means for dates. |

## Changing the contact details

Edit `CONTACT_EMAIL`, `CONTACT_PHONE` and `WHATSAPP_NUMBER` in `.env` and restart. They are read once, in
`src/config.js`, and used by the footer, Contact page and WhatsApp buttons.
`WHATSAPP_NUMBER` is digits only, with country code (`918097194290` -> `https://wa.me/918097194290`).

## Admin

The admin login is not linked from anywhere on the site. Open `/login` directly. Username: `admin`.
Everything under `/admin` returns a plain 404 unless you have a valid logged-in session.

**Change the password:**

```bash
node scripts/hash-password.js      # prompts (hidden input), prints ADMIN_PASSWORD_HASH=$2b$12$...
```

Paste the printed line into `.env` (replace the old one) and restart. Only the hash is stored; the script
never saves or prints the password. 5 failed logins from one IP lock that IP out for 15 minutes
(the counter is in memory, so a restart clears it). Sessions expire after 30 minutes of inactivity.

**Adding a trip:** `/admin/trips/new`: title, destination, dates (start today or later), price (₹ per person),
blurb, description and 2-10 JPG/PNG/WebP images (5 MB max each, the first is the cover). The same page lists
existing trips with a delete button, which removes the CSV row and its uploaded images.

**Reviews:** visitors submit reviews on `/reviews`; nothing is public until you approve it at `/admin/reviews`
(approve or delete there; the admin Trips page has a Reviews button). Submissions are limited to 5 per IP per hour
and protected by CSRF and a hidden honeypot field.

## Where things are stored

| What | Where |
| --- | --- |
| Trips | `data/trips.csv` (written atomically; reads and writes are serialized in-process) |
| Reviews | `data/reviews.csv` (public submissions start as `pending`) |
| Uploaded images | `uploads/` (UUID file names), served at `/uploads/...` |
| Sessions | `sessions/` (files) |
| Placeholder images | `public/img/trips/` |

`data/`, `uploads/`, `sessions/` and `.env` are git-ignored. **Back up `data/` and `uploads/`.**
Override locations with `DATA_DIR`, `UPLOADS_DIR`, `SESSIONS_DIR`.
Run a **single process** (don't use pm2 cluster mode): the CSV lock and login rate limiter are in-process.

## Production

Run behind HTTPS (nginx, Caddy, ...) with `NODE_ENV=production`. That sets `trust proxy` so the session
cookie gets the `Secure` flag; forward `X-Forwarded-Proto`. Set a real `SESSION_SECRET` and `SITE_URL`.

**pm2**

```bash
npm install --omit=dev
NODE_ENV=production pm2 start server.js --name exploriva-travels
pm2 save && pm2 startup
```

**systemd** (`/etc/systemd/system/exploriva-travels.service`)

```ini
[Unit]
Description=Exploriva Travels
After=network.target

[Service]
WorkingDirectory=/srv/exploriva-travels
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
EnvironmentFile=/srv/exploriva-travels/.env
Restart=always
User=exploriva

[Install]
WantedBy=multi-user.target
```

Keep `ADMIN_PASSWORD_HASH` unquoted in `.env`; the `$` characters in a bcrypt hash are not expanded.

## Notes

- Tailwind and Inter are loaded from CDNs (`cdn.tailwindcss.com`, Google Fonts); the CSP allows exactly those.
- Placeholder images are original abstract SVGs. Regenerate with `node scripts/make-placeholders.js`, or replace with real photos.
- Page copy (home, about) is placeholder wording: edit `views/`.
# ExplorivaTravels
