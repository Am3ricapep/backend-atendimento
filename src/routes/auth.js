const router = require('express').Router();
const { login, setSenha, setup } = require('../controllers/authController');

router.post('/login',     login);
router.post('/set-senha', setSenha);
router.post('/setup',     setup);    // cria admin inicial — bloqueado se já existe

module.exports = router;
