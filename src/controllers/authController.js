const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { Empresa } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

const login = async (req, res) => {
  try {
    const { slug, senha } = req.body;
    if (!slug || !senha) return res.status(400).json({ error: 'slug e senha obrigatórios' });

    const empresa = await Empresa.findOne({ where: { slug, ativo: true } });
    if (!empresa) return res.status(401).json({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(senha, empresa.senha_hash || '');
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { empresaId: empresa.id, slug: empresa.slug, nome: empresa.nome },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, empresa: { id: empresa.id, slug: empresa.slug, nome: empresa.nome, atendente: empresa.atendente } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const setSenha = async (req, res) => {
  try {
    const { slug, senha } = req.body;
    if (!slug || !senha) return res.status(400).json({ error: 'slug e senha obrigatórios' });

    const empresa = await Empresa.findOne({ where: { slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });

    const hash = await bcrypt.hash(senha, 10);
    await empresa.update({ senha_hash: hash });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { login, setSenha };
