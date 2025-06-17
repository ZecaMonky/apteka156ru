const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  prescription_url: { type: DataTypes.STRING(255) },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  phone: { type: DataTypes.STRING(20) },
  address: { type: DataTypes.STRING(255) }
}, {
  tableName: 'orders',
  timestamps: false
});

module.exports = Order; 