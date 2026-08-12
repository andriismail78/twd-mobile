// twd-backend/src/routes/orders.routes.js
const express = require("express");
const { Order } = require("../models");
const { verifyToken } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/orders
 * Ambil daftar pesanan (filter by ownerId / kurirId / status)
 */
router.get("/", async (req, res) => {
  try {
    const { ownerId, kurirId, status } = req.query;
    const whereClause = {};

    if (ownerId) whereClause.ownerId = ownerId;
    if (kurirId) whereClause.kurirId = kurirId;
    if (status)  whereClause.status  = status;

    const orders = await Order.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
    });
    res.json({ status: "success", data: orders });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * POST /api/orders
 * Buat pesanan baru (Customer / Kasir POS)
 */
router.post("/", async (req, res) => {
  try {
    const {
      ownerId,
      customerName,
      customerPhone,
      customerAddress,
      items,
      subtotal,
      total,
      metodeBayar,
      note,
    } = req.body;

    const newOrder = await Order.create({
      ownerId,
      customerName,
      customerPhone:   customerPhone || null,
      customerAddress: customerAddress || null,
      items:           items || [],
      subtotal:        subtotal || 0,
      total:           total || 0,
      status:          "menunggu",
      metodeBayar:     metodeBayar || "tunai",
      note:            note || null,
    });

    res.status(201).json({ status: "success", message: "Pesanan dibuat.", data: newOrder });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * PUT /api/orders/:id/status
 * Update status pesanan (menunggu -> diproses -> dikirim -> selesai / tertunda)
 */
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      kurirId,
      kurirName,
      namaPenerima,
      kendalaKirim,
      fotoBuktiKirim,
    } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ status: "error", message: "Pesanan tidak ditemukan." });

    if (status) order.status = status;
    if (kurirId !== undefined) order.kurirId = kurirId;
    if (kurirName !== undefined) order.kurirName = kurirName;
    if (namaPenerima !== undefined) order.namaPenerima = namaPenerima;
    if (kendalaKirim !== undefined) order.kendalaKirim = kendalaKirim;
    if (fotoBuktiKirim !== undefined) order.fotoBuktiKirim = fotoBuktiKirim;

    const now = new Date();
    if (status === "diproses" && !order.waktuDiambil) order.waktuDiambil = now;
    if (status === "dikirim"  && !order.waktuDikirim)  order.waktuDikirim = now;
    if (status === "selesai"  && !order.waktuSelesai)  order.waktuSelesai = now;
    if (status === "tertunda" && !order.waktuKendala)  order.waktuKendala = now;

    await order.save();
    res.json({ status: "success", message: "Status pesanan diperbarui.", data: order });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
