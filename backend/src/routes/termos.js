const router = require('express').Router();
const ctrl = require('../controllers/termosController');
const auth = require('../middlewares/auth');

// Termos de autorização / consentimento do paciente
router.use(auth);
router.get('/modelos', ctrl.modelos);
router.post('/previa', ctrl.previa);
router.get('/paciente/:pacienteId', ctrl.listarPorPaciente);
router.get('/:id', ctrl.buscarPorId);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.patch('/:id/assinar', ctrl.assinar);
router.patch('/:id/revogar', ctrl.revogar);
router.delete('/:id', ctrl.excluir);

module.exports = router;
