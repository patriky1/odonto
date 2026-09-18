const router = require('express').Router();
const ctrl = require('../controllers/ortodontiaController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/opcoes', ctrl.opcoes);
router.get('/paciente/:pacienteId', ctrl.listar);
router.post('/paciente/:pacienteId', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
