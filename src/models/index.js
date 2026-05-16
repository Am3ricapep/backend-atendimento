const sequelize = require('../config/database');
const Empresa = require('./Empresa');
const Cliente = require('./Cliente');

Empresa.hasMany(Cliente, { foreignKey: 'empresa_id', as: 'clientes' });
Cliente.belongsTo(Empresa, { foreignKey: 'empresa_id', as: 'empresa' });

module.exports = { sequelize, Empresa, Cliente };
