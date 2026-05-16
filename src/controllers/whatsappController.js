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
    const base64 = data?.base64 || data?.qrcode?.base64 || null;
    res.json({ qrcode: base64 ? `data:image/png;base64,${base64}` : null });
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
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
};

module.exports = { status, qr, criar, desconectar, deletar, reiniciar };
