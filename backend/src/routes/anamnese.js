const router = require('express').Router();
const ctrl = require('../controllers/anamneseController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/questionario', ctrl.questionario);
router.get('/paciente/:pacienteId', ctrl.buscar);
router.put('/paciente/:pacienteId', ctrl.salvar);
router.delete('/paciente/:pacienteId', ctrl.excluir);

module.exports = router;
