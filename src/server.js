const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    // Adiciona colunas novas sem recriar a tabela
    // empresas
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email TEXT`);
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS senha_hash TEXT`);
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'empresa'`);
    await sequelize.query(`UPDATE empresas SET email = 'makush42@proton.me' WHERE slug = 'admin' AND email IS NULL`);
    await sequelize.query(`UPDATE empresas SET evolution_instance = 'ATENDENTE' WHERE slug = 'america-peptideos' AND evolution_instance IS NULL`);
    // clientes
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS empresa_id INTEGER`);
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resumo_conversa TEXT`);
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ DEFAULT NOW()`);
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ia_ativa BOOLEAN DEFAULT true`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_phone_idx ON clientes(empresa_id, phone)`);
    await sequelize.query(`
      UPDATE clientes SET empresa_id = (SELECT id FROM empresas WHERE slug = 'america-peptideos' LIMIT 1)
      WHERE empresa_id IS NULL
    `);
    // atendentes
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS atendentes (
        id         SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nome       TEXT NOT NULL,
        email      TEXT NOT NULL,
        senha_hash TEXT,
        ativo      BOOLEAN DEFAULT true,
        criado_em  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // mensagens
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id           SERIAL PRIMARY KEY,
        empresa_id   INTEGER NOT NULL,
        cliente_id   INTEGER NOT NULL,
        conteudo     TEXT NOT NULL,
        de_cliente   BOOLEAN DEFAULT false,
        de_ia        BOOLEAN DEFAULT false,
        atendente_id INTEGER,
        criado_em    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // mensagens — garante colunas que podem não existir em instâncias antigas
    await sequelize.query(`ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS empresa_id INTEGER`);
    await sequelize.query(`ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS de_cliente BOOLEAN DEFAULT false`);
    await sequelize.query(`ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS de_ia BOOLEAN DEFAULT false`);
    await sequelize.query(`ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS atendente_id INTEGER`);
    // produtos
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id         SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nome       TEXT NOT NULL,
        indicacao  TEXT,
        preco      TEXT,
        preco_de   TEXT,
        dose       TEXT,
        protocolo  TEXT,
        stack      TEXT,
        upsell     TEXT,
        ativo      BOOLEAN DEFAULT true,
        ordem      INTEGER DEFAULT 0
      )
    `);
    // empresas — multi-tenant
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS prompt TEXT`);
    // produtos — script de venda por produto
    await sequelize.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS script_venda TEXT`);
    // mensagens — evolution_msg para mídia
    await sequelize.query(`ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS evolution_msg TEXT`);

    // Backfill: empresas sem prompt recebem o template padrão (com placeholders {{atendente}} e {{empresa_nome}})
    const { PROMPT_PADRAO } = require('./lib/promptPadrao');
    const [empresasSemPrompt] = await sequelize.query(
      `SELECT id FROM empresas WHERE prompt IS NULL OR prompt = ''`
    );
    if (empresasSemPrompt.length > 0) {
      await sequelize.query(
        `UPDATE empresas SET prompt = :prompt WHERE prompt IS NULL OR prompt = ''`,
        { replacements: { prompt: PROMPT_PADRAO } }
      );
      console.log(`Backfill prompt: ${empresasSemPrompt.length} empresas atualizadas`);
    }

    console.log('Postgres conectado e migrações aplicadas');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
  } catch (e) {
    console.error('Erro ao conectar Postgres:', e.message);
    process.exit(1);
  }
}

start();
