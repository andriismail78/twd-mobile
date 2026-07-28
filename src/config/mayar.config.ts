// src/config/mayar.config.ts
// Konfigurasi payment gateway Mayar.id (menggantikan Doku)
//
// Ambil API Key dari: https://web.mayar.id → Integration → API Key
// (pilih "Read & Write" agar bisa membuat invoice & QRIS)
//
// CATATAN: ganti MAYAR_API_KEY di bawah dengan key asli Anda.
// Jangan commit key asli ke repository publik.

const IS_PRODUCTION = false; // ubah ke true untuk mode live (production)

export const MAYAR_BASE_URL = IS_PRODUCTION
  ? "https://api.mayar.id/hl/v1"   // Production
  : "https://api.mayar.club/hl/v1"; // Sandbox (testing)

export const MAYAR_API_KEY = "YOUR_MAYAR_API_KEY"; // ← ganti dengan API Key Mayar.id Anda

export const MAYAR_REDIRECT_URL = "https://twd-app.com/thanks";

// Token untuk verifikasi webhook Mayar (ambil dari dashboard Mayar → Integration).
// Dipakai baik oleh server webhook maupun sebagai secret verifikasi HMAC.
// Ganti dengan token asli Anda.
export const MAYAR_WEBHOOK_TOKEN = "YOUR_MAYAR_WEBHOOK_TOKEN";
