const { Produto } = require('../models');

const isAdmin   = r => r.empresa.role === 'admin';
const temAcesso = (r, empresa_id) => isAdmin(r) || r.empresa.empresaId === empresa_id;

const listar = async (req, res) => {
  try {
    const empresa_id = parseInt(req.params.empresaId);
    if (!temAcesso(req, empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    const lista = await Produto.findAll({ where: { empresa_id }, order: [['ordem', 'ASC'], ['id', 'ASC']] });
    res.json(lista);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const criar = async (req, res) => {
  try {
    const empresa_id = parseInt(req.params.empresaId);
    if (!temAcesso(req, empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    if (!req.body.nome) return res.status(400).json({ error: 'nome obrigatório' });
    const produto = await Produto.create({ empresa_id, ...req.body });
    res.status(201).json(produto);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const atualizar = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!temAcesso(req, produto.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    await produto.update(req.body);
    res.json(produto);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const deletar = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!temAcesso(req, produto.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    await produto.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { listar, criar, atualizar, deletar };
