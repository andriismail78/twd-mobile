// twd-backend/src/routes/products.routes.js
const express = require("express");
const { Product } = require("../models");
const { verifyToken } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/products
 * Ambil produk toko (filter by ownerId) atau katalog global (ownerId null)
 */
router.get("/", async (req, res) => {
  try {
    const { ownerId, global } = req.query;
    const whereClause = {};

    if (global === "true") {
      whereClause.ownerId = null;
    } else if (ownerId) {
      whereClause.ownerId = ownerId;
    }

    const products = await Product.findAll({ where: whereClause, order: [["createdAt", "DESC"]] });
    res.json({ status: "success", data: products });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * POST /api/products
 * Tambah produk baru (Owner / Super Admin)
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, sku, barcode, kategori, buyPrice, sellPrice, stock, stockMin, ownerId, batches, fotoUrl } = req.body;

    const product = await Product.create({
      name,
      sku:       sku || null,
      barcode:   barcode || null,
      kategori:  kategori || "Lainnya",
      buyPrice:  buyPrice || 0,
      sellPrice: sellPrice || 0,
      stock:     stock || 0,
      stockMin:  stockMin || 5,
      ownerId:   ownerId || null,
      batches:   batches || [],
      fotoUrl:   fotoUrl || null,
    });

    res.status(201).json({ status: "success", message: "Produk berhasil ditambahkan.", data: product });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * PUT /api/products/:id
 * Update data produk / stok (Owner / Kasir)
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ status: "error", message: "Produk tidak ditemukan." });

    await product.update(req.body);
    res.json({ status: "success", message: "Produk diperbarui.", data: product });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * DELETE /api/products/:id
 * Hapus produk
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ status: "error", message: "Produk tidak ditemukan." });

    await product.destroy();
    res.json({ status: "success", message: "Produk berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
