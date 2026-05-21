# Bizgital Update Daily Gold Price (v3 logic)

ໂປຣເຈກນີ້ເປັນ web app ສຳລັບແກ້ໄຂປ້າຍລາຄາຄຳ (template + layout) ແລະ export ເປັນ PNG.

## Current architecture

- Backend: Node.js (`server.js`) ບໍ່ໃຊ້ database
- Data storage: ເກັບເປັນໄຟລ໌ local
  - `assets/template.*`
  - `data/layout.json`
  - `data/default-layout.json`
- Frontend: static files (`index.html`, `app.js`, `styles.css`)
- Production runtime: PM2 + Caddy reverse proxy

## Requirements

- Node.js 20+
- npm
- PM2 (production)
- Caddy (production)

## Environment (.env)

ສ້າງ `.env` ຈາກ `.env.example`:

```bash
cp .env.example .env
```

ຕົວຢ່າງ:

```env
NODE_ENV=production
PORT=3210
WRITE_API_TOKEN=replace-with-a-long-random-token
```

Notes:
- `NODE_ENV=production` ຕ້ອງມີ `WRITE_API_TOKEN` ສະເໝີ
- app ຈະ fail startup ທັນທີ ຖ້າ production ແລ້ວ token ບໍ່ຖືກຕັ້ງ

## Run locally

```bash
npm install
npm start
```

Open: `http://127.0.0.1:3210`

## PM2 (production)

```bash
pm2 restart gold-price-editor --update-env || pm2 start server.js --name gold-price-editor
pm2 save
pm2 ls
```

## Caddy (production)

```caddy
gold.example.com {
    basic_auth {
        team01 $2a$14$PUT_HASH_HERE
    }

    @writePaths path /api/layout /api/default-layout /api/template
    reverse_proxy @writePaths 127.0.0.1:3210 {
        header_up X-Write-Token "SAME_VALUE_AS_WRITE_API_TOKEN"
    }

    reverse_proxy 127.0.0.1:3210
}
```

Important:
- `X-Write-Token` ໃນ Caddy ຕ້ອງຄືກັນກັບ `WRITE_API_TOKEN` ໃນ `.env`
- ຄວນປິດ public access ທີ່ port app (3210) ແລະໃຫ້ເຂົ້າຜ່ານ Caddy ເທົ່ານັ້ນ

## Security behavior (current)

1. Static allowlist:
- ເປີດໄດ້ສະເພາະ `/`, `/app.js`, `/styles.css`, `/assets/fonts/*`
- ບລັອກ `.git`, `/data/*` ແລະ dot-paths

2. Write API auth:
- `POST /api/layout`
- `POST /api/default-layout`
- `POST /api/template`
- ຕ້ອງສົ່ງ token ຜ່ານ `Authorization: Bearer ...` ຫຼື `X-Write-Token`

3. Payload limits:
- `/api/template`: 10MB
- `/api/layout`, `/api/default-layout`: 256KB

4. Error handling:
- invalid json/data -> `400`
- unauthorized -> `401`
- payload too large -> `413`
- unexpected server error -> `500` (ບໍ່ໂຊ stack trace ອອກ client)

## Upload template constraints

- Supported formats: `PNG`, `JPG/JPEG`, `WEBP`
- ຖ້າໄຟລ໌ໃຫຍ່ເກີນ ຫຼື format ບໍ່ຮອງຮັບ ຈະບໍ່ອັບເດດ
- HEIC ຈາກມືຖືບາງຮຸ່ນມັກບໍ່ຜ່ານ (ແນະນຳ convert ເປັນ JPG/PNG)

## Main API endpoints

- `GET /api/template`
- `POST /api/template`
- `GET /api/layout`
- `POST /api/layout`
- `GET /api/default-layout`
- `POST /api/default-layout`

## Repository

Target new repository:
- `https://github.com/p-v1shnu/bizgital-update-daily-gold-price.git`
