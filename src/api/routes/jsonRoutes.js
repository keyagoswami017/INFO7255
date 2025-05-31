const express = require('express');
const router = express.Router();
const Ajv = require('ajv');
const planSchema = require('../../constants/schema');

const ajv = new Ajv();

const { redisClient } = require('../services/redisClient'); 

router.post('/', async (req, res) => {
    const data = req.body;

    const validate = ajv.compile(planSchema);
    const valid = validate(data);

    if (!valid) {
        return res.status(400).json({
            message: 'Invalid data',
            errors: validate.errors
        });
    }
    try {
       const key = data.objectId;
       if (!key) {
           return res.status(400).json({ message: 'objectId is required' });
       }
       await redisClient.set(key, JSON.stringify(data));
       res.status(201).json({ message: 'Data stored successfully', objectId: key });
    }
    catch (error) {
        console.error('Error storing data in Redis:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;