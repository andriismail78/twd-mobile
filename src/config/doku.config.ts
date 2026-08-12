// src/config/doku.config.ts

export type DokuMode = "sandbox" | "production";
export const MODE: DokuMode = "sandbox"; // ✅ production

export const DOKU_BASE_URL =
  (MODE as DokuMode) === "production"
    ? "https://api.doku.com"
    : "https://api-sandbox.doku.com";

// ✅ Client ID lengkap (dari halaman API Keys)
export const DOKU_CLIENT_ID  = "BRN-0210-1779027154073";

// ✅ Secret Key — klik "Reveal Key" dulu untuk lihat full, lalu copy
export const DOKU_SECRET_KEY = "SK-ec7RuracseNr7WW6yTIn"; // ganti xxxx dengan key lengkap

// ✅ API Key (simpan untuk referensi, mungkin dibutuhkan nanti)
export const DOKU_API_KEY    = "doku_key_abb361e90dbf4aa5b969bc4681f0eb43";