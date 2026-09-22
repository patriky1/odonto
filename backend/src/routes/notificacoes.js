const router = require('express').Router();
const ctrl = require('../controllers/notificacoesController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.listar);
router.get('/nao-lidas', ctrl.naoLidas);
router.patch('/:id/lida', ctrl.marcarLida);
router.patch('/marcar-todas-lidas', ctrl.marcarTodasLidas);

module.exports = router;
