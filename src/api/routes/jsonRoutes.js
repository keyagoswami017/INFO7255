const express = require('express');
const router = express.Router();
const verifyGoogleToken = require('../middlewares/authMiddleware');

const {
    createPlan,
    getPlan,
    deletePlan,
    patchPlan,
    searchElastic
} = require('../controllers/jsonController');

router.post('/',verifyGoogleToken, createPlan);
router.get('/:objectId', verifyGoogleToken, getPlan);
router.delete('/:objectId',verifyGoogleToken, deletePlan);
router.patch('/:objectId', verifyGoogleToken, patchPlan);
router.post('/elastic/search', verifyGoogleToken,searchElastic);

module.exports = router;