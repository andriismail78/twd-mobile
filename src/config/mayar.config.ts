// src/config/mayar.config.ts
// Konfigurasi Mayar.id Payment Gateway untuk TWD Mobile
// Dokumentasi resmi: https://docs.mayar.id/

export type MayarMode = "sandbox" | "production";
export const MAYAR_MODE: MayarMode = "production";

export const MAYAR_BASE_URL =
  MAYAR_MODE === "production"
    ? "https://api.mayar.id/hl/v1"
    : "https://pub.api.mayar.id/hl/v1";

// ✅ 1. MASUKKAN LINK PEMBAYARAN MAYAR.ID TOKO ANDA DI SINI:
// Buka dasbor mayar.id -> Buat "Link Pembayaran / Single Payment" -> Salin link-nya ke bawah ini:
// Contoh: "https://mayar.id/pay/toko-anda" atau "https://mayar.link/pay/..."
// (Atau owner toko juga bisa mengisinya langsung dari menu Pengaturan Pembayaran di dalam aplikasi!)
export const MAYAR_DEFAULT_PAYMENT_LINK = ""; // <-- Kosongkan untuk menggunakan mode Simulasi/Demo di app, atau isi dengan link asli Anda!

// ✅ 2. (OPSIONAL) API KEY MAYAR.ID ANDA (dari Dashboard mayar.id -> Pengaturan -> API Key):
export const MAYAR_API_KEY = ""; // "<masukkan api key anda di sini>"
