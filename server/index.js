// server/index.js — Backend minimal TWD Mobile
// - Menyimpan order (JSON file, tanpa DB native agar mudah di-deploy di KVM)
// - Endpoint webhook Mayar.id (POST /webhooks/mayar) untuk update status otomatis
// - API order sederhana (GET/POST /api/orders) untuk sinkronisasi antar-device
//
// Cara jalan lokal:  MAYAR_WEBHOOK_TOKEN=xxx node index.js
// Di KVM:            docker build -t twd-backend . && docker run -d -p 3000:3000 -e MAYAR_WEBHOOK_TOKEN=xxx twd-backend

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(require("cors")());

const PORT = process.env.PORT || 3000;
const WEBHOOK_TOKEN = process.env.MAYAR_WEBHOOK_TOKEN || "YOUR_MAYAR_WEBHOOK_TOKEN";
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function mapMayarStatus(s) {
  switch ((s || "").toLowerCase()) {
    case "paid":
    case "settlement":
    case "success":
      return "dikonfirmasi";
    case "expired":
    case "closed":
    case "cancelled":
    case "canceled":
      return "dibatalkan";
    default:
      return "menunggu";
  }
}

// Verifikasi signature webhook Mayar (best-effort, sama dengan app mayarWebhook.ts)
function verifyMayarWebhook(rawBody, signature) {
  if (WEBHOOK_TOKEN === "YOUR_MAYAR_WEBHOOK_TOKEN") return true; // dev: lewati verifikasi
  if (!signature) {
    try {
      const p = JSON.parse(rawBody);
      return p.token === WEBHOOK_TOKEN || p.webhookToken === WEBHOOK_TOKEN;
    } catch {
      return false;
    }
  }
  const expected = crypto
    .createHmac("sha256", WEBHOOK_TOKEN)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Webhook Mayar.id ──
app.post("/webhooks/mayar", (req, res) => {
  const raw = JSON.stringify(req.body);
  const sig =
    req.headers["x-mayar-signature"] || req.headers["x-payment-signature"];
  if (!verifyMayarWebhook(raw, sig)) {
    return res.status(401).json({ error: "invalid signature" });
  }
  const id = req.body.invoiceId || req.body.id;
  const status = mapMayarStatus(req.body.status);
  const orders = readOrders();
  const target = orders.find((o) => o.mayarInvoiceId === id);
  if (target) {
    target.status = status;
    target.updatedAt = new Date().toISOString();
    writeOrders(orders);
  }
  res.json({ ok: true, updated: !!target });
});

// ── API order (untuk sinkronisasi antar-device saat app sudah memanggil API) ──
app.get("/api/orders", (_req, res) => res.json(readOrders()));

app.post("/api/orders", (req, res) => {
  const orders = readOrders();
  const order = {
    ...req.body,
    id: req.body.id || "ord-" + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.unshift(order);
  writeOrders(orders);
  res.status(201).json(order);
});

app.listen(PORT, () => console.log("TWD backend listening on :" + PORT));
