# Bizgital Update Daily Gold Price

Web app for editing daily gold price data and publishing numeric values to WordPress via signed webhook.

## Overview

- Backend: `server.js` (Node.js)
- Frontend: `index.html`, `app.js`, `styles.css`
- Storage: local files (`assets/`, `data/`)
- Process manager: PM2
- Reverse proxy: Caddy
- WordPress integration: plugin + signed webhook + shortcode

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
SHOW_LOCAL_TOKEN_INPUT=false
RATE_LIMIT_API_EVENTS=240
RATE_LIMIT_DISPLAY_EVENTS=180
RATE_LIMIT_WRITE_EVENTS=30
WP_WEBHOOK_URL=https://client-site.example/wp-json/bizgital/v1/gold-price
WP_WEBHOOK_SECRET=replace-with-wordpress-shared-secret
WP_WEBHOOK_TIMEOUT_MS=8000
```

Notes:

- `WRITE_API_TOKEN` is required in production.
- `SHOW_LOCAL_TOKEN_INPUT=false` hides the local token field in production UI.
- `WP_WEBHOOK_URL` + `WP_WEBHOOK_SECRET` are required for publish-to-WordPress.

## Run (Local)

```bash
npm install
npm start
```

Open: `http://127.0.0.1:3210`

## Production (PM2 + Caddy)

PM2:

```bash
pm2 restart gold-price-editor --update-env || pm2 start server.js --name gold-price-editor
pm2 save
```

Caddy example:

```caddy
gold.example.com {
    @admin path / /app.js /styles.css /api/layout /api/default-layout /api/template /api/publish-wordpress /api/display-data /api/public-config
    basic_auth @admin {
        team01 $2a$14$PUT_HASH_HERE
    }

    # Public display routes (no basic auth)
    @publicDisplay path /display /display/ /display.js /api/display-data /api/template /api/layout /api/default-layout /assets/fonts/*

    @writePaths path /api/layout /api/default-layout /api/template /api/publish-wordpress /api/display-data
    reverse_proxy @writePaths 127.0.0.1:3210 {
        header_up X-Write-Token "SAME_VALUE_AS_WRITE_API_TOKEN"
    }

    reverse_proxy 127.0.0.1:3210
}
```

Important:

- Rotate real secrets before production (never use placeholder values).
- Keep `/display` public, but keep admin/editor endpoints behind `basic_auth`.

## WordPress Integration

### 1) Install plugin

Use plugin file:

- `wordpress-plugin/bizgital-gold-price-webhook/bizgital-gold-price-webhook.php`

Install by one of these methods:

1. Upload folder to `wp-content/plugins/bizgital-gold-price-webhook` then Activate
2. Zip the folder and upload via `Plugins > Add New > Upload Plugin`

### 2) Configure webhook secret in WordPress

In WP Admin:

- `Settings > Bizgital Gold Price`
- Set `Webhook Secret` to the same value as `WP_WEBHOOK_SECRET` in this app

### 3) Configure app -> WordPress connection

Set in `.env`:

- `WP_WEBHOOK_URL=https://<your-site>/wp-json/bizgital/v1/gold-price`
- `WP_WEBHOOK_SECRET=<same-secret-as-wp-setting>`

Restart app:

```bash
pm2 restart gold-price-editor --update-env
```

### 4) Display on website

Put shortcode in page/post:

```text
[bizgital_gold_price]
```

### 5) Language switch in component

- Component has built-in language switch (`ລາວ` / `EN`)
- Default is Lao
- Does not rely on site locale anymore

## Public display link (same link, auto refresh)

- Public link: `/display`
- Example: `https://gold.example.com/display`
- In editor page, click `ອັບເດດ Public Display` after changing prices
- The display page polls latest data and refreshes automatically on the same URL

## Plugin Update Procedure (No uninstall needed)

You can update plugin in-place (no need to delete old plugin first):

1. Replace plugin file/folder with new version
2. Keep plugin activated
3. Hard refresh page (`Ctrl+F5`) and clear cache/CDN if used

If UI does not change:

- Verify updated file really reached server
- Purge cache plugin and CDN
- Confirm page uses `[bizgital_gold_price]`

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

## API endpoints

- `GET /health`
- `GET /api/template`
- `POST /api/template`
- `GET /api/layout`
- `POST /api/layout`
- `GET /api/default-layout`
- `POST /api/default-layout`
- `POST /api/publish-wordpress`
- `GET /api/display-data`
- `POST /api/display-data`

## Quick test (PowerShell)

```powershell
$token = "your-token"
$payload = @{
  date = "21/05/2026"
  time = "11:59"
  barSellOneBaht = "55,200,000"
  barBuyOneBaht = "54,670,000"
  printSellOneBaht = "55,300,000"
  printBuyOneBaht = "53,890,000"
  printSellOneSalueng = "13,825,000"
  printBuyOneSalueng = "13,473,000"
  printSellFiveHoun = "6,912,000"
  printBuyFiveHoun = "6,737,000"
} | ConvertTo-Json -Compress

curl.exe -i -X POST "http://127.0.0.1:3210/api/publish-wordpress" `
  -H "Content-Type: application/json" `
  -H "X-Write-Token: $token" `
  --data-raw $payload
```

## Quick test (Linux/macOS)

```bash
WRITE_API_TOKEN="your-token"
curl -i -X POST "http://127.0.0.1:3210/api/publish-wordpress" \
  -H "Content-Type: application/json" \
  -H "X-Write-Token: ${WRITE_API_TOKEN}" \
  --data-raw '{
    "date":"21/05/2026",
    "time":"11:59",
    "barSellOneBaht":"55,200,000",
    "barBuyOneBaht":"54,670,000",
    "printSellOneBaht":"55,300,000",
    "printBuyOneBaht":"53,890,000",
    "printSellOneSalueng":"13,825,000",
    "printBuyOneSalueng":"13,473,000",
    "printSellFiveHoun":"6,912,000",
    "printBuyFiveHoun":"6,737,000"
  }'
```

## Troubleshooting

1. `401 unauthorized` on write API:
- Check `WRITE_API_TOKEN`
- Confirm Caddy sends correct `X-Write-Token`

2. `signature_mismatch` on WordPress:
- `WP_WEBHOOK_SECRET` does not match WP setting

3. 5 Houn shows `-`:
- Ensure latest app/plugin deployed
- Republish once with latest payload keys

4. Language toggle button not visible:
- Old plugin file still active or cached
- Replace plugin with latest file and clear cache

## Security behavior

1. Write APIs require token (`Authorization: Bearer ...` or `X-Write-Token`)
2. Static allowlist only (`/`, `/app.js`, `/styles.css`, `/assets/fonts/*`)
3. Request size limits:
- template upload: 10MB
- layout/default-layout: 256KB
- publish payload: 64KB
4. No stack traces returned to clients on 500 errors
5. Built-in API rate limiting (per IP, per route class) for basic DoS protection
