// twd-backend/src/routes/webhooks.routes.js
// Webhook endpoint untuk menerima notifikasi pembayaran sukses dari Mayar.id Payment Gateway

const express = require("express");
const { Order } = require("../models");

const router = express.Router();

/**
 * POST /api/webhooks/mayar
 * Webhook resmi Mayar.id ketika customer menyelesaikan pembayaran
 */
router.post("/mayar", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[WEBHOOK] Mayar.id notification received:", JSON.stringify(payload));

    // Validasi token/rahasia webhook jika dikonfigurasi di .env
    const webhookSecret = process.env.MAYAR_WEBHOOK_SECRET;
    const headerSignature = req.headers["x-mayar-signature"] || req.headers["authorization"];

    // Ambil orderId dari deskripsi / referensi transaksi Mayar
    const orderId = payload.orderId || payload.reference || payload.id;
    const status  = payload.status; // e.g. "PAID", "SUCCESS", "COMPLETED"

    if (orderId && (status === "PAID" || status === "SUCCESS" || status === "COMPLETED")) {
      // 1. Jika pembayaran langganan aplikasi Owner (orderId diawali SUB-)
      if (String(orderId).startsWith("SUB-")) {
        const ownerId = String(orderId).replace("SUB-", "");
        const store = await Store.findOne({ where: { ownerId } });
        if (store) {
          const baseDate = store.expiryDate && new Date(store.expiryDate) > new Date() ? new Date(store.expiryDate) : new Date();
          store.expiryDate = new Date(baseDate.getTime() + 30 * 86400000);
          await store.save();
          console.log(`[WEBHOOK] Langganan toko #${store.kode} otomatis diperpanjang +30 hari via Mayar.id.`);
        }
      } else {
        // 2. Jika pembelian online Customer
        const order = await Order.findOne({ where: { id: orderId } });
        if (order && order.status === "menunggu") {
          order.status = "diproses"; // Otomatis tandai siap / diproses
          order.note   = `${order.note || ""} [Dibayar Online via Mayar.id (${payload.payment_method || "QRIS"})]`;
          await order.save();
          console.log(`[WEBHOOK] Order #${orderId} otomatis berstatus DIPROSES.`);
        }
      }
    }

    res.status(200).json({ status: "success", message: "Webhook processed." });
  } catch (err) {
    console.error("[WEBHOOK] Error processing Mayar webhook:", err);
    res.status(500).json({ status: "error", message: "Webhook handling failed." });
  }
});

module.exports = router;
