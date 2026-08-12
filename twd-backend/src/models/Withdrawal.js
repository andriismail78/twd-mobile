// twd-backend/src/models/Withdrawal.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Withdrawal = sequelize.define(
  "Withdrawal",
  {
    id: {
      type:         DataTypes.STRING,
      defaultValue: () => "wd_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      primaryKey:   true,
    },
    userId: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    role: {
      type:         DataTypes.ENUM("owner", "kurir", "marketing", "sub_marketing"),
      allowNull:    false,
    },
    jumlah: {
      type:         DataTypes.DECIMAL(12, 2),
      allowNull:    false,
    },
    namaBank: {
      type:         DataTypes.STRING,
      allowNull:    false, // BCA, BRI, DANA, GOPAY, dll
    },
    nomorRekening: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    namaPemilik: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    status: {
      type:         DataTypes.ENUM("menunggu", "diproses", "selesai", "ditolak"),
      defaultValue: "menunggu",
    },
    catatan: {
      type:         DataTypes.TEXT,
      allowNull:    true,
    },
  },
  {
    timestamps: true,
    tableName:  "withdrawals",
  },
);

module.exports = Withdrawal;
