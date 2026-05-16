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
    res.status(500).json({ error: e.message });
  }
};

const qr = async (req, res) => {
  try {
    const { instancia } = req.params;
    const { data } = await evo.get(`/instance/connect/${instancia}`);
    const qrcode = data?.base64 || data?.qrcode?.base64 || null;
    res.json({ qrcode: qrcode ? `data:image/png;base64,${qrcode}` : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { status, qr };
