const router = require('express').Router();
const ctrl = require('../controllers/ortodontiaController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/opcoes', ctrl.opcoes);
router.get('/paciente/:pacienteId', ctrl.listar);
router.post('/paciente/:pacienteId', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.post('/detalhamentos/paciente/:pacienteId', ctrl.criarDetalhamento);
router.put('/detalhamentos/:id', ctrl.atualizarDetalhamento);
router.delete('/detalhamentos/:id', ctrl.excluirDetalhamento);
router.delete('/:id', ctrl.excluir);

module.exports = router;
