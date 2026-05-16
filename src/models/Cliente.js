const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Cliente = sequelize.define('Cliente', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:      { type: DataTypes.INTEGER, allowNull: false },
  phone:           { type: DataTypes.TEXT, allowNull: false },
  nome:            { type: DataTypes.TEXT },
  estagio:         { type: DataTypes.TEXT, defaultValue: 'anamnese' },
  objetivo:        { type: DataTypes.TEXT },
  produto_indicado:{ type: DataTypes.TEXT },
  conversation_id: { type: DataTypes.TEXT },
  contexto_humano: { type: DataTypes.TEXT, defaultValue: '' },
  ultima_interacao:{ type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'clientes',
  timestamps: false
});

module.exports = Cliente;
