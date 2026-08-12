// src/config/api.config.ts
// Konfigurasi koneksi TWD Mobile (Frontend) ke TWD Backend Cloud di VPS Biznet Gio

export type ApiEnvironment = "local" | "production";

// ✅ Menggunakan lingkungan cloud produksi VPS Biznet Gio agar 100% online & tersinkron aktual
export const API_ENV: ApiEnvironment = "production";

export const API_BASE_URL =
  (API_ENV as ApiEnvironment) === "production"
    ? "http://103.127.97.28:5000/api"      // <-- Server Cloud VPS Biznet Gio Anda (Aktif 24/7)
    : "http://localhost:5000/api";         // URL TWD Backend lokal

// Mode Operasi: "cloud-only" (Langsung terhubung 100% online ke server cloud PostgreSQL di Biznet Gio)
export const SYNC_MODE: "offline-first" | "cloud-only" = "cloud-only";
