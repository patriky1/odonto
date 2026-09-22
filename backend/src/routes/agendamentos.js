const router = require('express').Router();
const ctrl = require('../controllers/agendamentosController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.listar);
router.get('/hoje', ctrl.hoje);
router.get('/meu-escopo', ctrl.meuEscopo);
router.get('/lembretes', ctrl.lembretes);
router.get('/:id', ctrl.buscarPorId);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.patch('/:id/status', ctrl.alterarStatus);
router.patch('/:id/lembrete', ctrl.marcarLembrete);
router.delete('/:id', ctrl.excluir);

module.exports = router;
