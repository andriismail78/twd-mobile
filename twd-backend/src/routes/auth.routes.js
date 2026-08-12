// twd-backend/src/routes/auth.routes.js
const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { User, Store } = require("../models");
const { verifyToken, JWT_SECRET } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * POST /api/auth/register
 * Mendaftarkan akun baru (Owner / Kasir / Mitra / Kurir)
 */
router.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password, role, pin, ownerId, tokoName, kode } = req.body;

    if (!name || (!password && !pin)) {
      return res.status(400).json({ status: "error", message: "Nama dan password/PIN wajib diisi." });
    }

    // Cek apakah user sudah ada berdasarkan nomor HP atau email (Upsert: update PIN/nama jika sudah ada)
    let existing = await User.findOne({ where: phone ? { phone } : { email } });
    const hashedPassword = await bcrypt.hash(password || pin || "123456", 10);

    if (existing) {
      existing.name     = name || existing.name;
      if (pin) existing.pin = pin;
      existing.password = hashedPassword;
      if (role) existing.role = role;
      await existing.save();

      req.app.get("io")?.emit("user:sync", { action: "update", user: existing });

      const token = jwt.sign({ id: existing.id, role: existing.role, name: existing.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.status(200).json({
        status: "success",
        message: "Akun berhasil diperbarui/diunggah.",
        data: {
          token,
          user: {
            id:      existing.id,
            name:    existing.name,
            phone:   existing.phone,
            email:   existing.email,
            role:    existing.role,
            ownerId: existing.ownerId,
          },
        },
      });
    }

    const newUser = await User.create({
      name,
      phone:    phone || null,
      email:    email || null,
      password: hashedPassword,
      role:     role || "owner",
      pin:      pin || null,
      ownerId:  ownerId || null,
    });

    // Jika registrasi Owner, buatkan entry Store dengan kode unik toko
    if (newUser.role === "owner" && (tokoName || kode)) {
      await Store.create({
        tokoName:        tokoName || `Toko ${name}`,
        kode:            kode || `TWD-${Date.now().toString(36).toUpperCase()}`,
        ownerId:         newUser.id,
        paket:           "basic",
        recruitedBy:     req.body.recruitedBy || "super_admin",
        recruitedByRole: req.body.recruitedByRole || "marketing",
        expiryDate:      new Date(Date.now() + 30 * 86400000), // Trial 30 hari
      });
    }

    req.app.get("io")?.emit("user:sync", { action: "register", user: newUser });

    const token = jwt.sign({ id: newUser.id, role: newUser.role, name: newUser.name }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      status: "success",
      message: "Registrasi berhasil.",
      data: {
        token,
        user: {
          id:      newUser.id,
          name:    newUser.name,
          phone:   newUser.phone,
          email:   newUser.email,
          role:    newUser.role,
          ownerId: newUser.ownerId,
        },
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server." });
  }
});

/**
 * POST /api/auth/login
 * Login dengan No HP / Email / PIN
 */
router.post("/login", async (req, res) => {
  try {
    const { phone, email, password, pin, role } = req.body;

    const whereClause = phone ? { phone } : { email };
    const user = await User.findOne({ where: whereClause });

    if (!user) {
      return res.status(404).json({ status: "error", message: "Pengguna tidak ditemukan." });
    }

    const isMatch = await bcrypt.compare(password || pin, user.password);
    if (!isMatch && user.pin !== pin) {
      return res.status(401).json({ status: "error", message: "Password atau PIN salah." });
    }

    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      status: "success",
      message: "Login berhasil.",
      data: {
        token,
        user: {
          id:      user.id,
          name:    user.name,
          phone:   user.phone,
          email:   user.email,
          role:    user.role,
          ownerId: user.ownerId,
        },
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server." });
  }
});

/**
 * GET /api/auth/profile
 * Ambil data profil pengguna yang sedang login
 */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return res.status(404).json({ status: "error", message: "User tidak ditemukan." });

    res.json({ status: "success", data: user });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server." });
  }
});

/**
 * GET /api/auth/users
 * Ambil daftar seluruh pengguna di ekosistem (Super Admin / Cloud Sync)
 */
router.get("/users", async (req, res) => {
  try {
    const { role } = req.query;
    const whereClause = role && role !== "semua" ? { role } : {};
    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });
    res.json({ status: "success", data: users });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * PUT /api/auth/users/:id
 * Edit data pengguna (Nama, No HP, PIN, Role, Status) — Super Admin / Cloud Sync
 */
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, role, pin, active, status } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ status: "error", message: "Akun tidak ditemukan." });

    if (name !== undefined)   user.name = name;
    if (phone !== undefined)  user.phone = phone;
    if (email !== undefined)  user.email = email;
    if (role !== undefined)   user.role = role;
    if (pin !== undefined)    user.pin = pin;
    if (active !== undefined) user.active = active;
    if (status !== undefined) user.status = status;

    await user.save();
    req.app.get("io")?.emit("user:sync", { action: "update", user });
    res.json({ status: "success", message: "Data akun berhasil diubah.", data: user });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Hapus akun pengguna (Super Admin / Cloud Sync)
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ status: "error", message: "Akun tidak ditemukan." });

    await user.destroy();
    req.app.get("io")?.emit("user:sync", { action: "delete", id });
    res.json({ status: "success", message: "Akun berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
