const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const CartItem = sequelize.define('CartItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cart_id: { type: DataTypes.INTEGER, references: { model: 'carts', key: 'id' } },
  product_id: { type: DataTypes.INTEGER, references: { model: 'products', key: 'id' } },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false }
}, {
  tableName: 'cart_items',
  timestamps: false
});

module.exports = CartItem; 