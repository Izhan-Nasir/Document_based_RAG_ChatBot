const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const vectorStoreService = require('./services/vectorStoreService');
const sessionService = require('./services/sessionService');

// Routes
const uploadRoutes = require('./routes/uploadRoutes');
const chatRoutes = require('./routes/chatRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessionService.getActiveSessionCount(),
    uptime: Math.round(process.uptime()),
  });
});

// Serve index.html for any non-API route (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Central Error Handler (must be last) ---
app.use(errorHandler);

// --- Start Server ---
async function start() {
  try {
    // Ensure Qdrant collection exists before accepting requests
    console.log('[Startup] Connecting to Qdrant Cloud...');
    await vectorStoreService.ensureCollection();
    console.log('[Startup] Qdrant collection ready.');

    // Start periodic session cleanup
    const cleanupInterval = setInterval(async () => {
      try {
        await sessionService.cleanupStaleSessions();
      } catch (err) {
        console.error('[Cleanup] Error during session cleanup:', err.message);
      }
    }, config.sessionCleanupInterval);

    // Don't let cleanup interval keep the process alive if everything else exits
    cleanupInterval.unref();

    app.listen(config.port, () => {
      console.log(`\n🚀 Oracle running at http://localhost:${config.port}`);
      console.log(`   Chat model: ${config.groqModel} (Groq)`);
      console.log(`   Embedding model: ${config.geminiEmbeddingModel} (Gemini)`);
      console.log(`   Vector store: ${config.qdrantCollectionName} (Qdrant Cloud)`);
      console.log(`   Session cleanup: every ${config.sessionCleanupInterval / 60000} min, timeout ${config.sessionInactivityTimeout / 60000} min\n`);
    });
  } catch (err) {
    console.error('\n❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
