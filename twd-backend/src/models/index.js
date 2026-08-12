// twd-backend/src/models/index.js
const { sequelize } = require("../config/database");
const User          = require("./User");
const Store         = require("./Store");
const Product       = require("./Product");
const Order         = require("./Order");
const Withdrawal    = require("./Withdrawal");

// Relasi Ekosistem TWD (Berpusat pada User ID / Owner ID)
User.hasMany(Store,       { foreignKey: "ownerId", sourceKey: "id" });
Store.belongsTo(User,     { foreignKey: "ownerId", targetKey: "id" });

User.hasMany(Product,     { foreignKey: "ownerId", sourceKey: "id" });
Product.belongsTo(User,   { foreignKey: "ownerId", targetKey: "id" });

User.hasMany(Order,       { foreignKey: "ownerId", sourceKey: "id" });
Order.belongsTo(User,     { foreignKey: "ownerId", targetKey: "id" });

User.hasMany(Withdrawal,  { foreignKey: "userId",  sourceKey: "id" });
Withdrawal.belongsTo(User,{ foreignKey: "userId",  targetKey: "id" });

module.exports = {
  sequelize,
  User,
  Store,
  Product,
  Order,
  Withdrawal,
};
