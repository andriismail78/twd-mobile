// src/utils/DokuService.ts

import axios from "axios";
import CryptoJS from "crypto-js";
import {
    DOKU_BASE_URL,
    DOKU_CLIENT_ID,
    DOKU_SECRET_KEY,
} from "../config/doku.config";

// ── Types ──────────────────────────────────────────────────────────

export type DokuBank = "BCA" | "BNI" | "BRI" | "MANDIRI" | "PERMATA";

export type CreateVirtualAccountParams = {
  orderId:       string;
  amount:        number;
  customerName:  string;
  customerEmail: string;
  bank:          DokuBank;
  expiredTime?:  number;
};

export type CreateQrisParams = {
  orderId:       string;
  amount:        number;
  customerName:  string;
  customerEmail: string;
  expiredTime?:  number;
};

export type DokuVaResponse = {
  virtual_account_info?: {
    virtual_account_number?: string;
    expired_time?:           number;
  };
  payment?: {
    virtual_account_info?: {
      virtual_account_number?: string;
    };
  };
  order?: {
    invoice_number?: string;
    amount?:         number;
  };
  how_to_pay_page?:  string;
  response_code?:    string;
  response_message?: string;
  [key: string]: any;
};

export type DokuQrisResponse = {
  qris_info?: {
    qr_string?: string; // raw QR data untuk di-render
    qr_url?:    string; // URL gambar QR
  };
  payment?: {
    qris_info?: {
      qr_string?: string;
    };
  };
  how_to_pay_page?:  string; // URL halaman instruksi
  order?: {
    invoice_number?: string;
    amount?:         number;
  };
  response_code?:    string;
  response_message?: string;
  [key: string]: any;
};

export type CheckPaymentStatusResponse = {
  order?: {
    invoice_number?: string;
    amount?:         number;
    status?:         "SUCCESS" | "PENDING" | "FAILED" | "EXPIRED";
  };
  response_code?:    string;
  response_message?: string;
  [key: string]: any;
};

// ── Crypto Helpers (crypto-js + polyfill di _layout.tsx) ───────────

function sha256Base64(input: string): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Base64);
}

function hmacSha256Base64(key: string, data: string): string {
  return CryptoJS.HmacSHA256(data, key).toString(CryptoJS.enc.Base64);
}

// ── Build Signature DOKU ───────────────────────────────────────────

