const express = require('express');
const router = express.Router();
const verifyGoogleToken = require('../middlewares/authMiddleware');

const {
    createPlan,
    getPlan,
    deletePlan,
    patchPlan
} = require('../controllers/jsonController');

router.post('/',verifyGoogleToken, createPlan);
router.get('/:objectId', verifyGoogleToken, getPlan);
router.delete('/:objectId',verifyGoogleToken, deletePlan);
router.patch('/:objectId', verifyGoogleToken, patchPlan);

module.exports = router;