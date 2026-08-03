// src/config/api.config.ts
// Konfigurasi koneksi TWD Mobile (Frontend) ke TWD Backend (REST API - Node.js + Express)

export type ApiEnvironment = "local" | "production";

// ✅ Pilih lingkungan backend yang aktif ("local" untuk tes di laptop, "production" untuk cloud VPS)
export const API_ENV: ApiEnvironment = "local";

// ✅ PENTING UNTUK TES DI HP FISIK (EXPO GO):
// Ganti 192.168.1.15 di bawah dengan alamat IPv4 laptop Lenovo Anda (cek dengan ketik 'ipconfig' di CMD)
// - Jika tes di web browser laptop yang sama: bisa pakai "localhost"
// - Jika tes di HP fisik via Wi-Fi: gunakan IPv4 laptop (contoh: "192.168.1.15")
export const LOCAL_IP = "192.168.1.38"; // <-- Ganti angka ini dengan IPv4 laptop Anda

export const API_BASE_URL =
  (API_ENV as ApiEnvironment) === "production"
    ? "http://103.127.97.28:5000/api"       // URL Server Cloud Produksi VPS Anda
    : `http://${LOCAL_IP}:5000/api`;       // URL TWD Backend lokal

// Mode Operasi: "offline-first" (AsyncStorage lokal + sinkron ke server) atau "cloud-only"
export const SYNC_MODE: "offline-first" | "cloud-only" = "offline-first";