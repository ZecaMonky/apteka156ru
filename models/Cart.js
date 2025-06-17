const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Cart = sequelize.define('Cart', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  status: { type: DataTypes.STRING(20), defaultValue: 'active' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'carts',
  timestamps: false
});

module.exports = Cart; 