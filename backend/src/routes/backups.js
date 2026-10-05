const router = require('express').Router();
const ctrl = require('../controllers/backupsController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Backup e restauração do banco: exclusivo do administrador
router.use(auth, authorize('admin'));
router.get('/', ctrl.listar);
router.post('/', ctrl.criar);
router.put('/configuracao', ctrl.salvarConfiguracao);
router.post('/:arquivo/restaurar', ctrl.restaurar);
router.delete('/:arquivo', ctrl.excluir);

module.exports = router;
