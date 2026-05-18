const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prova = sequelize.define('Prova', {
  id:                       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:               { type: DataTypes.INTEGER, allowNull: false },
  // 'social' = prova social (foto/video de cliente, depoimento etc)
  // 'certificado' = certificado de laboratorio, laudo de pureza, etc
  tipo:                     { type: DataTypes.STRING(20), allowNull: false },
  // FK opcional para produtos: NULL = prova "geral" (aparece em qualquer conversa)
  produto_id:               { type: DataTypes.INTEGER, allowNull: true },
  titulo:                   { type: DataTypes.TEXT, allowNull: false },
  descricao:                { type: DataTypes.TEXT },
  cloudinary_public_id:     { type: DataTypes.TEXT, allowNull: false },
  cloudinary_url:           { type: DataTypes.TEXT, allowNull: false },
  // 'image' | 'video' | 'raw' — usado pela Evolution sendMedia para decidir o tipo
  cloudinary_resource_type: { type: DataTypes.STRING(20), allowNull: false },
  ativo:                    { type: DataTypes.BOOLEAN, defaultValue: true },
  criado_em:                { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'provas',
  timestamps: false,
});

module.exports = Prova;
