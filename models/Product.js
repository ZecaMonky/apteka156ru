const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  price: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  description: { type: DataTypes.TEXT },
  image_url: { type: DataTypes.STRING(255) },
  category_id: { type: DataTypes.INTEGER, references: { model: 'categories', key: 'id' } },
  is_hidden: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_discounted: { type: DataTypes.BOOLEAN, defaultValue: false },
  discount_percent: { type: DataTypes.INTEGER, defaultValue: 0 },
  requires_prescription: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'products',
  timestamps: false
});

// Для миграции:
// ALTER TABLE products ADD COLUMN discount_percent INTEGER DEFAULT 0;

module.exports = Product; 