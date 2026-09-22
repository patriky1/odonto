const router = require('express').Router();
const ctrl = require('../controllers/prontuariosController');
const auth = require('../middlewares/auth');

router.use(auth);
// Prontuário automático (montado a partir dos registros do sistema)
router.get('/pacientes', ctrl.listarPacientes);
router.get('/paciente/:pacienteId', ctrl.automatico);
// Anotações clínicas manuais
router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscarPorId);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
