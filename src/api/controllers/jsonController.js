const { validateSchema } = require('../utils/schemaValidator');
const planSchema = require('../../constants/schema');
const { setData, getData, deleteData} = require('../services/redisService');
const crypto = require('crypto');

// Post
const createPlan = async (req, res) => {
    const data = req.body;

    const { valid, errors } = validateSchema(planSchema, data);

    if (!valid) {
        return res.status(400).json({ message: 'Invalid data', errors: errors});
    }
    try {
       const key = data.objectId;
       if (!key) {
           return res.status(400).json({ message: 'objectId is required' });
       }
       await setData(key, data);

       //ETag Creation
       const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('base64');
       const eTag = `"${hash}"`;
       res.setHeader('ETag', eTag);
       res.status(201).json({ message: 'Plan stored successfully', objectId: key });
    }
    catch (error) {
        console.error('Error storing data in Redis:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get
const getPlan = async (req, res) => {
    const objectId  = req.params.objectId;
    
        try{
            const data = await getData(objectId);
            if (!data) {
                return res.status(404).json({ message: 'Plan not found' });
            }
            const jsonString = JSON.stringify(data);
            const hash = crypto.createHash('md5').update(jsonString).digest('base64');
            const eTag = `"${hash}"`;

            const ifNoneMatch = req.headers['if-none-match'];
            if (ifNoneMatch && ifNoneMatch === eTag) {
                return res.status(304).end();
            }
            res.setHeader('ETag', eTag);
            res.status(200).json(data);
        } catch (error) {
            console.error('Error retrieving data from Redis:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

// Delete
const deletePlan = async (req, res) => {
    const objectId = req.params.objectId;

    try {
        const result = await deleteData(objectId);
       
        if (result === 0) {  
            return res.status(404).json({ message: 'Plan not found' });
        }
        res.status(204).json({ message: 'Plan deleted successfully', objectId });
    } catch (error) {
        console.error('Error deleting data from Redis:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Patch
const patchPlan = async (req, res) => {
    const objectId = req.params.objectId;
    const patchData = req.body;

    try {
        const existingData = await getData(objectId);
        if (!existingData) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // If-Match Etag validation
        const clientETag = req.headers['if-match'];
        const serverETag =  `"${crypto.createHash('md5').update(JSON.stringify(existingData)).digest('base64')}"`;

        if (clientETag && clientETag !== serverETag) {
            return res.status(412).json({ message: 'Precondition failed: ETag mismatch' });
        }

        // Merge existing data with patch data
        const updatedData = { ...existingData, ...patchData };
        
        // Validate the updated data
        const { valid, errors } = validateSchema(planSchema, updatedData);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid data', errors: errors });
        }

        await setData(objectId, updatedData);

        //ETag Creation
        const hash = crypto.createHash('md5').update(JSON.stringify(updatedData)).digest('base64');
        const eTag = `"${hash}"`;
        res.setHeader('ETag', eTag);
        
        res.status(200).json({ message: 'Plan updated successfully', objectId });
    } catch (error) {
        console.error('Error updating data in Redis:', error);
        res.status(500).json({ message: 'Internal server error' });
    }

};


module.exports = {
    createPlan,
    getPlan,
    deletePlan,
    patchPlan
};