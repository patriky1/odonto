const router = require('express').Router();
const ctrl = require('../controllers/orcamentoController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/paciente/:pacienteId', ctrl.listar);
router.post('/paciente/:pacienteId', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
