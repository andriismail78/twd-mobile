// twd-backend/server.js
// Entry Point Resmi TWD Backend — API REST Node.js/Express (PostgreSQL & MySQL)

require("dotenv").config();
const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const cors    = require("cors");
const morgan  = require("morgan");
const { sequelize } = require("./src/models");

// ── Import rute ──────────────────────────────────────────────────────────────
const authRoutes       = require("./src/routes/auth.routes");
const storesRoutes     = require("./src/routes/stores.routes");
const productsRoutes   = require("./src/routes/products.routes");
const ordersRoutes     = require("./src/routes/orders.routes");
const withdrawalRoutes = require("./src/routes/withdrawals.routes");
const webhooksRoutes   = require("./src/routes/webhooks.routes");

const app  = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`[SOCKET] ⚡ Klien terhubung: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[SOCKET] 🔌 Klien terputus: ${socket.id}`);
  });
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(require("cors")());
app.use(morgan("dev"));

// ── Root & Health Check ──────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "online",
    name:    "TWD Backend API",
    version: "1.0.0",
    engine:  "Node.js + Express + Sequelize ORM (" + (process.env.DB_DIALECT || "postgres") + ")",
    time:    new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status:   "healthy",
    database: "connected",
    dialect:  process.env.DB_DIALECT || "postgres",
  });
});

// ── API Endpoints ────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/stores",      storesRoutes);
app.use("/api/products",    productsRoutes);
app.use("/api/orders",      ordersRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/webhooks",    webhooksRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    status:  "error",
    message: `Endpoint ${req.method} ${req.url} tidak ditemukan di server ini.`,
  });
});

// ── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
  let retries = 10;
  while (retries > 0) {
    try {
      await sequelize.authenticate();
      console.log(`[DB] Berhasil terhubung ke database (${process.env.DB_DIALECT || "postgres"}).`);
      await sequelize.sync({ alter: true });
      console.log("[DB] Skema tabel tersinkronisasi.");

      server.listen(PORT, () => {
        console.log(`[SERVER] 🚀 TWD Backend API + Socket.IO berjalan di http://localhost:${PORT}`);
        console.log(`[SERVER] 📖 Dokumentasi API tersedia di root endpoint.`);
      });
      return;
    } catch (err) {
      console.error(`[SERVER] ⚠️ Gagal terhubung ke database. Sisa percobaan: ${retries - 1}`, err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  console.error("[SERVER] ❌ Gagal menjalankan server setelah 10 percobaan.");
  process.exit(1);
}

startServer();
