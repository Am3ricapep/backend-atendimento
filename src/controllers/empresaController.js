const { Empresa, Cliente } = require('../models');

const listar = async (req, res) => {
  try {
    const empresas = await Empresa.findAll({ where: { ativo: true }, order: [['criado_em', 'DESC']] });
    res.json(empresas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const buscar = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(empresa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const criar = async (req, res) => {
  try {
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
    await empresa.update(req.body);
    res.json(empresa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const clientes = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    const lista = await Cliente.findAll({
      where: { empresa_id: empresa.id },
      order: [['ultima_interacao', 'DESC']]
    });
    res.json(lista);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { listar, buscar, criar, atualizar, clientes };
