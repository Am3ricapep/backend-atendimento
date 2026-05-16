const router = require('express').Router();
const auth = require('../middleware/auth');
const { assumir, liberar, status } = require('../controllers/conversaController');

router.get('/:conversationId/status',   auth, status);
router.post('/:conversationId/assumir', auth, assumir);
router.post('/:conversationId/liberar', auth, liberar);

module.exports = router;
