# คู่มือติดตั้งแบบละเอียด (DigitalOcean + Caddy + PM2 + WordPress)

เอกสารนี้สำหรับติดตั้งและเชื่อมระบบให้ใช้งานจริงแบบครบ flow:

- รันแอปด้วย PM2
- เปิดผ่าน Caddy
- เชื่อม webhook ไป WordPress
- ติดตั้ง/อัปเดตปลั๊กอิน WordPress

## 1) เตรียมเครื่อง

SSH เข้าเซิร์ฟเวอร์:

```bash
ssh root@YOUR_SERVER_IP
```

ตรวจเครื่องมือ:

```bash
node -v
npm -v
pm2 -v
caddy version
```

ถ้าไม่มี PM2:

```bash
npm install -g pm2
```

## 2) เตรียมโค้ดโปรเจกต์

กรณีมีโฟลเดอร์แล้ว:

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
git pull origin main
npm install
```

กรณียังไม่มีโฟลเดอร์:

```bash
cd /home/automation-hub-sgp01
git clone https://github.com/p-v1shnu/bizgital-update-daily-gold-price.git UpdateDailyGoldPrice
cd UpdateDailyGoldPrice
npm install
```

## 3) ตั้งค่า `.env`

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
cp .env.example .env
openssl rand -hex 32
nano .env
```

ตัวอย่างค่า:

```env
NODE_ENV=production
PORT=3210
WRITE_API_TOKEN=PASTE_RANDOM_TOKEN
SHOW_LOCAL_TOKEN_INPUT=false
RATE_LIMIT_API_EVENTS=240
RATE_LIMIT_DISPLAY_EVENTS=180
RATE_LIMIT_WRITE_EVENTS=30
WP_WEBHOOK_URL=https://YOUR-WP-DOMAIN/wp-json/bizgital/v1/gold-price
WP_WEBHOOK_SECRET=PASTE_RANDOM_SECRET
WP_WEBHOOK_TIMEOUT_MS=8000
```

ตั้งสิทธิ์ไฟล์:

```bash
chmod 600 .env
```

## 4) รันด้วย PM2 และทำให้รันต่อเนื่อง

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
pm2 restart gold-price-editor --update-env || pm2 start server.js --name gold-price-editor
pm2 save
pm2 ls
```

ตั้ง autostart (ครั้งแรก):

```bash
pm2 startup
```

รันคำสั่งที่ PM2 แสดงกลับมา แล้วสั่ง:

```bash
pm2 save
```

## 5) ตั้ง Caddy Reverse Proxy

### 5.1 สร้างรหัส basic auth

```bash
caddy hash-password --plaintext 'YOUR_PASSWORD'
```

### 5.2 แก้ Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

ตัวอย่าง:

```caddy
gold.example.com {
    @admin path / /app.js /styles.css /api/layout /api/default-layout /api/template /api/publish-wordpress /api/display-data /api/public-config
    basic_auth @admin {
        team01 $2a$14$PUT_HASH_HERE
    }

    @writePaths path /api/layout /api/default-layout /api/template /api/publish-wordpress /api/display-data
    reverse_proxy @writePaths 127.0.0.1:3210 {
        header_up X-Write-Token "PASTE_SAME_AS_WRITE_API_TOKEN"
    }

    reverse_proxy 127.0.0.1:3210
}
```

หมายเหตุสำคัญ:

- อย่าใช้ token/secret แบบตัวอย่าง ให้สุ่มใหม่เสมอ
- เส้นทาง `/display` จะเป็น public สำหรับหน้าจอแสดงผล
- เส้นทาง admin/editor และ write API จะอยู่หลัง `basic_auth`

### 5.3 validate + reload

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

## 6) ตั้ง Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw deny 3210/tcp
sudo ufw status
```

## 7) ติดตั้งปลั๊กอิน WordPress

ปลั๊กอินหลักในโปรเจกต์:

- `wordpress-plugin/bizgital-gold-price-webhook/bizgital-gold-price-webhook.php`

ติดตั้งได้ 2 แบบ:

1. อัปโหลดโฟลเดอร์ไป `wp-content/plugins/bizgital-gold-price-webhook` แล้ว Activate
2. zip แล้วอัปโหลดผ่าน `Plugins > Add New > Upload Plugin`

## 8) เชื่อม Webhook กับ WordPress

ใน WordPress:

- ไป `Settings > Bizgital Gold Price`
- ตั้ง `Webhook Secret` ให้ตรงกับ `WP_WEBHOOK_SECRET` ใน `.env`

ยืนยัน endpoint:

- `https://YOUR-WP-DOMAIN/wp-json/bizgital/v1/gold-price`

## 9) วาง Shortcode ในหน้าเว็บ

```text
[bizgital_gold_price]
```

หมายเหตุ:

- การ์ดมีปุ่มสลับภาษาในตัว (`ລາວ` / `EN`)
- ค่าเริ่มต้นเป็นภาษาลาว

## 10) ลิงก์ public สำหรับแสดงราคาปัจจุบัน

- ลิงก์ใช้งาน: `https://YOUR-DOMAIN/display`
- เปิดลิงก์นี้ค้างไว้ใน browser ของหน้าจอแนวตั้งได้เลย
- เวลาแก้ราคาในหน้า editor ให้กดปุ่ม `ອັບເດດ Public Display`
- หน้า `/display` จะดึงข้อมูลล่าสุดและรีเฟรชอัตโนมัติบนลิงก์เดิม

## 11) ทดสอบ end-to-end

ทดสอบ publish จากแอป:

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
WRITE_API_TOKEN="$(grep '^WRITE_API_TOKEN=' .env | cut -d= -f2-)"
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

ถ้า `200 OK` แล้วให้รีเฟรชหน้า WordPress ที่มี shortcode

## 12) วิธีอัปเดตปลั๊กอินครั้งต่อไป

ไม่ต้องลบปลั๊กอินเดิม:

1. อัปโหลดไฟล์/โฟลเดอร์ใหม่ทับของเดิม
2. คงสถานะ Activated ไว้
3. เคลียร์แคชหน้าเว็บ/ปลั๊กอิน/Cloudflare
4. กด `Ctrl+F5`

ถ้าไม่เห็นปุ่มภาษาใหม่:

- ยังใช้ไฟล์ปลั๊กอินเก่า หรือ
- ติดแคช

## 13) คำสั่งอัปเดตระบบในอนาคต

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
git pull origin main
npm install
pm2 restart gold-price-editor --update-env
pm2 save
```

## 14) Troubleshooting เร็ว

1. `401 unauthorized`:
- token ไม่ตรง (`WRITE_API_TOKEN` vs header ที่ Caddy ส่ง)

2. `signature_mismatch`:
- `WP_WEBHOOK_SECRET` ฝั่ง Node ไม่ตรงกับ WordPress setting

3. `invalid value: printSellFiveTamlueng`:
- process ยังรันโค้ดเก่า ให้ `pm2 restart ... --update-env`

4. ช่อง 5 หุนเป็น `-`:
- ยังไม่ได้ publish ค่าคีย์ใหม่ หรือปลั๊กอินเก่า

5. เวลาไม่ตรงไทย:
- ตั้ง WordPress timezone เป็น `Asia/Bangkok`
