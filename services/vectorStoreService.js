const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('../config');

const client = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey,
});

const COLLECTION = config.qdrantCollectionName;

/**
 * Ensure the Qdrant collection exists with the correct configuration.
 * Creates it if missing; no-ops if it already exists.
 */
async function ensureCollection() {
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION);
    if (!exists) {
      await client.createCollection(COLLECTION, {
        vectors: {
          size: config.embeddingDimension,
          distance: 'Cosine',
        },
        // Create payload indexes for efficient filtered operations
        optimizers_config: {
          default_segment_number: 1,
        },
      });

      // Create indexes on sessionId and documentId for fast filtered queries/deletes
      await client.createPayloadIndex(COLLECTION, {
        field_name: 'sessionId',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(COLLECTION, {
        field_name: 'documentId',
        field_schema: 'keyword',
      });

      console.log(`[Qdrant] Created collection "${COLLECTION}" with payload indexes.`);
    } else {
      console.log(`[Qdrant] Collection "${COLLECTION}" already exists.`);
    }
  } catch (error) {
    const err = new Error(`Failed to connect to Qdrant: ${error.message}`);
    err.type = 'VECTOR_STORE_ERROR';
    err.statusCode = 503;
    throw err;
  }
}

/**
 * Upsert vector points into the collection.
 * @param {Array<{id: string, vector: number[], payload: object}>} points
 */
async function upsertPoints(points) {
  try {
    await client.upsert(COLLECTION, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  } catch (error) {
    const isQuotaError =
      error.message &&
      (error.message.toLowerCase().includes('quota') ||
        error.message.toLowerCase().includes('full') ||
        error.message.toLowerCase().includes('limit'));

    const err = new Error(
      isQuotaError
        ? 'Vector store storage limit reached. Please remove some documents and try again.'
        : `Failed to store document vectors: ${error.message}`
    );
    err.type = 'VECTOR_STORE_ERROR';
    err.statusCode = isQuotaError ? 507 : 502;
    throw err;
  }
}

/**
 * Search for similar vectors filtered by sessionId.
 * @param {number[]} queryVector - The query embedding
 * @param {string} sessionId - Session to scope the search
 * @param {number} limit - Number of results to return
 * @returns {Array<{id: string, score: number, payload: object}>}
 */
async function searchSimilar(queryVector, sessionId, limit = config.retrievalK) {
  try {
    const results = await client.query(COLLECTION, {
      query: queryVector,
      limit,
      filter: {
        must: [{ key: 'sessionId', match: { value: sessionId } }],
      },
      with_payload: true,
    });
    return results.points;
  } catch (error) {
    const err = new Error(`Vector search failed: ${error.message}`);
    err.type = 'VECTOR_STORE_ERROR';
    err.statusCode = 502;
    throw err;
  }
}

/**
 * Delete all vectors for a specific document in a session.
 * Uses metadata-filtered delete (no need to track individual point IDs).
 */
async function deleteByDocument(sessionId, documentId) {
  try {
    await client.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [
          { key: 'sessionId', match: { value: sessionId } },
          { key: 'documentId', match: { value: documentId } },
        ],
      },
    });
  } catch (error) {
    const err = new Error(`Failed to delete document vectors: ${error.message}`);
    err.type = 'VECTOR_STORE_ERROR';
    err.statusCode = 502;
    throw err;
  }
}

/**
 * Delete all vectors for an entire session.
 * Used during session cleanup.
 */
async function deleteBySession(sessionId) {
  try {
    await client.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: 'sessionId', match: { value: sessionId } }],
      },
    });
  } catch (error) {
    // Log but don't throw — cleanup errors shouldn't crash the server
    console.error(`[Qdrant] Failed to cleanup session ${sessionId}: ${error.message}`);
  }
}

/**
 * Count vectors for a session (used to check if documents exist).
 */
async function countBySession(sessionId) {
  try {
    const result = await client.count(COLLECTION, {
      filter: {
        must: [{ key: 'sessionId', match: { value: sessionId } }],
      },
      exact: true,
    });
    return result.count;
  } catch (error) {
    const err = new Error(`Vector store query failed: ${error.message}`);
    err.type = 'VECTOR_STORE_ERROR';
    err.statusCode = 502;
    throw err;
  }
}

module.exports = {
  ensureCollection,
  upsertPoints,
  searchSimilar,
  deleteByDocument,
  deleteBySession,
  countBySession,
};
