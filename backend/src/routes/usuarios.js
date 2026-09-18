const router = require('express').Router();
const ctrl = require('../controllers/usuariosController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);
router.get('/', authorize('admin'), ctrl.listar);
router.get('/pedidos-senha', authorize('admin'), ctrl.pedidosSenha);
router.delete('/pedidos-senha/:id', authorize('admin'), ctrl.descartarPedidoSenha);
router.post('/', authorize('admin'), ctrl.criar);
router.put('/:id', authorize('admin'), ctrl.atualizar);
router.delete('/:id', authorize('admin'), ctrl.excluir);

module.exports = router;
