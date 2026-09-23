const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const vectorStoreService = require('./vectorStoreService');

// In-memory session store
// Map<sessionId, { documents: Map<docId, docMeta>, chatHistory: [], lastActivity: Date, processing: Set<docId> }>
const sessions = new Map();

/**
 * Get or create a session.
 */
function getOrCreateSession(sessionId) {
  if (!sessionId) {
    sessionId = uuidv4();
  }
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      documents: new Map(),
      chatHistory: [],
      lastActivity: new Date(),
      processing: new Set(), // documentIds currently being processed
    });
  } else {
    sessions.get(sessionId).lastActivity = new Date();
  }
  return { sessionId, session: sessions.get(sessionId) };
}

/**
 * Get session (returns null if not found).
 */
function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
  return session;
}

/**
 * Add a document entry to the session.
 */
function addDocument(sessionId, documentId, documentName, chunkCount) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.documents.set(documentId, {
    documentId,
    documentName,
    chunkCount,
    uploadedAt: new Date().toISOString(),
  });
  session.lastActivity = new Date();
}

/**
 * Remove a document entry from the session.
 */
function removeDocument(sessionId, documentId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  const doc = session.documents.get(documentId);
  if (!doc) return false;
  
  const docName = doc.documentName;
  const removed = session.documents.delete(documentId);
  
  // Scrub chat history to forget conversations relying on the removed document
  if (removed && session.chatHistory && session.chatHistory.length > 0) {
    const newHistory = [];
    for (let i = 0; i < session.chatHistory.length; i++) {
      const msg = session.chatHistory[i];
      if (msg.role === 'assistant') {
        // Fallback to documentName for older chat messages that don't have documentId
        const usesRemovedDoc = msg.sources && msg.sources.some(s => s.documentId === documentId || s.documentName === docName);
        if (usesRemovedDoc) {
          // Remove the assistant message, and pop the preceding user question
          if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'user') {
            newHistory.pop();
          }
        } else {
          newHistory.push(msg);
        }
      } else {
        newHistory.push(msg);
      }
    }
    session.chatHistory = newHistory;
  }
  
  session.lastActivity = new Date();
  return removed;
}

/**
 * Get all documents for a session.
 */
function getDocuments(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return Array.from(session.documents.values());
}

/**
 * Check if any document is currently being processed in this session.
 */
function isProcessing(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  return session.processing.size > 0;
}

/**
 * Mark a document as being processed.
 */
function startProcessing(sessionId, documentId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.processing.add(documentId);
}

/**
 * Mark a document as done processing.
 */
function endProcessing(sessionId, documentId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.processing.delete(documentId);
}

/**
 * Add a message to chat history.
 */
function addChatMessage(sessionId, role, content, sources = null) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.chatHistory.push({
    role,
    content,
    sources,
    timestamp: new Date().toISOString(),
  });
  session.lastActivity = new Date();
}

/**
 * Get chat history for a session.
 */
function getChatHistory(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.chatHistory;
}

/**
 * Clear chat history (does NOT touch documents or vectors).
 */
function clearChatHistory(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.chatHistory = [];
  session.lastActivity = new Date();
}

/**
 * End a session: clean up vectors and remove from memory.
 */
async function endSession(sessionId) {
  if (!sessions.has(sessionId)) return;
  await vectorStoreService.deleteBySession(sessionId);
  sessions.delete(sessionId);
}

/**
 * Clean up stale sessions (inactive > timeout).
 * Called periodically by the cleanup interval.
 */
async function cleanupStaleSessions() {
  const now = Date.now();
  const timeout = config.sessionInactivityTimeout;
  let cleaned = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > timeout) {
      console.log(`[Session] Cleaning up stale session: ${sessionId}`);
      await vectorStoreService.deleteBySession(sessionId);
      sessions.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Session] Cleaned up ${cleaned} stale session(s).`);
  }
}

/**
 * Get count of active sessions (for health/debug).
 */
function getActiveSessionCount() {
  return sessions.size;
}

module.exports = {
  getOrCreateSession,
  getSession,
  addDocument,
  removeDocument,
  getDocuments,
  isProcessing,
  startProcessing,
  endProcessing,
  addChatMessage,
  getChatHistory,
  clearChatHistory,
  endSession,
  cleanupStaleSessions,
  getActiveSessionCount,
};
