const { Prova, Empresa } = require('../models');
const cloudinary = require('../lib/cloudinary');

const isAdmin   = r => r.empresa.role === 'admin';
const temAcesso = (r, empresa_id) => isAdmin(r) || r.empresa.empresaId === empresa_id;

// Aceita tanto :empresaId (numero) quanto :slug (string) na rota
async function resolveEmpresaId(req) {
  if (req.params.empresaId) return parseInt(req.params.empresaId);
  if (req.params.slug) {
    const e = await Empresa.findOne({ where: { slug: req.params.slug } });
    return e ? e.id : null;
  }
  return null;
}

const listar = async (req, res) => {
  try {
    const empresa_id = await resolveEmpresaId(req);
    if (!empresa_id) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!temAcesso(req, empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    const where = { empresa_id };
    if (req.query.tipo) where.tipo = req.query.tipo;
    const lista = await Prova.findAll({ where, order: [['criado_em', 'DESC']] });
    res.json(lista);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const criar = async (req, res) => {
  try {
    const empresa_id = await resolveEmpresaId(req);
    if (!empresa_id) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!temAcesso(req, empresa_id)) return res.status(403).json({ error: 'Acesso negado' });

    const { tipo, produto_id, titulo, descricao, base64, mimetype } = req.body;
    if (!['social', 'certificado'].includes(tipo)) return res.status(400).json({ error: 'tipo invalido' });
    if (!titulo)   return res.status(400).json({ error: 'titulo obrigatorio' });
    if (!base64)   return res.status(400).json({ error: 'base64 obrigatorio' });
    if (!mimetype) return res.status(400).json({ error: 'mimetype obrigatorio' });

    const empresa = await Empresa.findByPk(empresa_id);
    const empresaSlug = empresa ? empresa.slug : `empresa-${empresa_id}`;

    let upload;
    try {
      upload = await cloudinary.uploadFromBase64({ base64, mimetype, empresaSlug, tipo });
    } catch (e) {
      console.error('[provaController.criar] Cloudinary upload falhou:', e.message);
      return res.status(500).json({ error: 'Falha no upload para Cloudinary: ' + e.message });
    }

    const prova = await Prova.create({
      empresa_id,
      tipo,
      produto_id: produto_id || null,
      titulo,
      descricao: descricao || null,
      cloudinary_public_id:     upload.public_id,
      cloudinary_url:           upload.url,
      cloudinary_resource_type: upload.resource_type,
    });
    res.status(201).json(prova);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const atualizar = async (req, res) => {
  try {
    const prova = await Prova.findByPk(req.params.id);
    if (!prova) return res.status(404).json({ error: 'Prova não encontrada' });
    if (!temAcesso(req, prova.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    // Whitelist: nao deixamos sobrescrever cloudinary_* aqui (so via upload novo)
    const allowed = ['titulo', 'descricao', 'produto_id', 'tipo', 'ativo'];
    const body = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (body.tipo && !['social', 'certificado'].includes(body.tipo)) {
      return res.status(400).json({ error: 'tipo invalido' });
    }
    await prova.update(body);
    res.json(prova);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const deletar = async (req, res) => {
  try {
    const prova = await Prova.findByPk(req.params.id);
    if (!prova) return res.status(404).json({ error: 'Prova não encontrada' });
    if (!temAcesso(req, prova.empresa_id)) return res.status(403).json({ error: 'Acesso negado' });
    // Remove tambem do Cloudinary (evita arquivo orfao pagando armazenamento)
    try {
      await cloudinary.destroy(prova.cloudinary_public_id, prova.cloudinary_resource_type);
    } catch (e) {
      console.error('[provaController.deletar] Cloudinary destroy falhou:', e.message);
      // Segue mesmo assim — o registro no banco vai sumir
    }
    await prova.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { listar, criar, atualizar, deletar };
