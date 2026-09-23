const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { parse: csvParse } = require('csv-parse/sync');
const path = require('path');

/**
 * Extract text content from a file buffer based on its type.
 * @param {Buffer} buffer - File contents
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type
 * @returns {Promise<string>} Extracted text content
 */
async function parseFile(buffer, originalName, mimeType) {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.pdf':
      return parsePDF(buffer);
    case '.docx':
      return parseDOCX(buffer);
    case '.csv':
      return parseCSV(buffer);
    case '.txt':
      return parseTXT(buffer);
    default:
      const err = new Error(
        `Unsupported file type: "${ext}". Supported formats: PDF, TXT, DOCX, CSV.`
      );
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
  }
}

/**
 * Extract text from a PDF file.
 */
async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    if (!text) {
      const err = new Error(
        'The PDF file appears to be empty or contains only images/scans. Only text-based PDFs are supported.'
      );
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
    return text;
  } catch (error) {
    if (error.type === 'VALIDATION_ERROR') throw error;
    const err = new Error(`Failed to parse PDF: ${error.message}`);
    err.type = 'PARSE_ERROR';
    err.statusCode = 422;
    throw err;
  }
}

/**
 * Extract text from a DOCX file.
 */
async function parseDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    if (!text) {
      const err = new Error('The DOCX file appears to be empty or contains no extractable text.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
    return text;
  } catch (error) {
    if (error.type === 'VALIDATION_ERROR') throw error;
    const err = new Error(`Failed to parse DOCX: ${error.message}`);
    err.type = 'PARSE_ERROR';
    err.statusCode = 422;
    throw err;
  }
}

/**
 * Extract text from a CSV file.
 * Converts each row into a readable text representation.
 */
function parseCSV(buffer) {
  try {
    const content = buffer.toString('utf-8').trim();
    if (!content) {
      const err = new Error('The CSV file appears to be empty.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const records = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (records.length === 0) {
      const err = new Error('The CSV file contains no data rows.');
      err.type = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    // Convert each row into a readable text line: "Column1: Value1, Column2: Value2, ..."
    const textLines = records.map((row) =>
      Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    );

    return textLines.join('\n');
  } catch (error) {
    if (error.type === 'VALIDATION_ERROR') throw error;
    const err = new Error(`Failed to parse CSV: ${error.message}`);
    err.type = 'PARSE_ERROR';
    err.statusCode = 422;
    throw err;
  }
}

/**
 * Extract text from a plain text file.
 */
function parseTXT(buffer) {
  const text = buffer.toString('utf-8').trim();
  if (!text) {
    const err = new Error('The text file appears to be empty.');
    err.type = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }
  return text;
}

module.exports = { parseFile };
