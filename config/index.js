const dotenv = require('dotenv');
dotenv.config();

// --- Required environment variables ---
const REQUIRED_VARS = [
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'QDRANT_URL',
  'QDRANT_API_KEY',
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(
    `\n❌ Missing required environment variables:\n${missing.map((v) => `   - ${v}`).join('\n')}\n\nCopy .env.example to .env and fill in your API keys.\n`
  );
  process.exit(1);
}

const config = {
  // Groq (Chat Completions)
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',

  // Gemini (Embeddings only)
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',

  // Qdrant (Vector Store)
  qdrantUrl: process.env.QDRANT_URL,
  qdrantApiKey: process.env.QDRANT_API_KEY,
  qdrantCollectionName: process.env.QDRANT_COLLECTION_NAME || 'document-chatbot',

  // Server
  port: parseInt(process.env.PORT, 10) || 3000,

  // Upload limits
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10 MB

  // Allowed file types
  allowedMimeTypes: {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/csv': 'csv',
    'application/csv': 'csv',
  },
  allowedExtensions: ['.pdf', '.txt', '.docx', '.csv'],

  // Chunking
  chunkSize: 1000,
  chunkOverlap: 200,

  // Retrieval
  retrievalK: 4,

  // Embedding dimensions (Gemini text-embedding-004 outputs 768-dim by default)
  embeddingDimension: 768,

  // Session
  sessionInactivityTimeout: 60 * 60 * 1000, // 1 hour in ms
  sessionCleanupInterval: 30 * 60 * 1000,   // 30 minutes in ms

  // Rate limiting
  chatRateLimit: { windowMs: 60 * 1000, max: 10 },   // 10 req/min
  uploadRateLimit: { windowMs: 60 * 1000, max: 5 },   // 5 req/min
};

module.exports = config;
