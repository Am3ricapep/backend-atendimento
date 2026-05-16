const { Empresa, Cliente } = require('../models');

const isAdmin = (req) => req.empresa.role === 'admin';
const owns    = (req, empresa) => empresa.id === req.empresa.empresaId;

const listar = async (req, res) => {
  try {
    const where = isAdmin(req) ? {} : { id: req.empresa.empresaId, ativo: true };
    const empresas = await Empresa.findAll({ where, order: [['criado_em', 'DESC']] });
    res.json(empresas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const buscar = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!isAdmin(req) && !owns(req, empresa)) return res.status(403).json({ error: 'Acesso negado' });
    res.json(empresa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const criar = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Apenas admin pode criar empresas' });
    const empresa = await Empresa.create(req.body);
    res.status(201).json(empresa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const atualizar = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!isAdmin(req) && !owns(req, empresa)) return res.status(403).json({ error: 'Acesso negado' });

    const body = isAdmin(req) ? req.body : { ...req.body, role: undefined, ativo: undefined };
    await empresa.update(body);
    res.json(empresa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const toggleAtivo = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Apenas admin' });
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    await empresa.update({ ativo: !empresa.ativo });
    res.json({ ok: true, ativo: empresa.ativo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const deletar = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Apenas admin' });
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    await Cliente.destroy({ where: { empresa_id: empresa.id } });
    await empresa.destroy();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const clientes = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!isAdmin(req) && !owns(req, empresa)) return res.status(403).json({ error: 'Acesso negado' });

    const lista = await Cliente.findAll({
      where: { empresa_id: empresa.id },
      order: [['ultima_interacao', 'DESC']],
    });
    res.json(lista);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { listar, buscar, criar, atualizar, toggleAtivo, deletar, clientes };
