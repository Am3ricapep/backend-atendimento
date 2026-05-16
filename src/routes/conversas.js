const router = require('express').Router();
const { assumir, liberar, status } = require('../controllers/conversaController');

router.get('/:conversationId/status',  status);
router.post('/:conversationId/assumir', assumir);
router.post('/:conversationId/liberar', liberar);

module.exports = router;
