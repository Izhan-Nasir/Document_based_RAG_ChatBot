const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { uploadLimiter } = require('../middleware/rateLimiter');
const documentService = require('../services/documentService');
const sessionService = require('../services/sessionService');

const router = express.Router();

// Configure multer for memory storage (no persistent file writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error(
        `Unsupported file type: "${ext}". Supported formats: PDF, TXT, DOCX, CSV.`
      );
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      cb(err);
    }
  },
});

/**
 * POST /api/upload
 * Upload and process a document.
 */
router.post(
  '/',
  uploadLimiter,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const error = new Error(
              `File is too large. Maximum allowed size is ${Math.round(config.maxFileSize / (1024 * 1024))} MB.`
            );
            error.type = 'VALIDATION_ERROR';
            error.statusCode = 400;
            return next(error);
          }
          const error = new Error(`Upload error: ${err.message}`);
          error.type = 'VALIDATION_ERROR';
          error.statusCode = 400;
          return next(error);
        }
        return next(err);
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      // Validate session
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        const err = new Error('Session ID is required. Please refresh the page.');
        err.type = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }

      // Ensure session exists
      sessionService.getOrCreateSession(sessionId);

      // Validate file
      if (!req.file) {
        const err = new Error('No file was provided. Please select a file to upload.');
        err.type = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }

      // Process the document (parse → chunk → embed → store)
      const result = await documentService.processDocument(
        sessionId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(200).json({
        message: `Document "${result.documentName}" processed successfully.`,
        document: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/documents
 * List all documents in the current session.
 */
router.get('/', (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.json({ documents: [] });
    }
    const documents = sessionService.getDocuments(sessionId);
    const isProcessing = sessionService.isProcessing(sessionId);
    res.json({ documents, isProcessing });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/documents/:documentId
 * Remove a document and delete its vectors from the vector store.
 */
router.delete('/:documentId', async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      const err = new Error('Session ID is required.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const { documentId } = req.params;

    // Verify document exists in session
    const documents = sessionService.getDocuments(sessionId);
    const doc = documents.find((d) => d.documentId === documentId);
    if (!doc) {
      const err = new Error('Document not found in this session.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 404;
      throw err;
    }

    // Remove document (deletes vectors from Qdrant + removes from session)
    await documentService.removeDocument(sessionId, documentId);

    res.json({
      message: `Document "${doc.documentName}" removed and its vectors deleted.`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
