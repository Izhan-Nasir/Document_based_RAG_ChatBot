const { v4: uuidv4 } = require('uuid');
const { parseFile } = require('../utils/fileParser');
const { chunkText } = require('../utils/chunker');
const { embedTexts } = require('./embeddingService');
const vectorStoreService = require('./vectorStoreService');
const sessionService = require('./sessionService');

/**
 * Process an uploaded document: parse → chunk → embed → store in Qdrant.
 *
 * @param {string} sessionId - The session this document belongs to
 * @param {Buffer} fileBuffer - The uploaded file's buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<{documentId: string, documentName: string, chunkCount: number}>}
 */
async function processDocument(sessionId, fileBuffer, originalName, mimeType) {
  const documentId = uuidv4();

  // Mark as processing to block chat queries during embedding
  sessionService.startProcessing(sessionId, documentId);

  try {
    // 1. Parse the file to extract text
    const text = await parseFile(fileBuffer, originalName, mimeType);

    // 2. Chunk the text
    const chunks = await chunkText(text);

    if (chunks.length === 0) {
      const err = new Error('No text content could be extracted from this file.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    // 3. Embed all chunks (batch call to Gemini)
    // Process in batches of 20 to avoid overwhelming the API
    const BATCH_SIZE = 20;
    const allEmbeddings = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await embedTexts(batch);
      allEmbeddings.push(...batchEmbeddings);
    }

    // 4. Build vector points with metadata
    const points = chunks.map((chunk, index) => ({
      id: uuidv4(),
      vector: allEmbeddings[index],
      payload: {
        sessionId,
        documentId,
        documentName: originalName,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
        text: chunk,
      },
    }));

    // 5. Upsert into Qdrant (in batches of 50 to avoid payload limits)
    const UPSERT_BATCH = 50;
    for (let i = 0; i < points.length; i += UPSERT_BATCH) {
      await vectorStoreService.upsertPoints(points.slice(i, i + UPSERT_BATCH));
    }

    // 6. Register document in session state
    sessionService.addDocument(sessionId, documentId, originalName, chunks.length);

    return {
      documentId,
      documentName: originalName,
      chunkCount: chunks.length,
    };
  } finally {
    // Always unmark processing, even on error
    sessionService.endProcessing(sessionId, documentId);
  }
}

/**
 * Remove a document: delete vectors from Qdrant and remove from session.
 */
async function removeDocument(sessionId, documentId) {
  // Delete vectors from Qdrant first (the critical step)
  await vectorStoreService.deleteByDocument(sessionId, documentId);
  // Then remove from session state
  const removed = sessionService.removeDocument(sessionId, documentId);
  return removed;
}

module.exports = { processDocument, removeDocument };
