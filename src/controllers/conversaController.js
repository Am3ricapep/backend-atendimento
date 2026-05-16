const { Cliente, Empresa } = require('../models');
const sequelize = require('../config/database');

const assumir = async (req, res) => {
  try {
    const { conversationId } = req.params;
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
    const [rows] = await sequelize.query(
      `SELECT phone, nome, estagio, objetivo, produto_indicado, ultima_interacao FROM clientes WHERE conversation_id = :cid LIMIT 1`,
      { replacements: { cid: conversationId } }
    );
    if (!rows.length) return res.status(404).json({ error: 'Conversa não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { assumir, liberar, status };
