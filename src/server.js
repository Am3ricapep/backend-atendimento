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
    // clientes
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS empresa_id INTEGER`);
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resumo_conversa TEXT`);
    await sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ DEFAULT NOW()`);
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
    console.log('Postgres conectado e migrações aplicadas');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
  } catch (e) {
    console.error('Erro ao conectar Postgres:', e.message);
    process.exit(1);
  }
}

start();
