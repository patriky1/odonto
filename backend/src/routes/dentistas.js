const router = require('express').Router();
const ctrl = require('../controllers/dentistasController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.listar);
router.get('/usuarios-disponiveis', ctrl.usuariosDisponiveis);
router.get('/:id', ctrl.buscarPorId);
router.get('/:id/agenda', ctrl.agenda);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
