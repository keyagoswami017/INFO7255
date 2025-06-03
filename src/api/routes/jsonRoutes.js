const express = require('express');
const router = express.Router();

const {
    createPlan,
    getPlan,
    deletePlan
} = require('../controllers/jsonController');

router.post('/', createPlan);
router.get('/:objectId', getPlan);
router.delete('/:objectId', deletePlan);

module.exports = router;