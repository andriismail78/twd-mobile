// twd-backend/src/models/User.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type:         DataTypes.STRING,
      defaultValue: () => "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      primaryKey:   true,
    },
    name: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    phone: {
      type:         DataTypes.STRING,
      unique:       true,
      allowNull:    true,
    },
    email: {
      type:         DataTypes.STRING,
      unique:       true,
      allowNull:    true,
    },
    password: {
      type:         DataTypes.STRING,
      allowNull:    false,
    },
    role: {
      type:         DataTypes.ENUM("owner", "kasir", "kurir", "marketing", "sub_marketing", "super_admin", "customer"),
      defaultValue: "owner",
    },
    pin: {
      type:         DataTypes.STRING(10),
      allowNull:    true,
    },
    active: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    status: {
      type:         DataTypes.STRING,
      defaultValue: "terverifikasi", // menunggu_verifikasi, terverifikasi, ditolak
    },
    ownerId: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    marketingRef: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    subMarketingRef: {
      type:         DataTypes.STRING,
      allowNull:    true,
    },
    rating: {
      type:         DataTypes.FLOAT,
      defaultValue: 5.0,
    },
  },
  {
    timestamps: true,
    tableName:  "users",
  },
);

module.exports = User;
