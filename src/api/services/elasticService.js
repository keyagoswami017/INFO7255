const { Client } = require('@elastic/elasticsearch');

const elasticClient = new Client({ node: 'http://elasticsearch:9200' });
const PLAN_INDEX = 'plan_index';

// Create index with parent-child mapping
const createIndexIfNotExists = async () => {
  
  const exists = await elasticClient.indices.exists({ index: PLAN_INDEX });

  if (!exists) {
    await elasticClient.indices.create({
      index: PLAN_INDEX,
      body: {
        mappings: {
          properties: {
            objectId: { type: 'keyword' },
            objectType: { type: 'keyword' },
            _org: { type: 'keyword' },
            planType: { type: 'keyword' },
            name: { type: 'text' },
            creationDate: { type: 'date', format: 'dd-MM-yyyy' },
            _flattenParentId: { type: 'keyword' },
            join_field: {
              type: 'join',
              relations: {
                /*plan: ['planservice', 'membercostshare'],
                planservice: ['planserviceCostShares']*/
                plan: ['linkedPlanServices', 'planCostShares'],
                linkedPlanServices: ['planserviceCostShares', 'linkedService']
                
              }
            }
          }
        }
      }
    });
    console.log(`Index "${PLAN_INDEX}" created with parent-child mapping.`);
  }
};

// Index document with flattened parent-child logic
const indexDocument = async (doc) => {
  const { objectId, objectType, parentId, joinFieldType, _flattenParentId } = doc;

  const effectiveParentId =
    joinFieldType === 'membercostshare' && _flattenParentId
      ? _flattenParentId
      : parentId;

  const body = {
    ...doc,
    join_field: effectiveParentId
      ? { name: joinFieldType, parent: effectiveParentId } // child
      : joinFieldType // parent
  };

  await elasticClient.index({
    index: PLAN_INDEX,
    id: objectId,
    routing: effectiveParentId || objectId,
    body,
    refresh: true
  });
};

// Delete a document
const deleteDocument = async (id, routing) => {
  await elasticClient.delete({
    index: PLAN_INDEX,
    id,
    routing,
    refresh: true
  });
};

// Search documents
const searchDocuments = async (query) => {
  const result = await elasticClient.search({
    index: PLAN_INDEX,
    body: { query }
  });
  return result.body.hits.hits;
};

module.exports = {
  createIndexIfNotExists,
  indexDocument,
  deleteDocument,
  searchDocuments,
  PLAN_INDEX,
  elasticClient,
};