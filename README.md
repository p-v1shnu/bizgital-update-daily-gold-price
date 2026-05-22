# Bizgital Update Daily Gold Price

Web app for editing daily gold price data and publishing numeric values to a WordPress website via signed webhook.

## Overview

- Backend: Node.js (`server.js`)
- Frontend: `index.html` + `app.js` + `styles.css`
- Storage: local files (`assets/`, `data/`)
- Security: write-token protected API + static allowlist + body size limits
- New integration: `Publish WordPress` button sends numeric payload to WordPress

## Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Example:

```env
NODE_ENV=production
PORT=3210
WRITE_API_TOKEN=replace-with-a-long-random-token
WP_WEBHOOK_URL=https://client-site.example/wp-json/bizgital/v1/gold-price
WP_WEBHOOK_SECRET=replace-with-wordpress-shared-secret
WP_WEBHOOK_TIMEOUT_MS=8000
```

Notes:
- When `NODE_ENV=production`, `WRITE_API_TOKEN` is required.
- `WP_WEBHOOK_URL` + `WP_WEBHOOK_SECRET` are required only for publish-to-WordPress flow.

## Run

```bash
npm install
npm start
```

Open: `http://127.0.0.1:3210`

## Production

PM2:

```bash
pm2 restart gold-price-editor --update-env || pm2 start server.js --name gold-price-editor
pm2 save
```

Caddy example:

```caddy
gold.example.com {
    basic_auth {
        team01 $2a$14$PUT_HASH_HERE
    }

    @writePaths path /api/layout /api/default-layout /api/template /api/publish-wordpress
    reverse_proxy @writePaths 127.0.0.1:3210 {
        header_up X-Write-Token "SAME_VALUE_AS_WRITE_API_TOKEN"
    }

    reverse_proxy 127.0.0.1:3210
}
```

## WordPress integration (numeric webhook)

### 1) Install plugin on WordPress

Plugin file in this repo:

- `wordpress-plugin/bizgital-gold-price-webhook/bizgital-gold-price-webhook.php`

Install to WordPress:

1. Create directory `wp-content/plugins/bizgital-gold-price-webhook`
2. Upload `bizgital-gold-price-webhook.php`
3. Activate plugin in WordPress admin

### 2) Configure shared secret

In WordPress Admin:

- `Settings` -> `Bizgital Gold Price`
- Set `Webhook Secret` (must match `WP_WEBHOOK_SECRET` in this app)

### 3) Publish from this app

Use `Publish WordPress` button in the web app.

The app sends signed payload to:

- `POST /wp-json/bizgital/v1/gold-price`

Signature headers:

- `X-Bizgital-Timestamp`
- `X-Bizgital-Signature` (`sha256=<hmac>`)

### 4) Show on website

Use shortcode:

```text
[bizgital_gold_price]
```

The plugin renders branded card UI and auto-switches labels for Lao/English by site locale.

## Payload shape sent to WordPress

```json
{
  "source": "bizgital-update-daily-gold-price",
  "sent_at": "2026-05-21T12:34:56.000Z",
  "date": "21/05/2026",
  "time": "11:59",
  "values": {
    "bar_sell_one_baht": 55200000,
    "bar_buy_one_baht": 54670000,
    "print_sell_one_baht": 55300000,
    "print_buy_one_baht": 53890000,
    "print_sell_one_salueng": 13825000,
    "print_buy_one_salueng": 13473000,
    "print_sell_five_houn": 6912000,
    "print_buy_five_houn": 6737000
  }
}
```

## API endpoints (current)

- `GET /api/template`
- `POST /api/template`
- `GET /api/layout`
- `POST /api/layout`
- `GET /api/default-layout`
- `POST /api/default-layout`
- `POST /api/publish-wordpress`

## Quick deploy + test scripts

On Ubuntu server:

```bash
bash scripts/server-update-houn.sh
```

Test publish with new Houn keys:

```bash
WRITE_API_TOKEN="your-token" bash scripts/test-publish-houn.sh
```

On Windows PowerShell:

```powershell
.\scripts\test-publish-houn.ps1 -Token "your-token"
```

If you get `invalid value: printSellFiveTamlueng`, your running process is still old code.
Run server update script, then restart PM2 with `--update-env`.

## Security behavior

1. Write APIs require token (`Authorization: Bearer ...` or `X-Write-Token`)
2. Static allowlist only (`/`, `/app.js`, `/styles.css`, `/assets/fonts/*`)
3. Request size limits:
- template upload: 10MB
- layout/default-layout: 256KB
- publish payload: 64KB
4. No stack traces returned to clients on 500 errors
