const { Mensagem, Cliente, Atendente, Empresa } = require('../models');
const axios = require('axios');

const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_KEY;

const temAcesso = (req, empresa_id) =>
  req.empresa.role === 'admin' || req.empresa.empresaId === empresa_id;

// Extrai texto e tipo de mídia de uma mensagem da Evolution
function extrairInfoEvo(msg) {
  const m = msg.message || {};
  if (m.conversation)              return { texto: m.conversation,  tipo: 'text' };
  if (m.extendedTextMessage?.text) return { texto: m.extendedTextMessage.text, tipo: 'text' };
  if (m.imageMessage)              return { texto: m.imageMessage.caption || '[Imagem]', tipo: 'image' };
  if (m.audioMessage)              return { texto: '[Áudio]',  tipo: 'audio' };
  if (m.videoMessage)              return { texto: m.videoMessage.caption || '[Vídeo]', tipo: 'video' };
  if (m.documentMessage)           return { texto: m.documentMessage.fileName || '[Arquivo]', tipo: 'document' };
  return null;
}

// Busca histórico da Evolution e normaliza
async function buscarHistoricoEvo(instancia, phone, clienteId, empresaId) {
  try {
    const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    const { data } = await axios.post(
      `${EVO_URL}/chat/findMessages/${instancia}`,
      { where: { key: { remoteJid } }, limit: 200 },
      { headers: { apikey: EVO_KEY }, timeout: 8000 }
    );

    let registros = [];
    if (Array.isArray(data))                        registros = data;
    else if (Array.isArray(data?.messages?.records)) registros = data.messages.records;
    else if (Array.isArray(data?.records))           registros = data.records;

    // Filtra client-side para garantir que só aparecem mensagens deste contato
    const phoneDigits = phone.replace(/\D/g, '');

    return registros
      .filter(m => (m.key?.remoteJid || '').includes(phoneDigits))
      .map(m => {
        const info = extrairInfoEvo(m);
        if (!info) return null;
        const ts = m.messageTimestamp
          ? new Date(Number(m.messageTimestamp) * 1000)
          : null;

        const item = {
          id:          `evo_${m.key?.id || Math.random()}`,
          empresa_id:  empresaId,
          cliente_id:  clienteId,
          conteudo:    info.texto,
          de_cliente:  !m.key?.fromMe,
          de_ia:       !!m.key?.fromMe,
          atendente_id: null,
          criado_em:   ts,
          _fonte:      'evolution',
        };

        // Para mídia: anexa o objeto completo da Evolution para fetch de base64 posterior
        if (info.tipo !== 'text') {
          item._evolution_msg  = JSON.stringify({ key: m.key, message: m.message });
          item._tipo_midia     = info.tipo;
        }

        return item;
      })
      .filter(Boolean);
  } catch (e) {
    console.error('[buscarHistoricoEvo]', e?.response?.data || e?.message);
    return [];
  }
}

// ── Controllers ──────────────────────────────────────────────────────────────

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

    let resultado = msgs.map(m => {
      const json = m.toJSON();
      // Se mensagem de mídia tiver evolution_msg armazenado, expõe para o frontend
      if (json.evolution_msg) json._evolution_msg = json.evolution_msg;
      return json;
    });

    if (empresa?.evolution_instance && cliente.phone) {
      const evoMsgs = await buscarHistoricoEvo(
        empresa.evolution_instance,
        cliente.phone,
        cliente.id,
        cliente.empresa_id
      );

      const dbKeys = new Set(
        resultado.map(m => `${m.conteudo?.trim()}__${Math.floor(new Date(m.criado_em).getTime() / 5000)}`)
      );

      const novas = evoMsgs.filter(m => {
        const key = `${m.conteudo?.trim()}__${Math.floor(new Date(m.criado_em).getTime() / 5000)}`;
        return !dbKeys.has(key);
      });

      resultado = [...resultado, ...novas];
    }

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

    const empresa = await Empresa.findByPk(cliente.empresa_id);

    const msg = await Mensagem.create({
      empresa_id:   cliente.empresa_id,
      cliente_id:   cliente.id,
      conteudo,
      de_cliente:   false,
      de_ia:        false,
      atendente_id: req.empresa.atendenteId || null,
    });

    if (empresa?.evolution_instance && cliente.phone) {
      await axios.post(
        `${EVO_URL}/message/sendText/${empresa.evolution_instance}`,
        { number: cliente.phone, text: conteudo },
        { headers: { apikey: EVO_KEY } }
      ).catch(() => {});
    }

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
    const conteudo = caption || (mediatype === 'image' ? '[Imagem]' : mediatype === 'audio' ? '[Áudio]' : '[Arquivo]');

    const msg = await Mensagem.create({
      empresa_id:   cliente.empresa_id,
      cliente_id:   cliente.id,
      conteudo,
      de_cliente:   false,
      de_ia:        false,
      atendente_id: req.empresa.atendenteId || null,
    });

    let evolutionMsgJson = null;

    if (empresa?.evolution_instance && cliente.phone) {
      try {
        let evoResp;
        if (mediatype === 'audio') {
          evoResp = await axios.post(
            `${EVO_URL}/message/sendWhatsAppAudio/${empresa.evolution_instance}`,
            { number: cliente.phone, audio: base64, encoding: true },
            { headers: { apikey: EVO_KEY } }
          );
        } else {
          evoResp = await axios.post(
            `${EVO_URL}/message/sendMedia/${empresa.evolution_instance}`,
            { number: cliente.phone, mediatype, mimetype, caption: caption || '', fileName: `arquivo.${extensao}`, media: base64 },
            { headers: { apikey: EVO_KEY } }
          );
        }
        // Evolution retorna { key, message } — guarda para poder buscar mídia depois
        if (evoResp?.data?.key && evoResp?.data?.message) {
          evolutionMsgJson = JSON.stringify({ key: evoResp.data.key, message: evoResp.data.message });
          await msg.update({ evolution_msg: evolutionMsgJson });
        }
      } catch (e) {
        console.error('[enviarMidia evo]', e?.response?.data || e?.message);
      }
    }

    const { broadcast } = require('../sse');
    const msgJson = msg.toJSON();
    if (evolutionMsgJson) msgJson._evolution_msg = evolutionMsgJson;
    broadcast(cliente.empresa_id, { tipo: 'mensagem', mensagem: msgJson });

    res.status(201).json(msgJson);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Busca base64 de uma mídia direto da Evolution
const buscarMidia = async (req, res) => {
  try {
    const { instancia, evolutionMsg } = req.body;
    if (!instancia || !evolutionMsg) return res.status(400).json({ error: 'instancia e evolutionMsg são obrigatórios' });

    const parsed = typeof evolutionMsg === 'string' ? JSON.parse(evolutionMsg) : evolutionMsg;

    const { data } = await axios.post(
      `${EVO_URL}/chat/getBase64FromMediaMessage/${instancia}`,
      { message: parsed, convertToMp4: false },
      { headers: { apikey: EVO_KEY }, timeout: 30000 }
    );

    res.json({ base64: data.base64, mimetype: data.mediaType || data.mimetype || 'application/octet-stream' });
  } catch (e) {
    console.error('[buscarMidia]', e?.response?.data || e?.message);
    res.status(500).json({ error: e?.response?.data || e?.message });
  }
};

module.exports = { listarPorCliente, enviarMensagem, enviarMidia, buscarMidia };
