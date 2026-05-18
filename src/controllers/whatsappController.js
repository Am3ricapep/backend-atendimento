const axios = require('axios');

const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_KEY;

const evo = axios.create({
  baseURL: EVO_URL,
  headers: { apikey: EVO_KEY },
});

const status = async (req, res) => {
  try {
    const { instancia } = req.params;
    const { data } = await evo.get(`/instance/connectionState/${instancia}`);
    res.json({ instance: instancia, state: data.instance?.state || 'close' });
  } catch (e) {
    res.json({ instance: req.params.instancia, state: 'close' });
  }
};

const qr = async (req, res) => {
  try {
    const { instancia } = req.params;
    const { data } = await evo.get(`/instance/connect/${instancia}`);
    const raw = data?.base64 || data?.qrcode?.base64 || null;
    const qrcode = raw
      ? (raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`)
      : null;
    res.json({ qrcode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const criar = async (req, res) => {
  try {
    const { instancia } = req.params;
    const { data } = await evo.post('/instance/create', {
      instanceName: instancia,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
};

const desconectar = async (req, res) => {
  try {
    const { instancia } = req.params;
    await evo.delete(`/instance/logout/${instancia}`);
    return res.json({ ok: true });
  } catch (e) {
    // Idempotente: se a instancia ja esta desconectada, tratamos como sucesso
    const evoMsg = JSON.stringify(e.response?.data || '');
    if (e.response?.status === 400 && /not connected|already/i.test(evoMsg)) {
      return res.json({ ok: true, alreadyDisconnected: true });
    }
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
};

const deletar = async (req, res) => {
  try {
    const { instancia } = req.params;
    await evo.delete(`/instance/delete/${instancia}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const reiniciar = async (req, res) => {
  try {
    const { instancia } = req.params;
    await evo.post(`/instance/restart/${instancia}`);
    res.json({ ok: true });
  } catch (e) {
    // Erro real da Evolution chega como response.data — propaga para diagnostico
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
};

module.exports = { status, qr, criar, desconectar, deletar, reiniciar };
