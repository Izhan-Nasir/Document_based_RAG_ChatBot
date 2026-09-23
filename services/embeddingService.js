const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: config.geminiEmbeddingModel });

/**
 * Embed a single text string using Google Gemini.
 * Returns a float array of dimension config.embeddingDimension.
 */
async function embedText(text) {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: config.embeddingDimension,
  });
  return result.embedding.values;
}

/**
 * Embed multiple texts in batch. Gemini supports batch embedding.
 * Includes retry with exponential backoff for 429 errors.
 */
async function embedTexts(texts, maxRetries = 3) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const result = await embeddingModel.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { parts: [{ text }] },
          outputDimensionality: config.embeddingDimension,
        })),
      });
      return result.embeddings.map((e) => e.values);
    } catch (error) {
      const status = error?.status || error?.httpStatusCode || error?.code;
      const isRateLimit =
        status === 429 ||
        (error.message && error.message.includes('429')) ||
        (error.message && error.message.toLowerCase().includes('rate limit'));

      if (isRateLimit && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(
          `[Embedding] Rate limited (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.round(backoffMs)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        attempt++;
        continue;
      }

      // Not a rate limit or retries exhausted
      const err = new Error(
        isRateLimit
          ? 'Embedding service is rate-limited. Please wait a moment and try again.'
          : `Failed to generate embeddings: ${error.message}`
      );
      err.type = 'EMBEDDING_ERROR';
      err.statusCode = isRateLimit ? 429 : 502;
      throw err;
    }
  }
}

module.exports = { embedText, embedTexts };
