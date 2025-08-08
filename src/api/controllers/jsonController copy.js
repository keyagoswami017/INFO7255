const { validateSchema } = require('../utils/schemaValidator');
const planSchema = require('../../constants/schema');
const { setData, getData, deleteData } = require('../services/redisService');
const crypto = require('crypto');
const {
    indexDocument,
    deleteDocument,
    searchDocuments,
    PLAN_INDEX,
    elasticClient
} = require('../services/elasticService');
const { sendToQueue } = require('../services/rabbitmqService');
const { _ } = require('ajv');


// Helper function to recursively index plan and children
const indexAll = async (doc, parentId = null) => {
  const { objectId, objectType, linkedPlanServices = [], planCostShares } = doc;

  // rootPlanId = top-level plan id to flatten membercostshare parent

  // Index parent (plan or planservice)
  await indexDocument(PLAN_INDEX, objectId{
    ...doc,
    joinFieldType: objectType,
    parentId,
  });

  // For planCostShares, membercostshare child of plan
  if (planCostShares) {
    await indexDocument({
      ...planCostShares,
      joinFieldType: 'membercostshare',
      parentId: objectId, // direct child of plan
      _flattenParentId: objectId, // flatten parent to plan id
    });
  }

  for (const service of linkedPlanServices) {
    // index planservice as child of plan
    await indexDocument({
      ...service,
      joinFieldType: 'planservice',
      parentId: objectId,
    });

    // index linkedService - treat as normal doc, no join field assumed
    if (service.linkedService && service.linkedService.objectId) {
      await elasticClient.index({
            index: INDEX_NAME,
            id: service.linkedService.objectId,
            body: {
                 ...service.linkedService,
                // ⚠️ No join_field here — it's not part of the parent-child mapping
        },
        refresh: true,
     });
    }

    // index planserviceCostShares as membercostshare, child of plan (flattened)
    if (service.planserviceCostShares) {
      await indexDocument({
        ...service.planserviceCostShares,
        joinFieldType: 'membercostshare',
        parentId: objectId, // flatten parent to plan id here!
        _flattenParentId: objectId, // flatten parent to plan id
      });
    }
  }
};


// POST /plans
const createPlan = async (req, res) => {
    const data = req.body;
    const { valid, errors } = validateSchema(planSchema, data);

    if (!valid) {
        return res.status(400).json({ message: 'Invalid data', errors });
    }

    try {
        const key = data.objectId;
        if (!key) {
            return res.status(400).json({ message: 'objectId is required' });
        }

        await setData(key, data);
        await indexAll(data);
        await sendToQueue({
                event: 'PLAN_CREATED',
                objectId: key,
                data
            });
        const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('base64');
        const eTag = `"${hash}"`;
        res.setHeader('ETag', eTag);
        res.status(201).json({ message: 'Plan stored successfully', objectId: key });
    } catch (error) {
        console.error('Error storing data in Redis or indexing in Elasticsearch:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /plans/:objectId
const getPlan = async (req, res) => {
    const objectId = req.params.objectId;

    try {
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

// DELETE /plans/:objectId
const deletePlan = async (req, res) => {
    const objectId = req.params.objectId;

    try {
        const existingData = await getData(objectId);
        if (!existingData) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Delete from Redis
        const result = await deleteData(objectId);

        // Delete from Elasticsearch (just the parent for now)
        await deleteDocument(objectId, objectId);
        await sendToQueue({
            event: 'PLAN_DELETED',
            objectId
        });

        res.status(204).json({ message: 'Plan deleted successfully', objectId });
    } catch (error) {
        console.error('Error deleting data from Redis or Elasticsearch:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// PATCH /plans/:objectId
const patchPlan = async (req, res) => {
    const objectId = req.params.objectId;
    const patchData = req.body;

    try {
        const existingData = await getData(objectId);
        if (!existingData) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const clientETag = req.headers['if-match'];
        const serverETag = `"${crypto.createHash('md5').update(JSON.stringify(existingData)).digest('base64')}"`;

        if (clientETag && clientETag !== serverETag) {
            return res.status(412).json({ message: 'Precondition failed: ETag mismatch' });
        }

        const updatedData = { ...existingData, ...patchData };
        const { valid, errors } = validateSchema(planSchema, updatedData);

        if (!valid) {
            return res.status(400).json({ message: 'Invalid data', errors });
        }

        await setData(objectId, updatedData);
        await indexAll(updatedData);
        await sendToQueue({
            event: 'PLAN_UPDATED',
            objectId,
            data: updatedData
        });


        const hash = crypto.createHash('md5').update(JSON.stringify(updatedData)).digest('base64');
        const eTag = `"${hash}"`;
        res.setHeader('ETag', eTag);
        res.status(200).json({ message: 'Plan updated successfully', objectId });
    } catch (error) {
        console.error('Error updating data in Redis or Elasticsearch:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /elastic/search
const searchElastic = async (req, res) => {
    const query = req.body?.query;

    if (!query) {
        return res.status(400).json({ message: 'Missing query in request body' });
    }

    try {
        const results = await searchDocuments(query);
        res.status(200).json({
            message: 'Search successful',
            results
        });
    } catch (error) {
        console.error('Error executing Elasticsearch search:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


module.exports = {
    createPlan,
    getPlan,
    deletePlan,
    patchPlan,
    searchElastic
};
