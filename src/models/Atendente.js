const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Atendente = sequelize.define('Atendente', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome:       { type: DataTypes.TEXT, allowNull: false },
  email:      { type: DataTypes.TEXT, allowNull: false },
  senha_hash: { type: DataTypes.TEXT },
  ativo:      { type: DataTypes.BOOLEAN, defaultValue: true },
  criado_em:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'atendentes',
  timestamps: false
});

module.exports = Atendente;
