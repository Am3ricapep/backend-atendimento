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
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

app.use('/api/auth',                              authRoutes);
app.use('/api/empresas',                          empresasRoutes);
app.use('/api/empresas/:empresaId/atendentes',    atendenteRoutes);
app.use('/api/empresas/:empresaId/produtos',      produtoRoutes);
app.use('/api/conversas',                         conversasRoutes);
app.use('/api/mensagens',                         mensagemRoutes);
app.use('/api/whatsapp',                          whatsappRoutes);

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
