const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    // Adiciona colunas novas sem recriar a tabela
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email TEXT`);
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS senha_hash TEXT`);
    await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'empresa'`);
    console.log('Postgres conectado');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
  } catch (e) {
    console.error('Erro ao conectar Postgres:', e.message);
    process.exit(1);
  }
}

start();
