// twd-backend/src/config/database.js
require("dotenv").config();
const { Sequelize } = require("sequelize");

const dialect = process.env.DB_DIALECT || "postgres"; // "postgres" atau "mysql"

const sequelize = new Sequelize(
  process.env.DB_NAME || "twd_production",
  process.env.DB_USER || "twd_user",
  process.env.DB_PASS || "twd_password_secure",
  {
    host:    process.env.DB_HOST || "localhost",
    port:    process.env.DB_PORT || (dialect === "mysql" ? 3306 : 5432),
    dialect: dialect,
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max:     10,
      min:     0,
      acquire: 30000,
      idle:    10000,
    },
  },
);

module.exports = { sequelize };
