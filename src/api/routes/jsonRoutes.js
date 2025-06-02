const express = require('express');
const router = express.Router();

const {
    createPlan,
    getPlan,
    deletePlan
} = require('../controllers/jsonController');
const { reportTypeError } = require('ajv/dist/compile/validate/dataType');

router.post('/', createPlan);
router.get('/:objectId', getPlan);
router.delete('/:objectId', deletePlan);

module.exports = router;