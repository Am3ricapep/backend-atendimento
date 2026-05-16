// Mapa de clientes SSE: empresa_id → Set de responses
const clients = new Map();

function addClient(empresa_id, res) {
  if (!clients.has(empresa_id)) clients.set(empresa_id, new Set());
  clients.get(empresa_id).add(res);
}

function removeClient(empresa_id, res) {
  clients.get(empresa_id)?.delete(res);
}

function broadcast(empresa_id, data) {
  const set = clients.get(empresa_id);
  if (!set) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch {}
  }
}

module.exports = { addClient, removeClient, broadcast };
