const express = require('express');
const { chatLimiter } = require('../middleware/rateLimiter');
const chatService = require('../services/chatService');
const sessionService = require('../services/sessionService');

const router = express.Router();

/**
 * POST /api/chat
 * Ask a question — answered via RAG from uploaded documents.
 */
router.post('/', chatLimiter, async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      const err = new Error('Session ID is required. Please refresh the page.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const { question } = req.body;

    // Validate question — reject empty/whitespace-only
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      const err = new Error('Please enter a question. Empty or whitespace-only questions are not allowed.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const trimmedQuestion = question.trim();

    // Answer using RAG pipeline
    const result = await chatService.answerQuestion(sessionId, trimmedQuestion);

    res.json({
      answer: result.answer,
      sources: result.sources,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chat/history
 * Get the chat history for the current session.
 */
router.get('/history', (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.json({ history: [] });
    }
    const history = sessionService.getChatHistory(sessionId);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/chat/history
 * Clear the conversation history (does NOT affect documents or vectors).
 */
router.delete('/history', (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.json({ message: 'Chat history cleared.' });
    }
    sessionService.clearChatHistory(sessionId);
    res.json({ message: 'Chat history cleared.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
