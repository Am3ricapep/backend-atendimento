const router = require('express').Router();
const auth = require('../middleware/auth');
const { listarPorCliente, enviarMensagem, enviarMidia } = require('../controllers/mensagemController');
const { addClient, removeClient } = require('../sse');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// GET /api/mensagens/:clienteId
router.get('/:clienteId', auth, listarPorCliente);

// POST /api/mensagens/:clienteId
router.post('/:clienteId', auth, enviarMensagem);

// POST /api/mensagens/:clienteId/midia
router.post('/:clienteId/midia', auth, enviarMidia);

// SSE — GET /api/mensagens/eventos?token=...
router.get('/eventos/stream', (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).end();
    const payload = jwt.verify(token, JWT_SECRET);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ tipo: 'conectado' })}\n\n`);

    const empresa_id = payload.empresaId;
    addClient(empresa_id, res);

    req.on('close', () => removeClient(empresa_id, res));
  } catch {
    res.status(401).end();
  }
});

module.exports = router;
