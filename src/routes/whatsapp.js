const router = require('express').Router();
const auth = require('../middleware/auth');
const { status, qr } = require('../controllers/whatsappController');

router.get('/:instancia/status', auth, status);
router.get('/:instancia/qr',     auth, qr);

module.exports = router;
