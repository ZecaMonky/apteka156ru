const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { require: true, rejectUnauthorized: false } : false
  },
  logging: false,
});

module.exports = { sequelize }; 