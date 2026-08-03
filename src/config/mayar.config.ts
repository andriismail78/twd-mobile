// src/config/mayar.config.ts
// Konfigurasi Mayar.id Payment Gateway untuk TWD Mobile
// Dokumentasi resmi API: https://docs.mayar.id/

export type MayarMode = "sandbox" | "production";
export const MAYAR_MODE: MayarMode = "production";

export const MAYAR_BASE_URL =
  MAYAR_MODE === "production"
    ? "https://api.mayar.id/hl/v1"
    : "https://pub.api.mayar.id/hl/v1";

// ✅ API Key Mayar.id Anda (dari Dashboard mayar.id -> Pengaturan -> API Key)
// Klik generate di dasbor mayar.id dan masukkan ke bawah:
export const MAYAR_API_KEY = "mayar_live_xxxx";

// ✅ Akun Mayar.id / Link Pembayaran statis default toko
export const MAYAR_DEFAULT_PAYMENT_LINK = "https://mayar.id/pay/twdmobile";