# คู่มือติดตั้ง/อัปเดตแบบละเอียด (DigitalOcean + PM2 + Caddy + .env)

เอกสารนี้เป็นคู่มือแยกต่างหากจาก `README.md` และ **ไม่ทับไฟล์เดิม**

แนวทางของคู่มือนี้: ใช้โปรเจกต์นี้เป็นเวอร์ชันหลักต่อเนื่อง โดย **ไม่ทำขั้นตอนลบระบบเดิม**

## 1) สิ่งที่ต้องเตรียมก่อนเริ่ม

- เซิร์ฟเวอร์ Ubuntu บน DigitalOcean
- โดเมนที่ชี้มายังเครื่องแล้ว (ตัวอย่าง `gold.example.com`)
- สิทธิ์ `root` หรือ user ที่มี `sudo`
- Repository: `https://github.com/JFallenArch/UpdateDailyGoldPrice.git`

---

## 2) SSH เข้าเครื่องและเช็คของที่ต้องใช้

```bash
ssh root@YOUR_SERVER_IP
```

เช็ค Node.js / npm:

```bash
node -v
npm -v
which node
```

เช็ค PM2 / Caddy:

```bash
pm2 -v
caddy version
```

ถ้ายังไม่มี PM2:

```bash
npm install -g pm2
```

ถ้ายังไม่มี Caddy:

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

---

## 3) เตรียมโปรเจกต์เวอร์ชันหลัก (ไม่ลบของเดิม)

### 3.1 ถ้ามีโฟลเดอร์โปรเจกต์อยู่แล้ว (กรณีคุณ)

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
git pull origin main
npm install
```

### 3.2 ถ้ายังไม่มีโฟลเดอร์โปรเจกต์

```bash
cd /home/automation-hub-sgp01
git clone https://github.com/JFallenArch/UpdateDailyGoldPrice.git
cd UpdateDailyGoldPrice
npm install
```

---

## 4) ตั้งค่า `.env` (โครงสร้างหลักของระบบใหม่)

เข้าโฟลเดอร์โปรเจกต์:

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
```

สร้าง `.env` ครั้งแรก:

```bash
cp .env.example .env
```

สร้าง token แบบสุ่ม:

```bash
openssl rand -hex 32
```

เปิดไฟล์ `.env`:

```bash
nano .env
```

ใส่ค่า:

```env
NODE_ENV=production
PORT=3210
WRITE_API_TOKEN=PASTE_RANDOM_TOKEN_HERE
```

ตั้ง permission:

```bash
chmod 600 .env
```

---

## 5) รันแอปด้วย PM2 และตั้งให้รันตลอด

ใช้คำสั่งนี้ (ถ้ามี process อยู่แล้วจะ restart, ถ้ายังไม่มีจะ start ใหม่):

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
pm2 restart gold-price-editor --update-env || pm2 start server.js --name gold-price-editor
pm2 save
pm2 ls
```

ตั้ง autostart หลัง reboot (ครั้งแรกเท่านั้น):

```bash
pm2 startup
```

รันคำสั่งที่ PM2 แสดงกลับมา แล้วสั่ง:

```bash
pm2 save
```

---

## 6) ตั้ง Caddy (basic_auth + reverse proxy + token upstream)

### 6.1 สร้าง hash password

```bash
caddy hash-password --plaintext 'YOUR_REAL_PASSWORD'
```

### 6.2 แก้ Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

ใส่ตัวอย่างนี้:

```caddy
gold.example.com {
    basic_auth {
        team01 $2a$14$PUT_HASH_FROM_CADDY_HERE
    }

    @writePaths path /api/layout /api/default-layout /api/template
    reverse_proxy @writePaths 127.0.0.1:3210 {
        header_up X-Write-Token "PASTE_SAME_TOKEN_AS_DOTENV"
    }

    reverse_proxy 127.0.0.1:3210
}
```

หมายเหตุ:
- `team01` คือ username
- `$2a$14$...` คือ hash password
- `X-Write-Token` ต้องตรงกับ `WRITE_API_TOKEN` ใน `.env` เป๊ะ

### 6.3 format + validate + reload

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

---

## 7) Firewall (ให้เข้าแอปผ่าน Caddy เท่านั้น)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw deny 3210/tcp
sudo ufw status
```

ถ้ายังไม่เคยเปิด UFW:

```bash
sudo ufw enable
```

---

## 8) ตรวจสอบหลังติดตั้ง

เช็ค PM2:

```bash
pm2 ls
pm2 logs gold-price-editor --lines 50
```

เช็ค `.env`:

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
grep -E '^(NODE_ENV|PORT|WRITE_API_TOKEN)=' .env
```

ทดสอบหน้าเว็บ:
- เปิด `https://gold.example.com`
- ต้องมี popup ให้ใส่ username/password
- เข้าระบบแล้วลอง:
  - บันทึก Layout
  - บันทึก Default Layout
  - อัปโหลด Template

ทดสอบความปลอดภัยเบื้องต้น:

```bash
curl -i https://gold.example.com/.git/config
```

คาดหวังผล: `404`

---

## 9) วิธีอัปเดตครั้งถัดไป (เส้นทางหลักที่ใช้ทุกครั้ง)

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
git pull origin main
npm install
pm2 restart gold-price-editor --update-env
pm2 save
```

ถ้าแก้ `.env` ต้องมี `--update-env` ทุกครั้ง

---

## 10) Rollback แบบไม่ลบโฟลเดอร์

ดู commit ล่าสุด:

```bash
cd /home/automation-hub-sgp01/UpdateDailyGoldPrice
git log --oneline -n 10
```

ย้อนกลับไป commit ก่อนหน้า:

```bash
git checkout <COMMIT_SHA>
npm install
pm2 restart gold-price-editor --update-env
pm2 save
```

เมื่อต้องการกลับมา branch หลัก:

```bash
git checkout main
git pull origin main
pm2 restart gold-price-editor --update-env
pm2 save
```

---

## 11) หมายเหตุความปลอดภัย

- ห้าม commit `.env` ขึ้น Git
- ถ้ารั่วหรือสงสัยรั่ว ให้เปลี่ยน `WRITE_API_TOKEN` ทันที
- เปลี่ยน password ใน `basic_auth` ได้โดยสร้าง hash ใหม่และ reload Caddy
- ทีมใช้งานผ่านมือถือหลายเครือข่าย ควรใช้ `basic_auth` (ดีกว่าบังคับ IP คงที่)
