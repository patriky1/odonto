const router = require('express').Router();
const ctrl = require('../controllers/recibosController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);

router.get('/', ctrl.listar);
router.get('/pagamento/:pagamentoId', ctrl.porPagamento);
router.get('/pagamento/:pagamentoId/rascunho', ctrl.rascunhoDoPagamento);
router.get('/:id', ctrl.buscarPorId);
router.post('/', ctrl.criar);

// Cancelar mantém o número usado — só admin/dentista
router.patch('/:id/cancelar', authorize('admin', 'dentista'), ctrl.cancelar);

module.exports = router;
