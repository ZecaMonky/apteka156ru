const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING(100), primaryKey: true },
  value: { type: DataTypes.TEXT }
}, {
  tableName: 'settings',
  timestamps: false
});

module.exports = Setting; 