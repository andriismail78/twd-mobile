// twd-backend/src/routes/stores.routes.js
const express = require("express");
const { Store, Product } = require("../models");
const { verifyToken, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/stores
 * Daftar seluruh toko (Super Admin / Mitra)
 */
router.get("/", async (req, res) => {
  try {
    const stores = await Store.findAll();
    res.json({ status: "success", data: stores });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * GET /api/stores/:kode
 * Cari toko berdasarkan Kode Unik Toko (misal: TWD-XXXXXX) untuk Customer / Kasir
 */
router.get("/:kode", async (req, res) => {
  try {
    const { kode } = req.params;
    const store = await Store.findOne({ where: { kode } });
    if (!store) {
      return res.status(404).json({ status: "error", message: `Toko dengan kode '${kode}' tidak ditemukan.` });
    }
    res.json({ status: "success", data: store });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * PUT /api/stores/:id/subscription
 * Ubah paket langganan atau masa aktif toko (Super Admin)
 */
router.put("/:id/subscription", verifyToken, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { paket, expiryDate, suspended } = req.body;

    const store = await Store.findByPk(id);
    if (!store) return res.status(404).json({ status: "error", message: "Toko tidak ditemukan." });

    if (paket !== undefined) store.paket = paket;
    if (expiryDate !== undefined) store.expiryDate = expiryDate;
    if (suspended !== undefined) store.suspended = suspended;

    await store.save();
    res.json({ status: "success", message: "Paket toko berhasil diperbarui.", data: store });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
