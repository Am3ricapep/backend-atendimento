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
    // Remove constraint UNIQUE legada que era apenas em phone — multi-tenant exige o mesmo phone em empresas diferentes
    await sequelize.query(`ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_phone_key`);
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

    // Backfill: empresas sem nenhum produto recebem a seed PRODUTOS_PADRAO
    const { PRODUTOS_PADRAO } = require('./lib/produtosPadrao');
    const { Produto } = require('./models');
    const [empresasSemProdutos] = await sequelize.query(
      `SELECT e.id, e.slug FROM empresas e
       WHERE NOT EXISTS (SELECT 1 FROM produtos p WHERE p.empresa_id = e.id)`
    );
    for (const emp of empresasSemProdutos) {
      const dados = PRODUTOS_PADRAO.map(p => ({ ...p, empresa_id: emp.id, ativo: true }));
      try {
        await Produto.bulkCreate(dados);
        console.log(`Backfill produtos: empresa ${emp.slug} (${emp.id}) recebeu ${dados.length} produtos da seed`);
      } catch (e) {
        console.error(`Backfill produtos: falhou em ${emp.slug}:`, e.message);
      }
    }

    // Tabela de controle pra migrations one-shot (idempotente entre restarts)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        nome        TEXT PRIMARY KEY,
        aplicada_em TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Migration one-shot: reseta produtos da América e Imperio pra seed atual
    // Faz backup em produtos_backup_pre_seed_v1 antes de apagar (recuperável se necessário)
    const MIG = 'produtos_seed_v1_america_imperio_2026_05_18';
    const [jaRodou] = await sequelize.query(
      `SELECT 1 FROM _migrations WHERE nome = :nome`,
      { replacements: { nome: MIG } }
    );
    if (jaRodou.length === 0) {
      const slugsReset = ['america-peptideos', 'imperio'];
      const [alvos] = await sequelize.query(
        `SELECT id, slug FROM empresas WHERE slug IN (:slugs)`,
        { replacements: { slugs: slugsReset } }
      );
      if (alvos.length > 0) {
        // Backup defensivo (cria tabela se não existir)
        await sequelize.query(`CREATE TABLE IF NOT EXISTS produtos_backup_pre_seed_v1 (LIKE produtos)`);
        await sequelize.query(
          `INSERT INTO produtos_backup_pre_seed_v1
           SELECT * FROM produtos WHERE empresa_id IN (:ids)`,
          { replacements: { ids: alvos.map(a => a.id) } }
        );
        // Reset
        for (const emp of alvos) {
          await sequelize.query(`DELETE FROM produtos WHERE empresa_id = :id`, { replacements: { id: emp.id } });
          const dados = PRODUTOS_PADRAO.map(p => ({ ...p, empresa_id: emp.id, ativo: true }));
          await Produto.bulkCreate(dados);
          console.log(`[${MIG}] ${emp.slug}: produtos resetados (${dados.length} produtos da seed)`);
        }
      }
      await sequelize.query(`INSERT INTO _migrations (nome) VALUES (:nome)`, { replacements: { nome: MIG } });
      console.log(`[${MIG}] aplicada`);
    }

    // Migration v2: UPDATE seed (dose + protocolo + scripts sem em-dash) na America e Imperio
    // UPDATE por nome preserva ID, criado_em e qualquer edicao feita pela dashboard em outros campos
    const MIG_V2 = 'produtos_seed_v2_dose_protocolo_sem_emdash_2026_05_18';
    const [v2Rodou] = await sequelize.query(
      `SELECT 1 FROM _migrations WHERE nome = :nome`,
      { replacements: { nome: MIG_V2 } }
    );
    if (v2Rodou.length === 0) {
      const [alvosV2] = await sequelize.query(
        `SELECT id, slug FROM empresas WHERE slug IN (:slugs)`,
        { replacements: { slugs: ['america-peptideos', 'imperio'] } }
      );
      let totalAtualizados = 0;
      for (const emp of alvosV2) {
        for (const p of PRODUTOS_PADRAO) {
          const [, meta] = await sequelize.query(
            `UPDATE produtos SET
               indicacao = :indicacao, preco = :preco, preco_de = :preco_de,
               dose = :dose, protocolo = :protocolo, stack = :stack,
               upsell = :upsell, script_venda = :script_venda
             WHERE empresa_id = :empresa_id AND nome = :nome`,
            { replacements: {
              indicacao: p.indicacao, preco: p.preco, preco_de: p.preco_de,
              dose: p.dose, protocolo: p.protocolo, stack: p.stack,
              upsell: p.upsell, script_venda: p.script_venda,
              empresa_id: emp.id, nome: p.nome
            }}
          );
          totalAtualizados += meta?.rowCount ?? 0;
        }
        console.log(`[${MIG_V2}] ${emp.slug}: produtos atualizados (dose + protocolo + scripts limpos)`);
      }
      await sequelize.query(`INSERT INTO _migrations (nome) VALUES (:nome)`, { replacements: { nome: MIG_V2 } });
      console.log(`[${MIG_V2}] aplicada, ${totalAtualizados} linhas atualizadas`);
    }

    // Migration v3: corrige Imperio (slug 'Imperio' com I maiusculo) que escapou das v1 e v2
    // V1 e v2 usavam slug IN (...) case-sensitive; usa LOWER aqui para pegar qualquer variacao
    const MIG_V3 = 'produtos_seed_v3_imperio_case_insensitive_2026_05_18';
    const [v3Rodou] = await sequelize.query(
      `SELECT 1 FROM _migrations WHERE nome = :nome`,
      { replacements: { nome: MIG_V3 } }
    );
    if (v3Rodou.length === 0) {
      const [imperioRows] = await sequelize.query(
        `SELECT id, slug FROM empresas WHERE LOWER(slug) = 'imperio' LIMIT 1`
      );
      if (imperioRows.length > 0) {
        const empId = imperioRows[0].id;
        // Backup defensivo (cria tabela se nao existir, mesma da v1)
        await sequelize.query(`CREATE TABLE IF NOT EXISTS produtos_backup_pre_seed_v1 (LIKE produtos)`);
        await sequelize.query(
          `INSERT INTO produtos_backup_pre_seed_v1
           SELECT * FROM produtos WHERE empresa_id = :id`,
          { replacements: { id: empId } }
        );
        // Reset
        await sequelize.query(`DELETE FROM produtos WHERE empresa_id = :id`, { replacements: { id: empId } });
        const dados = PRODUTOS_PADRAO.map(p => ({ ...p, empresa_id: empId, ativo: true }));
        await Produto.bulkCreate(dados);
        console.log(`[${MIG_V3}] ${imperioRows[0].slug}: produtos resetados (${dados.length} produtos da seed v2)`);
      }
      await sequelize.query(`INSERT INTO _migrations (nome) VALUES (:nome)`, { replacements: { nome: MIG_V3 } });
      console.log(`[${MIG_V3}] aplicada`);
    }

    console.log('Postgres conectado e migrações aplicadas');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
  } catch (e) {
    console.error('Erro ao conectar Postgres:', e.message);
    process.exit(1);
  }
}

start();
