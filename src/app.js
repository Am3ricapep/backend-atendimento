const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const authRoutes       = require('./routes/auth');
const empresasRoutes   = require('./routes/empresas');
const conversasRoutes  = require('./routes/conversas');
const whatsappRoutes   = require('./routes/whatsapp');
const atendenteRoutes  = require('./routes/atendentes');
const produtoRoutes    = require('./routes/produtos');
const mensagemRoutes   = require('./routes/mensagens');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// Endpoint temporario para migrations e diagnostico
app.get('/api/migrate', async (req, res) => {
  if (req.query.key !== (process.env.WEBHOOK_SECRET || 'n8n-webhook-secret')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { sequelize } = require('./models');
  const results = [];
  const q = async (sql, label) => {
    try {
      const [rows] = await sequelize.query(sql);
      results.push({ ok: true, label: label || sql.slice(0, 60), rows });
    } catch (e) {
      results.push({ ok: false, label: label || sql.slice(0, 60), error: e.message });
    }
  };

  // Inspecionar schema real das tabelas
  await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='mensagens' ORDER BY ordinal_position`, 'schema:mensagens');
  await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='clientes' ORDER BY ordinal_position`, 'schema:clientes');

  // Migrations
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS empresa_id INTEGER');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS cliente_id INTEGER');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS conteudo TEXT');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS de_cliente BOOLEAN DEFAULT false');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS de_ia BOOLEAN DEFAULT false');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS atendente_id INTEGER');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW()');
  await q('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ia_ativa BOOLEAN DEFAULT true');
  await q('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resumo_conversa TEXT');
  await q('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ DEFAULT NOW()');
  await q('CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_phone_idx ON clientes(empresa_id, phone)');
  // Multi-tenant: phone unico apenas por empresa (constraint legada era so em phone)
  await q('ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_phone_key', 'drop:clientes_phone_key');
  // Colunas legadas do Chatwoot tinham NOT NULL — remover para compatibilidade
  await q('ALTER TABLE mensagens ALTER COLUMN phone DROP NOT NULL');
  await q('ALTER TABLE mensagens ALTER COLUMN role DROP NOT NULL');
  await q('ALTER TABLE mensagens ALTER COLUMN content DROP NOT NULL');
  await q('ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS evolution_msg TEXT');

  // Schema atualizado
  await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='mensagens' ORDER BY ordinal_position`, 'schema:mensagens:depois');

  res.json({ done: true, results });
});

// Endpoint de diagnostico read-only: migrations aplicadas + amostra de produtos
const WEBHOOK_KEY = process.env.WEBHOOK_SECRET || 'n8n-webhook-secret';
app.get('/api/_debug/migrations', async (req, res) => {
  if (req.query.key !== WEBHOOK_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const { sequelize } = require('./models');
  const out = {};
  const safeSelect = async (sql, label) => {
    try { const [rows] = await sequelize.query(sql); out[label] = rows; }
    catch (e) { out[label] = { error: e.message }; }
  };
  await safeSelect(`SELECT nome, aplicada_em FROM _migrations ORDER BY aplicada_em`, 'migrations');
  await safeSelect(`SELECT id, slug, nome FROM empresas ORDER BY id`, 'empresas');
  await safeSelect(
    `SELECT p.id, e.slug AS empresa, p.nome, LEFT(p.indicacao, 80) AS indicacao_prev, p.dose, p.protocolo
     FROM produtos p
     JOIN empresas e ON e.id = p.empresa_id
     WHERE e.slug IN ('america-peptideos', 'imperio')
     ORDER BY e.slug, p.ordem`,
    'produtos_america_imperio'
  );
  res.json(out);
});

app.use('/api/auth',                              authRoutes);
app.use('/api/empresas',                          empresasRoutes);
app.use('/api/empresas/:empresaId/atendentes',    atendenteRoutes);
app.use('/api/empresas/:empresaId/produtos',      produtoRoutes);
app.use('/api/conversas',                         conversasRoutes);
app.use('/api/mensagens',                         mensagemRoutes);
app.use('/api/whatsapp',                          whatsappRoutes);

// Webhook interno — chamado pelo n8n para salvar mensagem + broadcast SSE
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'n8n-webhook-secret';
app.post('/api/webhook/mensagem', async (req, res) => {
  try {
    if (req.headers['x-webhook-key'] !== WEBHOOK_SECRET) return res.status(401).end();
    const { empresa_id, cliente_id, conteudo, de_cliente, de_ia } = req.body;
    const { Mensagem } = require('./models');
    const { broadcast } = require('./sse');
    const msg = await Mensagem.create({ empresa_id, cliente_id, conteudo, de_cliente: !!de_cliente, de_ia: !!de_ia });
    broadcast(empresa_id, { tipo: 'mensagem', mensagem: msg });
    res.json({ ok: true, mensagem: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook — toggle ia_ativa por cliente (chamado pelo n8n ou dashboard)
app.patch('/api/webhook/cliente/:id/ia', async (req, res) => {
  try {
    if (req.headers['x-webhook-key'] !== WEBHOOK_SECRET) return res.status(401).end();
    const { Cliente } = require('./models');
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    await cliente.update({ ia_ativa: req.body.ia_ativa });
    res.json({ ok: true, ia_ativa: cliente.ia_ativa });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export CSV
app.get('/api/empresas/:slug/export.csv', require('./middleware/auth'), async (req, res) => {
  try {
    const { Cliente } = require('./models');
    const { Empresa } = require('./models');
    const empresa = await Empresa.findOne({ where: { slug: req.params.slug } });
    if (!empresa) return res.status(404).end();
    if (req.empresa.role !== 'admin' && req.empresa.empresaId !== empresa.id)
      return res.status(403).end();

    const clientes = await Cliente.findAll({
      where: { empresa_id: empresa.id },
      order: [['data_entrada', 'DESC']]
    });

    const header = 'phone,nome,estagio,objetivo,produto_indicado,ultima_interacao,data_entrada';
    const rows = clientes.map(c => [
      c.phone, c.nome, c.estagio, c.objetivo, c.produto_indicado,
      c.ultima_interacao, c.data_entrada
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${empresa.slug}-leads.csv"`);
    res.send('﻿' + [header, ...rows].join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
