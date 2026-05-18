const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Empresa = sequelize.define('Empresa', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug:               { type: DataTypes.TEXT, unique: true, allowNull: false },
  nome:               { type: DataTypes.TEXT, allowNull: false },
  email:              { type: DataTypes.TEXT },
  senha_hash:         { type: DataTypes.TEXT },
  role:               { type: DataTypes.TEXT, defaultValue: 'empresa' }, // 'empresa' | 'admin'
  atendente:          { type: DataTypes.TEXT, defaultValue: 'Ana' },
  checkout_url:       { type: DataTypes.TEXT },
  evolution_instance: { type: DataTypes.TEXT },
  n8n_workflow_id:    { type: DataTypes.TEXT },
  sheets_id:          { type: DataTypes.TEXT },
  pg_schema:          { type: DataTypes.TEXT },
  prompt:             { type: DataTypes.TEXT },
  ativo:              { type: DataTypes.BOOLEAN, defaultValue: true },
  criado_em:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'empresas',
  timestamps: false
});

module.exports = Empresa;
