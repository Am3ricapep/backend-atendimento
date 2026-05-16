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
    console.log('Postgres conectado e migrações aplicadas');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
  } catch (e) {
    console.error('Erro ao conectar Postgres:', e.message);
    process.exit(1);
  }
}

start();
