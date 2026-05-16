const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mensagem = sequelize.define('Mensagem', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:   { type: DataTypes.INTEGER, allowNull: false },
  cliente_id:   { type: DataTypes.INTEGER, allowNull: false },
  conteudo:     { type: DataTypes.TEXT, allowNull: false },
  de_cliente:   { type: DataTypes.BOOLEAN, defaultValue: false },
  de_ia:        { type: DataTypes.BOOLEAN, defaultValue: false },
  atendente_id: { type: DataTypes.INTEGER }, // null = IA ou sistema
  criado_em:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'mensagens',
  timestamps: false
});

module.exports = Mensagem;
