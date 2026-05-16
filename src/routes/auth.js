const router = require('express').Router();
const { login, setSenha } = require('../controllers/authController');

router.post('/login',     login);
router.post('/set-senha', setSenha); // interno — definir senha inicial

module.exports = router;
