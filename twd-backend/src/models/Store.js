// twd-backend/src/models/Store.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Store = sequelize.define(
  "Store",
  {
    id: {
      type:         DataTypes.STRING,
      defaultValue: () => "store_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      primaryKey:   true,
    },
    tokoName: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    kode: {
      type:         DataTypes.STRING(20),
      unique:       true,
      allowNull:    false, // e.g. TWD-XXXXXX
    },
    ownerId: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    paket: {
      type:         DataTypes.ENUM("basic", "pro", "enterprise"),
      defaultValue: "basic",
    },
    expiryDate: {
      type:         DataTypes.DATE,
      allowNull:    true,
    },
    alamat: {
      type:         DataTypes.TEXT,
      allowNull:    true,
    },
    latitude: {
      type:         DataTypes.FLOAT,
      allowNull:    true,
    },
    longitude: {
      type:         DataTypes.FLOAT,
      allowNull:    true,
    },
    suspended: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recruitedBy: {
      type:         DataTypes.STRING,
      defaultValue: "super_admin",
    },
    recruitedByRole: {
      type:         DataTypes.STRING,
      defaultValue: "marketing",
    },
  },
  {
    timestamps: true,
    tableName:  "stores",
  },
);

module.exports = Store;
