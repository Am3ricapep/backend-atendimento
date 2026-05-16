const router = require('express').Router();
const auth = require('../middleware/auth');
const { listar, buscar, criar, atualizar, toggleAtivo, deletar, clientes } = require('../controllers/empresaController');

router.get('/',                    auth, listar);
router.get('/:slug',               auth, buscar);
router.post('/',                   auth, criar);
router.put('/:slug',               auth, atualizar);
router.patch('/:slug/toggle-ativo',auth, toggleAtivo);
router.delete('/:slug',            auth, deletar);
router.get('/:slug/clientes',             auth, clientes);
router.patch('/:slug/clientes/:clienteId', auth, require('../controllers/empresaController').atualizarCliente);

module.exports = router;
