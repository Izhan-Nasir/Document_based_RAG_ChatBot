const express = require('express');
const sessionService = require('../services/sessionService');

const router = express.Router();

/**
 * GET /api/session
 * Get or create a session. Returns the session ID.
 */
router.get('/', (req, res, next) => {
  try {
    const existingId = req.headers['x-session-id'];
    const { sessionId } = sessionService.getOrCreateSession(existingId);
    res.json({
      sessionId,
      activeSessions: sessionService.getActiveSessionCount(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/session/end
 * End the current session, deleting all vectors and session data.
 */
router.post('/end', async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      await sessionService.endSession(sessionId);
    }
    res.json({ message: 'Session ended and all data cleaned up.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
