const { Mensagem, Cliente, Atendente } = require('../models');
const axios = require('axios');

const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_KEY;

const temAcesso = (req, empresa_id) =>
  req.empresa.role === 'admin' || req.empresa.empresaId === empresa_id;

const listarPorCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    if (!temAcesso(req, cliente.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });

    const msgs = await Mensagem.findAll({
      where: { cliente_id: cliente.id },
      include: [{ model: Atendente, attributes: ['nome'], required: false }],
      order: [['criado_em', 'ASC']],
      limit: 200
    });
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const enviarMensagem = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    if (!temAcesso(req, cliente.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });

    const { conteudo } = req.body;
    if (!conteudo) return res.status(400).json({ error: 'conteudo obrigatório' });

    const { Empresa } = require('../models');
    const empresa = await Empresa.findByPk(cliente.empresa_id);

    // Salvar mensagem no banco
    const msg = await Mensagem.create({
      empresa_id:   cliente.empresa_id,
      cliente_id:   cliente.id,
      conteudo,
      de_cliente:   false,
      de_ia:        false,
      atendente_id: req.empresa.atendenteId || null
    });

    // Enviar via Evolution API
    if (empresa?.evolution_instance && cliente.phone) {
      await axios.post(
        `${EVO_URL}/message/sendText/${empresa.evolution_instance}`,
        { number: cliente.phone, text: conteudo },
        { headers: { apikey: EVO_KEY } }
      ).catch(() => {});
    }

    // Notificar SSE
    const { broadcast } = require('../sse');
    broadcast(cliente.empresa_id, { tipo: 'mensagem', mensagem: msg });

    res.status(201).json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { listarPorCliente, enviarMensagem };
