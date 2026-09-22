const router = require('express').Router();
const ctrl = require('../controllers/odontogramaController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/constantes', ctrl.constantes);

// Compatibilidade: aceita POST /odontograma com pacienteId no corpo
router.post('/', ctrl.salvar);

router.get('/paciente/:pacienteId', ctrl.buscarPorPaciente);
router.get('/paciente/:pacienteId/historico', ctrl.historico);
router.post('/paciente/:pacienteId', ctrl.salvar);
router.post('/paciente/:pacienteId/lote', ctrl.salvarLote);
router.put('/paciente/:pacienteId/ficha', ctrl.salvarFicha);
router.delete('/paciente/:pacienteId/dente/:numeroDente', ctrl.excluir);
router.delete('/paciente/:pacienteId', ctrl.limpar);

module.exports = router;
