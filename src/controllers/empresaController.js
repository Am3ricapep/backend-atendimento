const axios = require('axios');
const { Empresa, Cliente, Produto } = require('../models');
const { PROMPT_PADRAO } = require('../lib/promptPadrao');
const { PRODUTOS_PADRAO } = require('../lib/produtosPadrao');

const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_KEY;

const N8N_WEBHOOK_URL = 'https://ia-atendimento-n8n.szzpop.easypanel.host/webhook/evolution-webhook';

async function criarInstanciaEvo(slug) {
  try {
    await axios.post(`${EVO_URL}/instance/create`,
      { instanceName: slug, integration: 'WHATSAPP-BAILEYS', qrcode: true },
      { headers: { apikey: EVO_KEY } }
    );
  } catch {} // ignora se já existe (idempotente)

  // Configura webhook apontando para o n8n (schema novo da Evolution API: body aninhado em "webhook")
  // Retry porque a instância pode levar 1-2s para ficar pronta após o create
  const webhookBody = {
    webhook: {
      url: N8N_WEBHOOK_URL,
      enabled: true,
      events: ['MESSAGES_UPSERT'],
      webhookByEvents: false,
      webhookBase64: false,
    },
  };
  let webhookOk = false;
  let ultimoErro = null;
  for (let i = 0; i < 3 && !webhookOk; i++) {
    try {
      await axios.post(`${EVO_URL}/webhook/set/${slug}`, webhookBody, { headers: { apikey: EVO_KEY } });
      webhookOk = true;
    } catch (e) {
      ultimoErro = e.response?.data || e.message;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!webhookOk) {
    console.error(`[criarInstanciaEvo] Falhou ao setar webhook em ${slug}:`, ultimoErro);
  }
  return { webhookOk };
}

// Insere a seed de produtos (PRODUTOS_PADRAO) para uma nova empresa.
// Usado na criacao automatica e no backfill de empresas legadas sem produtos.
async function criarProdutosPadrao(empresaId) {
  try {
    const dados = PRODUTOS_PADRAO.map(p => ({ ...p, empresa_id: empresaId, ativo: true }));
    await Produto.bulkCreate(dados);
    console.log(`[criarProdutosPadrao] empresa ${empresaId}: ${dados.length} produtos inseridos da seed`);
    return dados.length;
  } catch (e) {
    console.error(`[criarProdutosPadrao] falhou para empresa ${empresaId}:`, e.message);
    return 0;
  }
}

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

const N8N_WORKFLOW_ID = '1GNR61bxHJJhyvqp';

const criar = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Apenas admin pode criar empresas' });
    // Slug sempre lowercase (login, queries, n8n matching) — evita problema de case-sensitivity
    const slug = (req.body.slug || '').toLowerCase().trim();
    const body = {
      ...req.body,
      slug,
      evolution_instance: req.body.evolution_instance || slug,
      n8n_workflow_id:    req.body.n8n_workflow_id    || N8N_WORKFLOW_ID,
      prompt:             req.body.prompt             || PROMPT_PADRAO,
    };
    const empresa = await Empresa.create(body);
    await criarInstanciaEvo(empresa.slug);
    await criarProdutosPadrao(empresa.id);
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

const atualizarCliente = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!isAdmin(req) && !owns(req, empresa)) return res.status(403).json({ error: 'Acesso negado' });
    const cliente = await Cliente.findOne({ where: { id: req.params.clienteId, empresa_id: empresa.id } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    const allowed = ['ia_ativa', 'estagio', 'objetivo', 'nome', 'produto_indicado'];
    const body = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    await cliente.update(body);
    res.json(cliente);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const deletarCliente = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!isAdmin(req) && !owns(req, empresa)) return res.status(403).json({ error: 'Acesso negado' });
    const cliente = await Cliente.findOne({ where: { id: req.params.clienteId, empresa_id: empresa.id } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    const { Mensagem } = require('../models');
    await Mensagem.destroy({ where: { cliente_id: cliente.id } });
    await cliente.destroy();

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { listar, buscar, criar, atualizar, toggleAtivo, deletar, clientes, atualizarCliente, deletarCliente };
