const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Empresa = sequelize.define('Empresa', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug:               { type: DataTypes.TEXT, unique: true, allowNull: false },
  nome:               { type: DataTypes.TEXT, allowNull: false },
  atendente:          { type: DataTypes.TEXT, defaultValue: 'Ana' },
  checkout_url:       { type: DataTypes.TEXT },
  evolution_instance: { type: DataTypes.TEXT },
  n8n_workflow_id:    { type: DataTypes.TEXT },
  sheets_id:          { type: DataTypes.TEXT },
  pg_schema:          { type: DataTypes.TEXT },
  ativo:              { type: DataTypes.BOOLEAN, defaultValue: true },
  criado_em:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'empresas',
  timestamps: false
});

module.exports = Empresa;
