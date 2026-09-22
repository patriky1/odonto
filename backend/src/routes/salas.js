const router = require('express').Router();
const ctrl = require('../controllers/salasController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);
router.get('/', ctrl.listar);
router.post('/', authorize('admin'), ctrl.criar);
router.put('/:id', authorize('admin'), ctrl.atualizar);
router.delete('/:id', authorize('admin'), ctrl.excluir);

module.exports = router;
