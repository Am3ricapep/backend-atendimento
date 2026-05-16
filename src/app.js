const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const authRoutes       = require('./routes/auth');
const empresasRoutes   = require('./routes/empresas');
const conversasRoutes  = require('./routes/conversas');
const whatsappRoutes   = require('./routes/whatsapp');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

app.use('/api/auth',       authRoutes);
app.use('/api/empresas',   empresasRoutes);
app.use('/api/conversas',  conversasRoutes);
app.use('/api/whatsapp',   whatsappRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
