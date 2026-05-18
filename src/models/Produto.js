const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Produto = sequelize.define('Produto', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome:       { type: DataTypes.TEXT, allowNull: false },
  indicacao:  { type: DataTypes.TEXT },
  preco:      { type: DataTypes.TEXT },
  preco_de:   { type: DataTypes.TEXT },
  dose:       { type: DataTypes.TEXT },
  protocolo:  { type: DataTypes.TEXT },
  stack:      { type: DataTypes.TEXT },
  upsell:       { type: DataTypes.TEXT },
  script_venda: { type: DataTypes.TEXT },
  ativo:        { type: DataTypes.BOOLEAN, defaultValue: true },
  ordem:      { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'produtos',
  timestamps: false
});

module.exports = Produto;
