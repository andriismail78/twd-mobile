// twd-backend/src/models/Order.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Order = sequelize.define(
  "Order",
  {
    id: {
      type:         DataTypes.STRING,
      defaultValue: () => "ord_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      primaryKey:   true,
    },
    ownerId: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    customerName: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    customerPhone: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    customerAddress: {
      type:         DataTypes.TEXT,
      allowNull:    true,
    },
    items: {
      type:         DataTypes.JSONB,
      allowNull:    false,
      defaultValue: [],
    },
    subtotal: {
      type:         DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    total: {
      type:         DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    status: {
      type:         DataTypes.ENUM("menunggu", "diproses", "dikirim", "selesai", "dibatalkan", "tertunda"),
      defaultValue: "menunggu",
    },
    metodeBayar: {
      type:         DataTypes.STRING,
      defaultValue: "tunai", // tunai, qris, mayar
    },
    kurirId: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    kurirName: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    namaPenerima: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    kendalaKirim: {
      type:         DataTypes.TEXT,
      allowNull:    true,
    },
    fotoBuktiKirim: {
      type:         DataTypes.TEXT,
      allowNull:    true,
    },
    waktuDiambil: {
      type:         DataTypes.DATE,
      allowNull:    true,
    },
    waktuDikirim: {
      type:         DataTypes.DATE,
      allowNull:    true,
    },
    waktuSelesai: {
      type:         DataTypes.DATE,
      allowNull:    true,
    },
    waktuKendala: {
      type:         DataTypes.DATE,
      allowNull:    true,
    },
  },
  {
    timestamps: true,
    tableName:  "orders",
  },
);

module.exports = Order;
