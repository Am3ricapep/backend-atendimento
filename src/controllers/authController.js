const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { Empresa } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

const login = async (req, res) => {
  try {
    const { slug, senha } = req.body;
    if (!slug || !senha) return res.status(400).json({ error: 'email e senha obrigatórios' });

    const { Op } = require('sequelize');
    const empresa = await Empresa.findOne({
      where: { ativo: true, [Op.or]: [{ slug }, { email: slug }] }
    });
    if (!empresa) return res.status(401).json({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(senha, empresa.senha_hash || '');
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { empresaId: empresa.id, slug: empresa.slug, nome: empresa.nome, role: empresa.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      role: empresa.role,
      empresa: {
        id: empresa.id,
        slug: empresa.slug,
        nome: empresa.nome,
        atendente: empresa.atendente,
        role: empresa.role,
        evolution_instance: empresa.evolution_instance || '',
      },
    });
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

const sequelize = require('../config/database');

// Cria o admin inicial — só funciona se ainda não existe nenhum admin
const setup = async (req, res) => {
  try {
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ error: 'senha obrigatória' });

    // Garante que as colunas existem
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email TEXT`);
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS senha_hash TEXT`);
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'empresa'`);

    const [rows] = await sequelize.query(`SELECT id FROM empresas WHERE role = 'admin' LIMIT 1`);
    if (rows.length) return res.status(409).json({ error: 'Admin já existe' });

    const hash = await bcrypt.hash(senha, 10);
    await sequelize.query(
      `INSERT INTO empresas (slug, nome, email, role, ativo, senha_hash) VALUES ('admin', 'Admin Geral', 'makush42@proton.me', 'admin', true, :hash)`,
      { replacements: { hash } }
    );

    // Atualiza email se o admin já existia sem email
    await sequelize.query(
      `UPDATE empresas SET email = 'makush42@proton.me' WHERE slug = 'admin' AND (email IS NULL OR email = '')`
    );

    res.status(201).json({ ok: true, slug: 'admin' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { login, setSenha, setup };
