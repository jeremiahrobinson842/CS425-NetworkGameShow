// server/src/db/queries/questions.js

/**
 * Query helpers for the `questions` table.
 *
 * This module provides functions to:
 * - Fetch a random set of questions from the database
 *
 * It depends on:
 * - The shared database query helper in `config/db.js`
 * - The logger utility in `utils/logger.js`
 *
 * @module db/queries/questions
 */

const { query } = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Fetches a random set of questions from the database.
 *
 * @param {number} count - Number of questions to retrieve.
 * @returns {Promise<Array<object>>} Array of question objects.
 */
async function getRandomQuestions(count) {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 10;

  logger.debug('Fetching random questions', { count: safeCount });

  const text = `
    SELECT
      id,
      category,
      text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      difficulty
    FROM questions
    ORDER BY RANDOM()
    LIMIT $1
  `;
  const params = [safeCount];

  const result = await query(text, params);

  logger.info('Random questions fetched', { count: result.rowCount });

  return result.rows;
}

module.exports = {
  getRandomQuestions
};
