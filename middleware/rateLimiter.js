const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Rate limiter keyed by session ID (from header) or IP as fallback.
 * This prevents a single user from exhausting the free-tier API quotas.
 */
function createSessionKeyGenerator(req) {
  return req.headers['x-session-id'] || req.ip;
}

/**
 * Rate limiter for chat endpoint.
 */
const chatLimiter = rateLimit({
  windowMs: config.chatRateLimit.windowMs,
  max: config.chatRateLimit.max,
  keyGenerator: createSessionKeyGenerator,
  message: {
    error: 'Too many questions in a short time. Please wait a moment before asking again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for upload endpoint.
 */
const uploadLimiter = rateLimit({
  windowMs: config.uploadRateLimit.windowMs,
  max: config.uploadRateLimit.max,
  keyGenerator: createSessionKeyGenerator,
  message: {
    error: 'Too many file uploads in a short time. Please wait a moment before uploading again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { chatLimiter, uploadLimiter };
