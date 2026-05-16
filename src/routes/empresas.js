const router = require('express').Router();
const { listar, buscar, criar, atualizar, clientes } = require('../controllers/empresaController');

router.get('/',           listar);
router.get('/:slug',      buscar);
router.post('/',          criar);
router.put('/:slug',      atualizar);
router.get('/:slug/clientes', clientes);

module.exports = router;
