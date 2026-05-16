const sequelize = require('../config/database');

const isAdmin = (req) => req.empresa.role === 'admin';

async function verificarAcesso(req, conversationId) {
  const [rows] = await sequelize.query(
    `SELECT empresa_id FROM clientes WHERE conversation_id = :cid LIMIT 1`,
    { replacements: { cid: conversationId } }
  );
  if (!rows.length) return { ok: false, status: 404, error: 'Conversa não encontrada' };
  if (!isAdmin(req) && rows[0].empresa_id !== req.empresa.empresaId)
    return { ok: false, status: 403, error: 'Acesso negado' };
  return { ok: true };
}

const assumir = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const acesso = await verificarAcesso(req, conversationId);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.error });

    await sequelize.query(
      `UPDATE clientes SET estagio = 'humano' WHERE conversation_id = :cid`,
      { replacements: { cid: conversationId } }
    );
    res.json({ ok: true, estagio: 'humano', conversationId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const liberar = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const acesso = await verificarAcesso(req, conversationId);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.error });

    await sequelize.query(
      `UPDATE clientes SET estagio = 'qualificacao' WHERE conversation_id = :cid`,
      { replacements: { cid: conversationId } }
    );
    res.json({ ok: true, estagio: 'qualificacao', conversationId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const status = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const acesso = await verificarAcesso(req, conversationId);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.error });

    const [rows] = await sequelize.query(
      `SELECT phone, nome, estagio, objetivo, produto_indicado, ultima_interacao FROM clientes WHERE conversation_id = :cid LIMIT 1`,
      { replacements: { cid: conversationId } }
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { assumir, liberar, status };
