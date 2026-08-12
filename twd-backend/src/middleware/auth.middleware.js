// twd-backend/src/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "twd_super_secret_jwt_key_2026";

/**
 * Middleware untuk memverifikasi token JWT dari header Authorization
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ status: "error", message: "Akses ditolak. Token tidak disediakan." });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ status: "error", message: "Format token tidak valid (Bearer <token>)." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "Token kadaluarsa atau tidak valid." });
  }
}

/**
 * Middleware untuk membatasi akses berdasar peran (role) tertentu
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status:  "error",
        message: `Akses ditolak. Peran Anda '${req.user?.role}' tidak diizinkan.`,
      });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
  JWT_SECRET,
};
