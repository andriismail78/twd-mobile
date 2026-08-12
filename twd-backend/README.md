# TWD Backend — API REST Resmi untuk TWD Mobile 🏪🚀

**TWD Backend** adalah peladen API REST yang dibangun menggunakan **Node.js, Express.js, dan Sequelize ORM** dengan dukungan database berskala cloud (**PostgreSQL / MySQL**).

Backend ini merupakan pusat sinkronisasi data *real-time* untuk seluruh ekosistem **TWD Mobile**, yang mencakup 7 peran pengguna: **Owner, Kasir, Kurir, Marketing, Sub-Marketing, Super Admin, dan Customer**.

---

## ✨ Fitur Unggulan TWD Backend
- ✅ **Multi-Database ORM (Sequelize):** Mendukung **PostgreSQL 16** (default produksi) maupun **MySQL** secara *plug-and-play*.
- ✅ **Keamanan Token JWT (`/api/auth`):** Autentikasi aman berdasar nomor HP, Email, dan PIN/Password, lengkap dengan manajemen hak akses berbasis *role* (`requireRole`).
- ✅ **Webhook Mayar.id (`/api/webhooks/mayar`):** Menerima notifikasi otomatis dari Payment Gateway **mayar.id** (QRIS, Virtual Account, e-Wallet, Alfamart) untuk mengubah status pesanan menjadi *"Siap Diambil (`diproses`)"* secara *real-time*.
- ✅ **Manajemen Akuntansi Stok (`/api/products`):** Mendukung histori stok *batch* (Average, FIFO, LIFO) serta katalog produk global antar-toko.
- ✅ **Manajemen Logistik (`/api/orders`):** Menyimpan koordinat pengiriman, alasan kendala lapangan, serta URI/base64 foto bukti pengiriman (`fotoBuktiKirim`) beserta nama penerima (`namaPenerima`).
- ✅ **Persetujuan Pencairan Saldo (`/api/withdrawals`):** Pengajuan dan verifikasi penarikan dana ke rekening Bank maupun e-Wallet (DANA, GoPay, OVO, ShopeePay).
- ✅ **Siap Docker Compose (`docker-compose.yml`):** Memudahkan penggelaran (*deployment*) ke server VPS cloud dalam 1 perintah.

---

## 🚀 Cara Menjalankan TWD Backend

### Pilihan 1: Menggunakan Docker Compose (Paling Mudah — Tanpa Install DB Manual)
1. Pastikan **Docker** dan **Docker Compose** terpasang di komputer/server Anda.
2. Di terminal folder `twd-backend`, jalankan perintah:
   ```bash
   docker-compose up -d
   ```
3. Docker akan otomatis membuat container **PostgreSQL 16** dan menjalankan **TWD Backend API** di `http://localhost:5000`.

---

### Pilihan 2: Menjalankan Secara Lokal (Node.js & PostgreSQL/MySQL Manual)
1. **Install dependensi:**
   ```bash
   npm install
   ```
2. **Salin file konfigurasi `.env`:**
   ```bash
   cp .env.example .env
   ```
   *(Sesuaikan `DB_HOST`, `DB_USER`, `DB_PASS`, dan `DB_NAME` di dalam `.env` dengan kredensial database Anda).*
3. **Inisialisasi tabel & buat akun Super Admin default:**
   ```bash
   npm run init-db
   ```
   *Output: Akun Super Admin akan dibuat dengan PIN default `123456` dan password `admin123456`.*
4. **Jalankan server dalam mode pengembangan:**
   ```bash
   npm run dev
   ```
   Server API siap merespons di `http://localhost:5000`.

---

## 📖 Dokumentasi Endpoint API Resmi

### 1. Autentikasi (`/api/auth`)
* `POST /api/auth/register` — Mendaftarkan akun (Owner, Kasir, Mitra, Kurir, Customer)
* `POST /api/auth/login` — Login pengguna & menerima Token JWT
* `GET /api/auth/profile` — Mengambil profil pengguna aktif (Membutuhkan header `Authorization: Bearer <token>`)

### 2. Toko / Owner (`/api/stores`)
* `GET /api/stores` — Daftar seluruh toko di jaringan ekosistem
* `GET /api/stores/:kode` — Cari informasi toko berdasar Kode Unik Toko (`TWD-XXXXXX`)
* `PUT /api/stores/:id/subscription` — Perbarui paket langganan / masa aktif (Khusus Super Admin)

### 3. Produk & Katalog (`/api/products`)
* `GET /api/products?ownerId=<uuid>` — Daftar produk toko spesifik (atau gunakan `?global=true` untuk katalog global)
* `POST /api/products` — Tambah produk baru (Owner / Super Admin)
* `PUT /api/products/:id` — Perbarui harga modal, jual, atau stok produk
* `DELETE /api/products/:id` — Hapus produk

### 4. Pesanan / Penjualan (`/api/orders`)
* `GET /api/orders?ownerId=<uuid>&status=<status>` — Daftar pesanan masuk toko
* `POST /api/orders` — Buat pesanan baru (dari Customer online maupun Kasir POS)
* `PUT /api/orders/:id/status` — Perbarui status pesanan (`diproses`, `dikirim`, `selesai`, `tertunda`) beserta bukti foto penerimaan

### 5. Pencairan Saldo (`/api/withdrawals`)
* `GET /api/withdrawals?userId=<id>` — Daftar riwayat pengajuan pencairan
* `POST /api/withdrawals` — Ajukan pencairan dana ke rekening / e-Wallet
* `PUT /api/withdrawals/:id/approve` — Setujui / tolak pencairan (Khusus Super Admin)

### 6. Webhook Mayar.id (`/api/webhooks`)
* `POST /api/webhooks/mayar` — Endpoint resmi untuk menerima panggilan balik (*webhook*) dari Mayar.id saat transaksi pembayaran dinyatakan *SUCCESS / PAID*.
