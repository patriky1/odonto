const router = require('express').Router();
const ctrl = require('../controllers/configuracoesController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/financeiro/status', ctrl.statusFinanceiro);
router.post('/financeiro/desbloquear', ctrl.desbloquearFinanceiro);
router.put('/financeiro/senha', ctrl.alterarSenhaFinanceira);

// Dados da empresa usados nos recibos e documentos impressos
router.get('/clinica', ctrl.dadosClinica);
router.put('/clinica', ctrl.salvarDadosClinica);

module.exports = router;
