const router = require('express').Router();
const ctrl = require('../controllers/auditoriaController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Registro de atividades: exclusivo do administrador
router.use(auth, authorize('admin'));
router.get('/', ctrl.listar);
router.get('/opcoes', ctrl.opcoes);
router.get('/:entidade/:id', ctrl.historicoDoRegistro);

module.exports = router;
