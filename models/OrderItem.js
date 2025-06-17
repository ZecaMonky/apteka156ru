const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, references: { model: 'orders', key: 'id' } },
  product_id: { type: DataTypes.INTEGER, references: { model: 'products', key: 'id' } },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
  price: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  old_price: { type: DataTypes.DECIMAL(10,2) },
  discount_percent: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'order_items',
  timestamps: false
});

module.exports = OrderItem; 