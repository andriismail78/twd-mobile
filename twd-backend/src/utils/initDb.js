// twd-backend/src/utils/initDb.js
// Skrip untuk inisialisasi tabel database & membuat akun Super Admin pertama

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User, Store } = require("../models");

async function initDatabase() {
  let retries = 10;
  while (retries > 0) {
    try {
      console.log("[DB] Menghubungkan ke database...");
      await sequelize.authenticate();
      console.log("[DB] Koneksi sukses. Sinkronisasi tabel...");

      // alter: true -> sinkronisasi skema tanpa menghapus data yang ada
      await sequelize.sync({ alter: true });
      console.log("[DB] Seluruh tabel berhasil dibuat/disinkronkan.");

      // Cek apakah Super Admin sudah ada
      const sa = await User.findOne({ where: { role: "super_admin" } });
      if (!sa) {
        const hashedPassword = await bcrypt.hash("admin123456", 10);
        await User.create({
          name:     "Super Admin TWD",
          phone:    "081200000000",
          email:    "superadmin@twdmobile.id",
          password: hashedPassword,
          role:     "super_admin",
          pin:      "123456",
        });
        console.log("[DB] ✅ Akun Super Admin default berhasil dibuat (PIN: 123456 / Pass: admin123456).");
      } else {
        console.log("[DB] Akun Super Admin sudah ada.");
      }

      // ✅ Cek dan isi Katalog Produk Global Master Indonesia untuk Toko/Owner
      const { Product } = require("../models");
      const globalCount = await Product.count({ where: { ownerId: null } });
      if (globalCount === 0) {
        console.log("[DB] Mengisi katalog produk global master Indonesia...");
        const defaultProducts = [
          { name: "Beras Setra Ramos 5kg", kategori: "Sembako", buyPrice: 72000, sellPrice: 76000, stock: 25, barcode: "8992736182736", ownerId: null },
          { name: "Minyak Goreng Bimoli 2 Liter", kategori: "Sembako", buyPrice: 34000, sellPrice: 37500, stock: 40, barcode: "8999909182731", ownerId: null },
          { name: "Gula Pasir Gulaku 1kg", kategori: "Sembako", buyPrice: 16500, sellPrice: 18500, stock: 50, barcode: "8991192837192", ownerId: null },
          { name: "Telur Ayam Negeri (Per Kilogram)", kategori: "Sembako", buyPrice: 28000, sellPrice: 31000, stock: 60, barcode: "8990019283711", ownerId: null },
          { name: "Indomie Goreng Spesial 85g", kategori: "Makanan", buyPrice: 2900, sellPrice: 3500, stock: 200, barcode: "8998866200018", ownerId: null },
          { name: "Kopi Kapal Api Spesial Mix (10 Sachet)", kategori: "Minuman", buyPrice: 14500, sellPrice: 16500, stock: 50, barcode: "8993300192831", ownerId: null },
          { name: "Aqua Botol 600ml", kategori: "Minuman", buyPrice: 2800, sellPrice: 4000, stock: 120, barcode: "8993311928371", ownerId: null },
          { name: "Teh Pucuk Harum 350ml", kategori: "Minuman", buyPrice: 3200, sellPrice: 4500, stock: 90, barcode: "8993311928373", ownerId: null },
          { name: "Chitato Sapi Panggang 68g", kategori: "Snack", buyPrice: 9500, sellPrice: 11500, stock: 40, barcode: "8994400192831", ownerId: null },
          { name: "Sampoerna A Mild 16", kategori: "Rokok", buyPrice: 32500, sellPrice: 35000, stock: 60, barcode: "8995500192831", ownerId: null },
          { name: "Gudang Garam Surya 16", kategori: "Rokok", buyPrice: 33000, sellPrice: 35500, stock: 60, barcode: "8995500192832", ownerId: null },
          { name: "Sabun Mandi Lifebuoy Merah 85g", kategori: "Kebersihan", buyPrice: 3500, sellPrice: 4500, stock: 80, barcode: "8996600192831", ownerId: null },
          { name: "Shampoo Clear Menthol Sachet", kategori: "Kebersihan", buyPrice: 9500, sellPrice: 12000, stock: 50, barcode: "8996600192832", ownerId: null },
          { name: "Pampers MamyPoko Pants Standard L20", kategori: "Lainnya", buyPrice: 42000, sellPrice: 47000, stock: 25, barcode: "8997700192831", ownerId: null },
          { name: "Tolak Angin Sido Muncul Cair (5 Sachet)", kategori: "Lainnya", buyPrice: 19500, sellPrice: 23000, stock: 40, barcode: "8998800192831", ownerId: null },
          { name: "Pulsa Elektrik Telkomsel/XL/Indosat Rp 25.000", kategori: "Lainnya", buyPrice: 25500, sellPrice: 27500, stock: 999, barcode: "8999900192831", ownerId: null },
          { name: "Token Listrik PLN Rp 50.000", kategori: "Lainnya", buyPrice: 50500, sellPrice: 53000, stock: 999, barcode: "8999900192833", ownerId: null },
        ];
        for (const p of defaultProducts) {
          await Product.create(p);
        }
        console.log(`[DB] ✅ Berhasil mengisi ${defaultProducts.length} Katalog Produk Global Master Indonesia.`);
      } else {
        console.log(`[DB] Katalog Produk Global sudah terisi (${globalCount} produk).`);
      }

      process.exit(0);
    } catch (err) {
      console.error(`[DB] ⚠️ Belum terhubung (${err.message}). Mencoba ulang... (${retries - 1})`);
      retries -= 1;
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  console.error("[DB] ❌ Gagal inisialisasi database.");
  process.exit(1);
}

initDatabase();
