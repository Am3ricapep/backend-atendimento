const router = require('express').Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { listar, criar, atualizar, deletar } = require('../controllers/produtoController');

router.get('/',     auth, listar);
router.post('/',    auth, criar);
router.put('/:id',  auth, atualizar);
router.delete('/:id', auth, deletar);

module.exports = router;
