const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  image_url: { type: DataTypes.STRING(255) }
}, {
  tableName: 'categories',
  timestamps: false
});

module.exports = Category; 