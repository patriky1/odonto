const router = require('express').Router();
const ctrl = require('../controllers/tratamentosController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscarPorId);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
