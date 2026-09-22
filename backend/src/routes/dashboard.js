const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const auth = require('../middlewares/auth');

router.use(auth);
router.get('/', ctrl.resumo);

module.exports = router;
