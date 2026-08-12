// twd-backend/src/models/Product.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Product = sequelize.define(
  "Product",
  {
    id: {
      type:         DataTypes.STRING,
      defaultValue: () => "prod_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      primaryKey:   true,
    },
    name: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    sku: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    barcode: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    kategori: {
      type:         DataTypes.STRING,
      defaultValue: "Lainnya",
    },
    buyPrice: {
      type:         DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    sellPrice: {
      type:         DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    stock: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
    },
    stockMin: {
      type:         DataTypes.INTEGER,
      defaultValue: 5,
    },
    ownerId: {
      type:         DataTypes.STRING,
      allowNull:    true, // kalau null -> Global Product ekosistem
    },
    batches: {
      type:         DataTypes.JSONB,
      defaultValue: [], // untuk FIFO, LIFO, Average (stok batch akuntansi)
    },
    fotoUrl: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
  },
  {
    timestamps: true,
    tableName:  "products",
  },
);

module.exports = Product;
