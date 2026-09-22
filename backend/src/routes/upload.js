const router = require('express').Router();
const { upload } = require('../controllers/uploadController');
const auth = require('../middlewares/auth');

router.use(auth);
router.post('/', upload);

module.exports = router;
