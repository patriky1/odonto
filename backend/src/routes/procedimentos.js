const router = require('express').Router();
const ctrl = require('../controllers/procedimentosController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.listar);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
