# Panduan Deploy TWD Mobile ke KVM (62.72.20.24 / srv1808009.hstgr.cloud)

Domain: **tokowarungdigital.com** → IP **62.72.20.24**

TWD Mobile adalah aplikasi mobile (Expo). Server KVM ini difungsikan sebagai
**backend + penerima webhook Mayar.id** (dan opsional: hosting web build).
Aplikasi mobile tidak "dijalankan" di KVM, melainkan di-build (EAS) lalu
didistribusikan ke HP. Backend di KVM memberi:
- database order bersama (sinkronisasi antar-device),
- endpoint webhook Mayar agar status bayar otomatis update,
- (masa depan) API yang dipanggil app menggantikan AsyncStorage lokal.

> Catatan: app saat ini masih **local-first** (AsyncStorage). Agar benar-benar
> multi-device, perlu refactor di app untuk memanggil `/api/orders` backend.
> Backend & webhook di atas sudah siap menyambutnya.

## 1. DNS
Di pengelola DNS domain, buat record:
```
A   tokowarungdigital.com      62.72.20.24
A   www.tokowarungdigital.com  62.72.20.24
```
Tunggu propagasi (~menit–jam).

## 2. Siapkan KVM
```bash
ssh root@62.72.20.24
# di server:
curl -fsSL https://get.docker.com | sh
apt update && apt install -y nginx certbot python3-certbot-nginx
```

## 3. Deploy backend (docker compose)
Dari mesin lokal, copy folder `server/` ke KVM:
```bash
scp -r server root@62.72.20.24:/opt/twd-backend
```
Di server:
```bash
cd /opt/twd-backend
# buat file .env berisi token webhook Mayar (JANGAN commit ke repo):
echo "MAYAR_WEBHOOK_TOKEN=ISI_TOKEN_ASLI_MAYAR" > .env
docker compose up -d --build
curl http://localhost:3000/health   # harus {"ok":true,...}
```

## 4. nginx + SSL
Copy `deploy/nginx-tokowarungdigital.conf` ke server, lalu aktifkan & dapatkan SSL:
```bash
cp nginx-tokowarungdigital.conf /etc/nginx/sites-available/tokowarungdigital.com
ln -s /etc/nginx/sites-available/tokowarungdigital.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d tokowarungdigital.com -d www.tokowarungdigital.com
```
Buka `https://tokowarungdigital.com/health` → harus `{"ok":true,...}`.

## 5. Daftarkan webhook di Mayar
Di dashboard Mayar → Integration → Webhook, isi URL:
```
https://tokowarungdigital.com/webhooks/mayar
```
dan pakai token yang sama dengan `MAYAR_WEBHOOK_TOKEN` (file `.env` di KVM).

## 6. (Opsional) Build versi web
Di mesin lokal:
```bash
npx expo export -p web
# hasil di dist/ → rsync ke KVM, tambahkan blok nginx untuk root web
```

## Catatan keamanan
- Jangan commit `MAYAR_WEBHOOK_TOKEN` asli ke repo publik; simpan di `.env` di KVM.
- Firewall: buka hanya port 22, 80, 443. Port 3000 tetap tertutup (hanya dilalui nginx).
