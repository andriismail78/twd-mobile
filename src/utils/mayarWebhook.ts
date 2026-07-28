// src/utils/mayarWebhook.ts
// Handler untuk status pembayaran Mayar.id.
//
// Dua cara pakai:
//  1) POLLING (lokal, tanpa server): CustomerOrderStatusScreen memanggil
//     MayarService.checkInvoiceStatus(id) lalu applyMayarStatusByInvoiceId(...)
//     untuk mengupdate status order di device yang sama.
//  2) WEBHOOK (butuh server): route/backend Anda menerima POST dari Mayar,
//     lalu memanggil handleMayarWebhook(rawBody, signature) untuk verifikasi
//     + update order. (App ini local-first, jadi webhook butuh backend terpisah
//     yang menulis ke sumber data order Anda.)
//
// Catatan: skema signature persis Mayar belum terdocumentasi eksplisit; verifier
// di bawah bersifat best-effort (HMAC-SHA256 atas raw body dengan webhook token,
// fallback ke pencocokan token). Sesuaikan jika Mayar merilis skema resmi.

import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { MAYAR_WEBHOOK_TOKEN } from "../config/mayar.config";
import { OrderStatus } from "../context/OrderContext";

const STORAGE_KEY_ORDERS = "@twd_orders";

// Payload umum yang dikirim Mayar via webhook.
export type MayarWebhookPayload = {
  id?:           string; // invoice id
  invoiceId?:    string;
  transactionId?: string;
  status?:       string; // "paid" | "unpaid" | "closed" | "expired" | ...
  amount?:       number;
  [key: string]: any;
};

// Map status Mayar → status order aplikasi.
export function mapMayarStatusToOrderStatus(mayarStatus?: string): OrderStatus {
  switch ((mayarStatus ?? "").toLowerCase()) {
    case "paid":
    case "settlement":
    case "success":
      return "dikonfirmasi"; // pembayaran diterima, kasir bisa proses
    case "expired":
    case "closed":
    case "cancelled":
    case "canceled":
      return "dibatalkan"; // kadaluarsa / dibatalkan
    case "unpaid":
    case "created":
    case "pending":
    default:
      return "menunggu";
  }
}

// Verifikasi webhook Mayar (best-effort).
export function verifyMayarWebhook(rawBody: string, signature?: string | null): boolean {
  // Token belum diisi → lewati verifikasi (hanya untuk development).
  if (!MAYAR_WEBHOOK_TOKEN || MAYAR_WEBHOOK_TOKEN === "YOUR_MAYAR_WEBHOOK_TOKEN") {
    return true;
  }
  if (signature) {
    try {
      const expected = CryptoJS.HmacSHA256(rawBody, MAYAR_WEBHOOK_TOKEN).toString(CryptoJS.enc.Hex);
      if (expected.length !== signature.length) return false;
      let ok = true;
      for (let i = 0; i < expected.length; i++) {
        if (expected[i] !== signature[i]) { ok = false; break; }
      }
      return ok;
    } catch {
      return false;
    }
  }
  // Fallback: cari token di dalam body.
  try {
    const parsed = JSON.parse(rawBody);
    return parsed?.token === MAYAR_WEBHOOK_TOKEN || parsed?.webhookToken === MAYAR_WEBHOOK_TOKEN;
  } catch {
    return false;
  }
}

// Terapkan status Mayar ke order lokal berdasarkan invoice id.
// Mengembalikan true bila ada order yang diperbarui.
export async function applyMayarStatusByInvoiceId(
  invoiceId: string,
  mayarStatus: string,
): Promise<boolean> {
  if (!invoiceId) return false;
  try {
    const raw  = await AsyncStorage.getItem(STORAGE_KEY_ORDERS);
    const all: any[] = raw ? JSON.parse(raw) : [];
    const found = all.find((o) => o.mayarInvoiceId === invoiceId);
    if (!found) return false;

    const next = mapMayarStatusToOrderStatus(mayarStatus);
    if (found.status === next) return true; // sudah sama

    const updated = all.map((o) =>
      o.mayarInvoiceId === invoiceId
        ? { ...o, status: next, updatedAt: new Date().toISOString() }
        : o,
    );
    await AsyncStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

// Handler utama webhook (dipanggil dari server/route).
export async function handleMayarWebhook(
  rawBody: string,
  signature?: string | null,
): Promise<{ ok: boolean; updated: boolean; message: string }> {
  if (!verifyMayarWebhook(rawBody, signature)) {
    return { ok: false, updated: false, message: "Invalid signature" };
  }
  let payload: MayarWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, updated: false, message: "Invalid JSON" };
  }
  const invoiceId = payload.invoiceId ?? payload.id ?? "";
  const updated   = await applyMayarStatusByInvoiceId(invoiceId, payload.status ?? "");
  return { ok: true, updated, message: updated ? "updated" : "no matching order" };
}
