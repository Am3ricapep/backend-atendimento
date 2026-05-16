const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const empresasRoutes   = require('./routes/empresas');
const conversasRoutes  = require('./routes/conversas');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

app.use('/api/empresas',   empresasRoutes);
app.use('/api/conversas',  conversasRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
