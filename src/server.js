const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('Postgres conectado e schema atualizado');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
  } catch (e) {
    console.error('Erro ao conectar Postgres:', e.message);
    process.exit(1);
  }
}

start();
