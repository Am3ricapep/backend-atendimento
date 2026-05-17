const { Mensagem, Cliente, Atendente, Empresa } = require('../models');
const axios = require('axios');

const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_KEY;

const temAcesso = (req, empresa_id) =>
  req.empresa.role === 'admin' || req.empresa.empresaId === empresa_id;

// Extrai texto de uma mensagem da Evolution API
function extrairTextoEvo(msg) {
  const m = msg.message || {};
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.audioMessage?.caption
    || null;
}

// Busca histórico da Evolution e normaliza para o mesmo formato do banco
async function buscarHistoricoEvo(instancia, phone, clienteId, empresaId) {
  try {
    const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    const { data } = await axios.post(
      `${EVO_URL}/chat/findMessages/${instancia}`,
      { where: { key: { remoteJid } }, limit: 200 },
      { headers: { apikey: EVO_KEY }, timeout: 8000 }
    );

    // Evolution API can return array directly or wrapped in messages.records
    let registros = [];
    if (Array.isArray(data)) {
      registros = data;
    } else if (Array.isArray(data?.messages?.records)) {
      registros = data.messages.records;
    } else if (Array.isArray(data?.records)) {
      registros = data.records;
    }

    return registros
      .map(m => {
        const texto = extrairTextoEvo(m);
        if (!texto) return null;
        const ts = m.messageTimestamp
          ? new Date(Number(m.messageTimestamp) * 1000)
          : null;
        return {
          id: `evo_${m.key?.id || Math.random()}`,
          empresa_id: empresaId,
          cliente_id: clienteId,
          conteudo: texto,
          de_cliente: !m.key?.fromMe,
          de_ia: !!m.key?.fromMe,
          atendente_id: null,
          criado_em: ts,
          _fonte: 'evolution',
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error('[buscarHistoricoEvo] erro:', e?.response?.data || e?.message);
    return [];
  }
}

const listarPorCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    if (!temAcesso(req, cliente.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });

    const [msgs, empresa] = await Promise.all([
      Mensagem.findAll({
        where: { cliente_id: cliente.id },
        include: [{ model: Atendente, attributes: ['nome'], required: false }],
        order: [['criado_em', 'ASC']],
        limit: 200,
      }),
      Empresa.findByPk(cliente.empresa_id),
    ]);

    // Mescla com histórico da Evolution se a empresa tiver instância configurada
    let resultado = msgs.map(m => m.toJSON());

    if (empresa?.evolution_instance && cliente.phone) {
      const evoMsgs = await buscarHistoricoEvo(
        empresa.evolution_instance,
        cliente.phone,
        cliente.id,
        cliente.empresa_id
      );

      // Deduplica: ignora mensagens da Evolution cujo (conteúdo + timestamp próximo) já existe no banco
      const dbKeys = new Set(
        resultado.map(m => `${m.conteudo?.trim()}__${Math.floor(new Date(m.criado_em).getTime() / 5000)}`)
      );

      const novas = evoMsgs.filter(m => {
        const key = `${m.conteudo?.trim()}__${Math.floor(new Date(m.criado_em).getTime() / 5000)}`;
        return !dbKeys.has(key);
      });

      resultado = [...resultado, ...novas];
    }

    // Ordenar por criado_em, nulos por último
    resultado.sort((a, b) => {
      if (!a.criado_em) return 1;
      if (!b.criado_em) return -1;
      return new Date(a.criado_em) - new Date(b.criado_em);
    });

    res.json(resultado);
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

const enviarMidia = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    if (!temAcesso(req, cliente.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });

    const { base64, mimetype, caption } = req.body;
    if (!base64 || !mimetype) return res.status(400).json({ error: 'base64 e mimetype são obrigatórios' });

    const empresa = await Empresa.findByPk(cliente.empresa_id);

    const mediatype = mimetype.startsWith('image/') ? 'image'
      : mimetype.startsWith('audio/') ? 'audio'
      : 'document';

    const extensao = mimetype.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `arquivo.${extensao}`;

    const conteudo = caption || (mediatype === 'image' ? '[Imagem]' : mediatype === 'audio' ? '[Áudio]' : '[Arquivo]');

    const msg = await Mensagem.create({
      empresa_id:   cliente.empresa_id,
      cliente_id:   cliente.id,
      conteudo,
      de_cliente:   false,
      de_ia:        false,
      atendente_id: req.empresa.atendenteId || null
    });

    if (empresa?.evolution_instance && cliente.phone) {
      if (mediatype === 'audio') {
        await axios.post(
          `${EVO_URL}/message/sendWhatsAppAudio/${empresa.evolution_instance}`,
          { number: cliente.phone, audio: base64, encoding: true },
          { headers: { apikey: EVO_KEY } }
        ).catch(e => console.error('[sendWhatsAppAudio]', e?.response?.data || e?.message));
      } else {
        await axios.post(
          `${EVO_URL}/message/sendMedia/${empresa.evolution_instance}`,
          { number: cliente.phone, mediatype, mimetype, caption: caption || '', fileName, media: base64 },
          { headers: { apikey: EVO_KEY } }
        ).catch(e => console.error('[sendMedia]', e?.response?.data || e?.message));
      }
    }

    const { broadcast } = require('../sse');
    broadcast(cliente.empresa_id, { tipo: 'mensagem', mensagem: msg });

    res.status(201).json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { listarPorCliente, enviarMensagem, enviarMidia };
