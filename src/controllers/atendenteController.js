const bcrypt = require('bcryptjs');
const { Atendente } = require('../models');

const isAdmin  = r => r.empresa.role === 'admin';
const owns     = (r, id) => r.empresa.empresaId === id;
const temAcesso = (r, empresa_id) => isAdmin(r) || owns(r, empresa_id);

const listar = async (req, res) => {
  try {
    const empresa_id = parseInt(req.params.empresaId);
    if (!temAcesso(req, empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    const lista = await Atendente.findAll({ where: { empresa_id, ativo: true }, order: [['criado_em', 'ASC']] });
    res.json(lista);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const criar = async (req, res) => {
  try {
    const empresa_id = parseInt(req.params.empresaId);
    if (!temAcesso(req, empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ error: 'nome, email e senha obrigatórios' });
    const senha_hash = await bcrypt.hash(senha, 10);
    const atendente = await Atendente.create({ empresa_id, nome, email, senha_hash });
    res.status(201).json(atendente);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const atualizar = async (req, res) => {
  try {
    const atendente = await Atendente.findByPk(req.params.id);
    if (!atendente) return res.status(404).json({ error: 'Atendente não encontrado' });
    if (!temAcesso(req, atendente.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    const { nome, email, senha, ativo } = req.body;
    const updates = { nome, email, ativo };
    if (senha) updates.senha_hash = await bcrypt.hash(senha, 10);
    await atendente.update(updates);
    res.json(atendente);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const deletar = async (req, res) => {
  try {
    const atendente = await Atendente.findByPk(req.params.id);
    if (!atendente) return res.status(404).json({ error: 'Atendente não encontrado' });
    if (!temAcesso(req, atendente.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    await atendente.update({ ativo: false });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { listar, criar, atualizar, deletar };
