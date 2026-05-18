const sequelize = require('../config/database');
const Empresa   = require('./Empresa');
const Cliente   = require('./Cliente');
const Atendente = require('./Atendente');
const Mensagem  = require('./Mensagem');
const Produto   = require('./Produto');
const Prova     = require('./Prova');

Empresa.hasMany(Cliente,   { foreignKey: 'empresa_id', as: 'clientes' });
Empresa.hasMany(Atendente, { foreignKey: 'empresa_id', as: 'atendentes' });
Empresa.hasMany(Produto,   { foreignKey: 'empresa_id', as: 'produtos' });
Empresa.hasMany(Mensagem,  { foreignKey: 'empresa_id', as: 'mensagens' });
Empresa.hasMany(Prova,     { foreignKey: 'empresa_id', as: 'provas' });

Cliente.belongsTo(Empresa,   { foreignKey: 'empresa_id' });
Cliente.hasMany(Mensagem,    { foreignKey: 'cliente_id', as: 'mensagens' });

Atendente.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Mensagem.belongsTo(Cliente,  { foreignKey: 'cliente_id' });
Mensagem.belongsTo(Atendente,{ foreignKey: 'atendente_id' });
Produto.belongsTo(Empresa,   { foreignKey: 'empresa_id' });
Produto.hasMany(Prova,       { foreignKey: 'produto_id', as: 'provas' });
Prova.belongsTo(Empresa,     { foreignKey: 'empresa_id' });
Prova.belongsTo(Produto,     { foreignKey: 'produto_id' });

module.exports = { sequelize, Empresa, Cliente, Atendente, Mensagem, Produto, Prova };
