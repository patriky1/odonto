const router = require('express').Router();
const ctrl = require('../controllers/financeiroController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);

// Gastos da empresa são visíveis a todos, mas só admin/dentista podem lançar e apagar
const gestor = authorize('admin', 'dentista');

// Catálogo de categorias (usado pelos formulários)
router.get('/categorias', ctrl.categorias);

// Pagamentos de pacientes
router.get('/pagamentos', ctrl.listarPagamentos);
router.get('/pagamentos/:id', ctrl.buscarPagamento);
router.post('/pagamentos', ctrl.criarPagamento);
router.put('/pagamentos/:id', ctrl.atualizarPagamento);
router.patch('/pagamentos/:id/receber', ctrl.receberPagamento);
router.delete('/pagamentos/:id', gestor, ctrl.excluirPagamento);

// Receitas avulsas
router.get('/receitas', ctrl.listarReceitas);
router.post('/receitas', ctrl.criarReceita);
router.put('/receitas/:id', ctrl.atualizarReceita);
router.delete('/receitas/:id', gestor, ctrl.excluirReceita);

// Despesas — controle de gastos da empresa
router.get('/despesas', ctrl.listarDespesas);
router.get('/despesas/:id', ctrl.buscarDespesa);
router.post('/despesas', gestor, ctrl.criarDespesa);
router.post('/despesas/gerar-recorrentes', gestor, ctrl.gerarRecorrentes);
router.put('/despesas/:id', gestor, ctrl.atualizarDespesa);
router.patch('/despesas/:id/pagar', gestor, ctrl.pagarDespesa);
router.delete('/despesas/:id', gestor, ctrl.excluirDespesa);

// Relatórios
router.get('/relatorio', ctrl.relatorio);
router.get('/exportar', ctrl.exportarCSV);

module.exports = router;
