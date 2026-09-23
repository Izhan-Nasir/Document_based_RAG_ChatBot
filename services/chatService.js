const { ChatGroq } = require('@langchain/groq');
const config = require('../config');
const { embedText } = require('./embeddingService');
const vectorStoreService = require('./vectorStoreService');
const sessionService = require('./sessionService');

// Initialize Groq chat model
const chatModel = new ChatGroq({
  apiKey: config.groqApiKey,
  model: config.groqModel,
  temperature: 0.1, // Low temperature for factual, grounded answers
  maxRetries: 2,
  maxTokens: 500, // Limit tokens to avoid hitting the 1000 OTPM strict cap
});

// System prompt that enforces grounded answering
const SYSTEM_PROMPT = `You are a helpful document assistant. You answer questions ONLY based on the document content provided below. Follow these rules strictly:

1. Answer ONLY from the provided context. Never use your own knowledge or make assumptions.
2. If the answer is not found in the provided context, say: "I couldn't find an answer to that question in the uploaded documents."
3. Do NOT name or reference the source documents in your answer. Source citations will be added automatically by the system.
4. Be concise and accurate. Quote relevant text from the context when helpful.
5. If the question is vague, provide the best answer you can from the available context.

CONTEXT FROM UPLOADED DOCUMENTS:
{context}`;

/**
 * Answer a user question using RAG.
 *
 * @param {string} sessionId - Current session
 * @param {string} question - User's question
 * @returns {Promise<{answer: string, sources: Array<{documentName: string, chunkIndex: number, totalChunks: number, excerpt: string}>}>}
 */
async function answerQuestion(sessionId, question) {
  const session = sessionService.getSession(sessionId);

  // Validate session
  if (!session) {
    const err = new Error('Session not found. Please refresh the page to start a new session.');
    err.type = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  // Check if documents are still processing
  if (sessionService.isProcessing(sessionId)) {
    const err = new Error(
      'A document is still being processed. Please wait until processing is complete before asking questions.'
    );
    err.type = 'VALIDATION_ERROR';
    err.statusCode = 409;
    throw err;
  }

  // Check if any documents are uploaded
  const documents = sessionService.getDocuments(sessionId);
  if (documents.length === 0) {
    const err = new Error(
      'No documents have been uploaded yet. Please upload a document before asking questions.'
    );
    err.type = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  // 1. Embed the question
  const queryVector = await embedText(question);

  // 2. Search for relevant chunks (scoped to this session)
  const results = await vectorStoreService.searchSimilar(
    queryVector,
    sessionId,
    config.retrievalK
  );

  // Handle case where no relevant chunks are found
  if (!results || results.length === 0) {
    return {
      answer:
        "I couldn't find any relevant information in the uploaded documents to answer your question.",
      sources: [],
    };
  }

  // 3. Build context from retrieved chunks
  const contextChunks = results.map((r) => r.payload.text);
  const context = contextChunks.join('\n\n---\n\n');

  // 4. Build the prompt with conversation history for context
  const chatHistory = sessionService.getChatHistory(sessionId);
  const recentHistory = chatHistory.slice(-6); // Last 3 exchanges (user + assistant)

  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT.replace('{context}', context),
    },
  ];

  // Add recent conversation history for follow-up context
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'human' : 'assistant',
      content: msg.content,
    });
  }

  // Add current question
  messages.push({
    role: 'human',
    content: question,
  });

  // 5. Call Groq LLM
  let answer;
  try {
    const response = await chatModel.invoke(
      messages.map((m) => {
        if (m.role === 'system')
          return new (require('@langchain/core/messages').SystemMessage)(m.content);
        if (m.role === 'human')
          return new (require('@langchain/core/messages').HumanMessage)(m.content);
        return new (require('@langchain/core/messages').AIMessage)(m.content);
      })
    );
    answer = response.content;
  } catch (error) {
    const status = error?.status || error?.response?.status;
    const isRateLimit =
      status === 429 ||
      (error.message && error.message.includes('429')) ||
      (error.message && error.message.toLowerCase().includes('rate limit'));

    const err = new Error(
      isRateLimit
        ? 'The AI service is currently rate-limited. Please wait a moment and try again.'
        : `Failed to generate an answer: ${error.message}`
    );
    err.type = 'LLM_ERROR';
    err.statusCode = isRateLimit ? 429 : 502;
    throw err;
  }

  // 6. Build source citations from retrieval metadata (NOT from LLM output)
  const sourcesMap = new Map();
  for (const result of results) {
    const p = result.payload;
    const key = `${p.documentName}__${p.chunkIndex}`;
    if (!sourcesMap.has(key)) {
      sourcesMap.set(key, {
        documentId: p.documentId,
        documentName: p.documentName,
        chunkIndex: p.chunkIndex,
        totalChunks: p.totalChunks,
        excerpt: p.text.split(/\s+/).slice(0, 7).join(' ') + '…',
        score: result.score,
      });
    }
  }
  const sources = Array.from(sourcesMap.values()).sort((a, b) => b.score - a.score);

  // 7. Store in chat history
  sessionService.addChatMessage(sessionId, 'user', question);
  sessionService.addChatMessage(sessionId, 'assistant', answer, sources);

  return { answer, sources };
}

module.exports = { answerQuestion };
