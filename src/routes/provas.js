const router = require('express').Router({ mergeParams: true });
const auth = require('../middleware/auth');
const c = require('../controllers/provaController');

router.get('/',       auth, c.listar);
router.post('/',      auth, c.criar);
router.patch('/:id',  auth, c.atualizar);
router.delete('/:id', auth, c.deletar);

module.exports = router;
