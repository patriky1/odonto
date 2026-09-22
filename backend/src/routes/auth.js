const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middlewares/auth');

router.post('/login', ctrl.login);
router.get('/me', auth, ctrl.me);
router.put('/alterar-senha', auth, ctrl.alterarSenha);

// Recuperação de senha (rotas públicas)
router.post('/esqueci-senha', ctrl.esqueciSenha);
router.get('/redefinir-senha/:token', ctrl.validarTokenRedefinicao);
router.post('/redefinir-senha', ctrl.redefinirSenha);

module.exports = router;
