const router = require('express').Router();
const ctrl = require('../controllers/pacientesController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.listar);
router.get('/aniversariantes', ctrl.aniversariantes);
router.get('/:id', ctrl.buscarPorId);
router.get('/:id/historico', ctrl.historico);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.put('/:id/foto', ctrl.atualizarFoto);
router.delete('/:id', ctrl.excluir);

module.exports = router;
