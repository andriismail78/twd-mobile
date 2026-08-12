// twd-backend/src/routes/withdrawals.routes.js
const express = require("express");
const { Withdrawal } = require("../models");
const { verifyToken, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/withdrawals
 * Ambil daftar pencairan (Super Admin / filter by userId)
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { userId, role, status } = req.query;
    const whereClause = {};

    if (userId) whereClause.userId = userId;
    if (role)   whereClause.role   = role;
    if (status) whereClause.status = status;

    const list = await Withdrawal.findAll({ where: whereClause, order: [["createdAt", "DESC"]] });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * POST /api/withdrawals
 * Ajukan pencairan dana ke rekening / e-Wallet (Owner, Kurir, Marketing, Sub Marketing)
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { userId, role, jumlah, namaBank, nomorRekening, namaPemilik } = req.body;

    if (!jumlah || !namaBank || !nomorRekening || !namaPemilik) {
      return res.status(400).json({ status: "error", message: "Data rekening tidak lengkap." });
    }

    const wd = await Withdrawal.create({
      userId:        userId || req.user.id,
      role:          role || req.user.role,
      jumlah,
      namaBank,
      nomorRekening,
      namaPemilik,
      status:        "menunggu",
    });

    res.status(201).json({ status: "success", message: "Permintaan pencairan diajukan.", data: wd });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * PUT /api/withdrawals/:id/approve
 * Setujui atau tolak permintaan pencairan (Super Admin)
 */
router.put("/:id/approve", verifyToken, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, catatan } = req.body; // status: "diproses" | "selesai" | "ditolak"

    const wd = await Withdrawal.findByPk(id);
    if (!wd) return res.status(404).json({ status: "error", message: "Permintaan pencairan tidak ditemukan." });

    if (status) wd.status = status;
    if (catatan !== undefined) wd.catatan = catatan;

    await wd.save();
    res.json({ status: "success", message: "Status pencairan diperbarui.", data: wd });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
