const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const config = require('../config');

/**
 * Split text into chunks using LangChain's RecursiveCharacterTextSplitter.
 * Splits on paragraph/sentence/word boundaries intelligently.
 *
 * @param {string} text - The full text to split
 * @returns {Promise<string[]>} Array of text chunks
 */
async function chunkText(text) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}

module.exports = { chunkText };
