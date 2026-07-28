// src/utils/MayarService.ts
// Integrasi payment gateway Mayar.id (menggantikan Doku)
//
// Dokumentasi: https://docs.mayar.id
// Auth: header "Authorization: Bearer <API_KEY>"
// Base URL: https://api.mayar.id/hl/v1  (production)
//           https://api.mayar.club/hl/v1 (sandbox)

import axios from "axios";
import {
  MAYAR_API_KEY,
  MAYAR_BASE_URL,
  MAYAR_REDIRECT_URL,
} from "../config/mayar.config";

// ─── Types ────────────────────────────────────────────────────────────────

export type CreateMayarInvoiceParams = {
  orderId:       string;
  amount:        number;
  customerName:  string;
  customerEmail: string;
  customerPhone?: string;
  description?:  string;
  expiredAt?:    string; // ISO 8601, contoh: "2026-04-19T16:43:23.000Z"
  items?:        { quantity: number; rate: number; description: string }[];
};

export type MayarInvoiceResponse = {
  statusCode?:  number;
  messages?:    string;
  data?: {
    id:           string; // uuid invoice
    transactionId: string;
    link:         string; // URL halaman pembayaran pelanggan (contoh: https://xxx.mayar.shop/invoices/slug)
    expiredAt?:   number; // epoch ms
    extraData?:   any;
  };
  [key: string]: any;
};

export type MayarQrResponse = {
  statusCode?: number;
  messages?:   string;
  data?:       { url: string; amount: number }[];
  [key: string]: any;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    Authorization: `Bearer ${MAYAR_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function handleMayarError(error: any, label: string): never {
  const status  = error?.response?.status;
  const errData = error?.response?.data;
  console.error(`[MAYAR] ${label} ❌`, { status, data: JSON.stringify(errData), msg: error?.message });
  throw new Error(
    errData?.messages ??
    errData?.message  ??
    errData?.error    ??
    `Mayar error HTTP ${status ?? "?"}: ${error?.message}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNGSI 1: Buat Invoice (Payment Link)
//    Setara dengan "Virtual Account" di Doku, tapi mengembalikan LINK pembayaran
//    yang bisa dibayar via VA / e-wallet / QRIS di halaman Mayar.id.
// ─────────────────────────────────────────────────────────────────────────────

export async function createInvoice(
  params: CreateMayarInvoiceParams,
): Promise<MayarInvoiceResponse> {
  const body = {
    name:        params.customerName,
    email:       params.customerEmail,
    mobile:      params.customerPhone ?? "",
    redirectUrl: MAYAR_REDIRECT_URL,
    description: params.description ?? params.orderId,
    expiredAt:   params.expiredAt,
    items:       params.items && params.items.length > 0 ? params.items : undefined,
  };

  try {
    const response = await axios.post<MayarInvoiceResponse>(
      `${MAYAR_BASE_URL}/invoice/create`,
      body,
      { headers: authHeaders(), timeout: 20_000 },
    );
    console.log("[MAYAR] createInvoice ✅", JSON.stringify(response.data));
    return response.data;
  } catch (e) {
    handleMayarError(e, "createInvoice");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNGSI 2: Buat Dynamic QRCode (QRIS)
//    Mengembalikan URL gambar QR yang bisa di-render / ditampilkan ke pelanggan.
// ─────────────────────────────────────────────────────────────────────────────

export async function createQrCode(amount: number): Promise<MayarQrResponse> {
  try {
    const response = await axios.post<MayarQrResponse>(
      `${MAYAR_BASE_URL}/qrcode/create`,
      { amount },
      { headers: authHeaders(), timeout: 20_000 },
    );
    console.log("[MAYAR] createQrCode ✅", JSON.stringify(response.data));
    return response.data;
  } catch (e) {
    handleMayarError(e, "createQrCode");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNGSI 3: Cek Status Invoice (polling)
//    Digunakan untuk mendeteksi pembayaran otomatis tanpa menunggu kasir.
//    GET /invoice/{id} → data.status: "paid" | "unpaid" | "closed" | ...
// ─────────────────────────────────────────────────────────────────────────────

export type MayarInvoiceStatusResponse = {
  statusCode?: number;
  messages?:   string;
  data?: {
    id:     string;
    status: string; // "paid" | "unpaid" | "closed" | "expired" | ...
    amount?: number;
    [key: string]: any;
  };
  [key: string]: any;
};

export async function checkInvoiceStatus(
  invoiceId: string,
): Promise<MayarInvoiceStatusResponse> {
  try {
    const response = await axios.get<MayarInvoiceStatusResponse>(
      `${MAYAR_BASE_URL}/invoice/${invoiceId}`,
      { headers: authHeaders(), timeout: 15_000 },
    );
    console.log("[MAYAR] checkInvoiceStatus ✅", JSON.stringify(response.data));
    return response.data;
  } catch (e) {
    handleMayarError(e, "checkInvoiceStatus");
  }
}
