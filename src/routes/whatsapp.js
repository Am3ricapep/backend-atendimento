const router = require('express').Router();
const auth = require('../middleware/auth');
const { status, qr, criar, desconectar, deletar, reiniciar } = require('../controllers/whatsappController');

router.get('/:instancia/status',      auth, status);
router.get('/:instancia/qr',          auth, qr);
router.post('/:instancia/criar',      auth, criar);
router.post('/:instancia/desconectar',auth, desconectar);
router.delete('/:instancia',          auth, deletar);
router.post('/:instancia/reiniciar',  auth, reiniciar);

module.exports = router;
