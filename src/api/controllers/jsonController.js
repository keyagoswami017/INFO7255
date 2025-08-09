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
  const { objectId, linkedPlanServices = [], planCostShares } = doc;

  // parent: plan
  await indexDocument({
    ...doc,
    joinFieldType: 'plan',
    parentId
  });

  // child of plan: planCostShares
  if (planCostShares) {
    await indexDocument({
      ...planCostShares,
      joinFieldType: 'planCostShares', // matches mapping
      parentId: objectId
    });
  }

  // child of plan: linkedPlanServices
  for (const service of linkedPlanServices) {
    await indexDocument({
      ...service,
      joinFieldType: 'linkedPlanServices', // matches mapping
      parentId: objectId
    });

    // child of linkedPlanServices: linkedService
    if (service.linkedService?.objectId) {
      await indexDocument({
        ...service.linkedService,
        joinFieldType: 'linkedService', // matches mapping
        parentId: service.objectId
      });
    }

    // child of linkedPlanServices: planserviceCostShares
    if (service.planserviceCostShares) {
      await indexDocument({
        ...service.planserviceCostShares,
        joinFieldType: 'planserviceCostShares', // matches mapping
        parentId: service.objectId
      });
    }
  }
};

// POST /plans
const createPlan = async (req, res) => {
    console.log('🔧 [POST] /plans triggered');
    const data = req.body;
    const { valid, errors } = validateSchema(planSchema, data);

    if (!valid) {
        return res.status(400).json({ message: 'Invalid data', errors });
    }

    try {
        const key = `plan : ${data.objectId}`;
        if (!data.objectId) {
            return res.status(400).json({ message: 'objectId is required' });
        }

        // Store root plan
        await setData(key, data);

        // Store planCostShares
        if (data.planCostShares?.objectId) {
            await setData(
                `membercostshare : ${data.planCostShares.objectId}`,
                { ...data.planCostShares, parentId: data.objectId }
            );
        }

        // Store all linkedPlanServices
        for (const service of data.linkedPlanServices || []) {
            if (service?.objectId) {
                await setData(
                    `planservice : ${service.objectId}`,
                    { ...service, parentId: data.objectId }
                );
            }

            if (service?.linkedService?.objectId) {
                await setData(
                    `service : ${service.linkedService.objectId}`,
                    { ...service.linkedService, parentId: data.objectId }
                );
            }

            if (service?.planserviceCostShares?.objectId) {
                await setData(
                    `membercostshare : ${service.planserviceCostShares.objectId}`,
                    { ...service.planserviceCostShares, parentId: data.objectId }
                );
            }
        }

        // Index everything to Elasticsearch
        await indexAll(data);

        // Send to RabbitMQ
        await sendToQueue({
            event: 'PLAN_CREATED',
            objectId: data.objectId,
            data
        });

        const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('base64');
        const eTag = `"${hash}"`;
        await setData(`eTag : plan :${data.objectId}`, eTag);
        res.setHeader('ETag', eTag);
        res.status(201).json({ message: 'Plan stored successfully', objectId: data.objectId });
        
    } catch (error) {
        console.error('Error storing data in Redis or indexing in Elasticsearch:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /plans/:objectId
const getPlan = async (req, res) => {
    const objectId = req.params.objectId;

    try {
        const data = await getData(`plan : ${objectId}`);
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
    const existingData = await getData(`plan : ${objectId}`);
    if (!existingData) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // 1. Delete all related Redis keys
    await deleteData(`plan : ${objectId}`);

    if (existingData.planCostShares?.objectId) {
      await deleteData(`membercostshare : ${existingData.planCostShares.objectId}`);
    }

    for (const service of existingData.linkedPlanServices || []) {
      if (service?.objectId) {
        await deleteData(`planservice : ${service.objectId}`);
      }

      if (service?.linkedService?.objectId) {
        await deleteData(`service : ${service.linkedService.objectId}`);
      }

      if (service?.planserviceCostShares?.objectId) {
        await deleteData(`membercostshare : ${service.planserviceCostShares.objectId}`);
      }
    }

    // 2a. Explicitly delete all Elasticsearch documents by _id
        for (const service of existingData.linkedPlanServices || []) {
        // Delete service
        if (service?.linkedService?.objectId) {
            try {
                await deleteDocument(service.linkedService.objectId);
            } catch (err) {
                console.warn(`Service doc not found or already deleted: ${service.linkedService.objectId}`);
            }
        }

        // Delete planservice
        if (service?.objectId) {
            try {
                await deleteDocument(service.objectId, objectId);
            } catch (err) {
                console.warn(`Planservice doc not found: ${service.objectId}`);
            }
        }

        // Delete membercostshare under planservice
        if (service?.planserviceCostShares?.objectId) {
            try {
                await deleteDocument(service.planserviceCostShares.objectId, objectId);
            } catch (err) {
                console.warn(`Planservice costshare doc not found: ${service.planserviceCostShares.objectId}`);
            }
        }
        }

        // Delete root-level planCostShares
        if (existingData.planCostShares?.objectId) {
        try {
            await deleteDocument(existingData.planCostShares.objectId, objectId);
        } catch (err) {
            console.warn(`Root plan costshare doc not found: ${existingData.planCostShares.objectId}`);
        }
        }

        // Delete the root plan document
        try {
            await deleteDocument(objectId, objectId);
        } catch (err) {
            console.warn(`Plan document not found in Elasticsearch: ${objectId}`);
        }

    // 2b. Delete related Elasticsearch documents using query
       /* await elasticClient.deleteByQuery({
            index: PLAN_INDEX,
            body: {
                query: {
                bool: {
                    should: [
                    // Root plan itself
                    { ids: { values: [objectId] } },

                    // Direct children of plan (routed to planId)
                    { term: { parentId: objectId } },

                    // Grandchildren (routed to linkedPlanServices IDs) whose parent belongs to this plan
                    {
                        has_parent: {
                        parent_type: 'linkedPlanServices',
                        query: { term: { parentId: objectId } }
                        }
                    }
                    ],
                    minimum_should_match: 1
                }
                }
            },
            refresh: true,
            conflicts: 'proceed'
            });*/

    const deleteQuery = {
      index: PLAN_INDEX,
      body: {
        query: {
          bool: {
            should: [
              { term: { _id: objectId } },
              { term: { parentId: objectId } },
              { term: { _flattenParentId: objectId } }
            ]
          }
        }
      },
      refresh: true
    };

    await elasticClient.deleteByQuery(deleteQuery);

    // 3. Send delete event to RabbitMQ
    await sendToQueue({
      event: 'PLAN_DELETED',
      objectId
    });
    await deleteData(`eTag : plan :${objectId}`);
    res.status(204).json({ message: 'Plan and related data deleted successfully', objectId });
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
        const existingData = await getData(`plan : ${objectId}`);
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

        // Store root plan
        await setData(`plan : ${objectId}`, updatedData);

        // Store planCostShares
        if (updatedData.planCostShares?.objectId) {
            await setData(`membercostshare : ${updatedData.planCostShares.objectId}`, {
                ...updatedData.planCostShares,
                parentId: objectId
            });
        }

        // Store all linkedPlanServices, linkedService, and planserviceCostShares
        for (const service of updatedData.linkedPlanServices || []) {
            if (service?.objectId) {
                await setData(`planservice : ${service.objectId}`, {
                    ...service,
                    parentId: objectId
                });
            }

            if (service?.linkedService?.objectId) {
                await setData(`service : ${service.linkedService.objectId}`, {
                    ...service.linkedService,
                    parentId: objectId
                });
            }

            if (service?.planserviceCostShares?.objectId) {
                await setData(`membercostshare : ${service.planserviceCostShares.objectId}`, {
                    ...service.planserviceCostShares,
                    parentId: objectId
                });
            }
        }


        // Index all documents in Elasticsearch
        await indexAll(updatedData);

        // Send update event to RabbitMQ
        await sendToQueue({
            event: 'PLAN_UPDATED',
            objectId,
            data: updatedData
        });


        const hash = crypto.createHash('md5').update(JSON.stringify(updatedData)).digest('base64');
        const eTag = `"${hash}"`;
        res.setHeader('ETag', eTag);
        res.status(200).json(updatedData);
    } catch (error) {
        console.error('Error updating data in Redis or Elasticsearch:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /elastic/search
const searchElastic = async (req, res) => {
    console.log('🔧 [DELETE] /plans/:objectId triggered');
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