function buildSignature(params: {
  clientId:         string;
  requestId:        string;
  requestTimestamp: string;
  requestTarget:    string;
  secretKey:        string;
  body?:            object;
}): string {
  const {
    clientId, requestId, requestTimestamp,
    requestTarget, secretKey, body,
  } = params;

  let digestLine = "";
  if (body && Object.keys(body).length > 0) {
    const bodyHash = sha256Base64(JSON.stringify(body));
    digestLine     = `\nDigest:${bodyHash}`;
  }

  const componentToSign =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${requestTimestamp}\n` +
    `Request-Target:${requestTarget}` +
    digestLine;

  return `HMACSHA256=${hmacSha256Base64(secretKey, componentToSign)}`;
}

// ── Helpers ────────────────────────────────────────────────────────

function buildRequestId(): string {
  return `twd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildTimestamp(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function getBankChannelId(bank: DokuBank): string {
  const map: Record<DokuBank, string> = {
    BCA:     "VIRTUAL_ACCOUNT_BCA",
    BNI:     "VIRTUAL_ACCOUNT_BNI",
    BRI:     "VIRTUAL_ACCOUNT_BRI",
    MANDIRI: "VIRTUAL_ACCOUNT_MANDIRI",
    PERMATA: "VIRTUAL_ACCOUNT_PERMATA",
  };
  return map[bank];
}

async function postDoku<T>(
  requestTarget: string,
  body: object,
): Promise<T> {
  const requestId        = buildRequestId();
  const requestTimestamp = buildTimestamp();
  const signature        = buildSignature({
    clientId: DOKU_CLIENT_ID,
    requestId,
    requestTimestamp,
    requestTarget,
    secretKey: DOKU_SECRET_KEY,
    body,
  });

  console.log("[DOKU] POST →", requestTarget, { requestId, body: JSON.stringify(body) });

  const response = await axios.post<T>(
    `${DOKU_BASE_URL}${requestTarget}`,
    body,
    {
      headers: {
        "Client-Id":         DOKU_CLIENT_ID,
        "Request-Id":        requestId,
        "Request-Timestamp": requestTimestamp,
        "Signature":         signature,
        "Content-Type":      "application/json",
      },
      timeout: 20_000,
    },
  );

  console.log("[DOKU] Response ✅", JSON.stringify(response.data));
  return response.data;
}

async function getDoku<T>(requestTarget: string): Promise<T> {
  const requestId        = buildRequestId();
  const requestTimestamp = buildTimestamp();
  const signature        = buildSignature({
    clientId: DOKU_CLIENT_ID,
    requestId,
    requestTimestamp,
    requestTarget,
    secretKey: DOKU_SECRET_KEY,
  });

  const response = await axios.get<T>(
    `${DOKU_BASE_URL}${requestTarget}`,
    {
      headers: {
        "Client-Id":         DOKU_CLIENT_ID,
        "Request-Id":        requestId,
        "Request-Timestamp": requestTimestamp,
        "Signature":         signature,
      },
      timeout: 10_000,
    },
  );

  return response.data;
}

function handleDokuError(error: any, label: string): never {
  const status  = error?.response?.status;
  const errData = error?.response?.data;
  console.error(`[DOKU] ${label} ❌`, { status, data: JSON.stringify(errData), msg: error?.message });
  throw new Error(
    errData?.response_message ??
    errData?.error            ??
    `DOKU error HTTP ${status ?? "?"}: ${error?.message}`,
  );
}

// ─────────────────────────────────────────────────────────────────
// FUNGSI 1: Buat Virtual Account
// ─────────────────────────────────────────────────────────────────

export async function createVirtualAccount(
  params: CreateVirtualAccountParams,
): Promise<DokuVaResponse> {
  const { orderId, amount, customerName, customerEmail, bank, expiredTime = 60 } = params;

  const body = {
    order: {
      invoice_number:      orderId,
      amount,
      currency:            "IDR",
      callback_url:        "https://twd-app.com/callback",
      callback_url_cancel: "https://twd-app.com/cancel",
    },
    payment: {
      payment_due_date: expiredTime,
    },
    customer: {
      name:  customerName,
      email: customerEmail,
    },
    channel_info: {
      channel_id: getBankChannelId(bank),
    },
    virtual_account_info: {
      expired_time:    expiredTime,
      reusable_status: false,
      info1:           "TWD Mobile",
      info2:           customerName,
      info3:           orderId,
    },
  };

  try {
    return await postDoku<DokuVaResponse>("/checkout/v1/payment", body);
  } catch (e) {
    handleDokuError(e, "createVirtualAccount");
  }
}

// ─────────────────────────────────────────────────────────────────
// FUNGSI 2: Buat QRIS Payment ✅ BARU
// ─────────────────────────────────────────────────────────────────

export async function createQrisPayment(
  params: CreateQrisParams,
): Promise<DokuQrisResponse> {
  const { orderId, amount, customerName, customerEmail, expiredTime = 30 } = params;

  const body = {
    order: {
      invoice_number:      orderId,
      amount,
      currency:            "IDR",
      callback_url:        "https://twd-app.com/callback",
      callback_url_cancel: "https://twd-app.com/cancel",
    },
    payment: {
      payment_due_date: expiredTime,
    },
    customer: {
      name:  customerName,
      email: customerEmail,
    },
    channel_info: {
      channel_id: "QRIS",
    },
    qris_info: {
      expired_time: expiredTime,
      type:         "dynamic", // dynamic = unik per transaksi
    },
  };

  try {
    return await postDoku<DokuQrisResponse>("/checkout/v1/payment", body);
  } catch (e) {
    handleDokuError(e, "createQrisPayment");
  }
}

// ─────────────────────────────────────────────────────────────────
// FUNGSI 3: Cek Status Pembayaran (VA & QRIS)
// ─────────────────────────────────────────────────────────────────

export async function checkPaymentStatus(
  invoiceNumber: string,
): Promise<CheckPaymentStatusResponse> {
  try {
    return await getDoku<CheckPaymentStatusResponse>(
      `/orders/v1/status/${invoiceNumber}`,
    );
  } catch (e) {
    handleDokuError(e, "checkPaymentStatus");
  }
}