/**
 * Central error handler middleware.
 * Catches all errors and returns clean JSON responses — never stack traces.
 */
function errorHandler(err, req, res, next) {
  // Log the full error server-side for debugging
  console.error(`[Error] ${err.type || 'UNKNOWN'}: ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Build user-facing error message
  let message;
  switch (err.type) {
    case 'VALIDATION_ERROR':
      message = err.message;
      break;
    case 'PARSE_ERROR':
      message = err.message;
      break;
    case 'EMBEDDING_ERROR':
      message = err.message || "Couldn't process that document. The embedding service may be temporarily unavailable.";
      break;
    case 'LLM_ERROR':
      message = err.message || "Couldn't generate an answer. The AI service may be temporarily unavailable.";
      break;
    case 'VECTOR_STORE_ERROR':
      message = err.message || 'The vector store is temporarily unavailable. Please try again later.';
      break;
    default:
      // Generic 500 — never expose internal details
      message =
        statusCode === 500
          ? 'An unexpected error occurred. Please try again later.'
          : err.message || 'An error occurred.';
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
